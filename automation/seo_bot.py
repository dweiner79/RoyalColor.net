#!/usr/bin/env python3
"""Audit Royal Color SEO and generate approval-first marketing tasks."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


USER_AGENT = "RoyalColorSeoBot/1.0 (+https://www.royalcolor.net/)"


@dataclass
class PageData:
    titles: list[str] = field(default_factory=list)
    descriptions: list[str] = field(default_factory=list)
    canonicals: list[str] = field(default_factory=list)
    headings: list[str] = field(default_factory=list)
    json_ld: list[str] = field(default_factory=list)


class SeoParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.data = PageData()
        self._capture: str | None = None
        self._buffer: list[str] = []
        self._in_json_ld = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self._capture = "title"
            self._buffer = []
        elif tag == "h1":
            self._capture = "h1"
            self._buffer = []
        elif tag == "meta" and values.get("name", "").lower() == "description":
            self.data.descriptions.append(values.get("content", "").strip())
        elif tag == "link" and values.get("rel", "").lower() == "canonical":
            self.data.canonicals.append(values.get("href", "").strip())
        elif tag == "script" and values.get("type", "").lower() == "application/ld+json":
            self._in_json_ld = True
            self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._capture or self._in_json_ld:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        text = " ".join("".join(self._buffer).split())
        if tag == "title" and self._capture == "title":
            self.data.titles.append(text)
            self._capture = None
            self._buffer = []
        elif tag == "h1" and self._capture == "h1":
            self.data.headings.append(text)
            self._capture = None
            self._buffer = []
        elif tag == "script" and self._in_json_ld:
            self.data.json_ld.append("".join(self._buffer).strip())
            self._in_json_ld = False
            self._buffer = []


def fetch(url: str, timeout: int = 20) -> tuple[int, str, str, str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return (
            response.status,
            response.headers.get_content_type(),
            response.geturl(),
            response.read().decode("utf-8", errors="replace"),
        )


def load_sitemap(url: str) -> list[str]:
    status, _, _, body = fetch(url)
    if status != 200:
        raise RuntimeError(f"Sitemap returned HTTP {status}")
    root = ET.fromstring(body)
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [node.text.strip() for node in root.findall("sm:url/sm:loc", namespace) if node.text]


def parse_page(body: str) -> PageData:
    parser = SeoParser()
    parser.feed(body)
    parser.close()
    return parser.data


def audit_site(config: dict[str, Any]) -> dict[str, Any]:
    issues: list[dict[str, str]] = []
    pages: list[dict[str, Any]] = []
    seen_titles: dict[str, str] = {}
    seen_descriptions: dict[str, str] = {}

    try:
        urls = load_sitemap(config["sitemap_url"])
    except (ET.ParseError, OSError, RuntimeError, urllib.error.URLError) as error:
        return {"healthy": False, "issues": [{"severity": "error", "message": str(error)}], "pages": []}

    expected_urls = config.get("expected_sitemap_urls")
    if expected_urls is not None and len(urls) != expected_urls:
        issues.append({"severity": "error", "message": f"Sitemap has {len(urls)} URLs; expected {expected_urls}."})

    for url in urls:
        page_result: dict[str, Any] = {"url": url}
        try:
            status, content_type, final_url, body = fetch(url)
            parsed = parse_page(body)
            page_result.update({"status": status, "content_type": content_type, "final_url": final_url})
        except (OSError, urllib.error.URLError) as error:
            issues.append({"severity": "error", "message": f"{url}: request failed: {error}"})
            pages.append(page_result)
            continue

        checks = {
            "title": parsed.titles,
            "meta description": parsed.descriptions,
            "canonical": parsed.canonicals,
            "H1": parsed.headings,
        }
        for label, values in checks.items():
            if len(values) != 1 or not values[0]:
                issues.append({"severity": "error", "message": f"{url}: expected one non-empty {label}; found {len(values)}."})

        if status != 200:
            issues.append({"severity": "error", "message": f"{url}: returned HTTP {status}."})
        if content_type != "text/html":
            issues.append({"severity": "warning", "message": f"{url}: content type is {content_type}."})
        if parsed.canonicals and not parsed.canonicals[0].startswith(config["canonical_origin"]):
            issues.append({"severity": "error", "message": f"{url}: canonical is outside the preferred host."})

        for raw_json in parsed.json_ld:
            try:
                json.loads(raw_json)
            except json.JSONDecodeError as error:
                issues.append({"severity": "error", "message": f"{url}: invalid JSON-LD: {error.msg}."})

        if parsed.titles:
            previous = seen_titles.setdefault(parsed.titles[0], url)
            if previous != url:
                issues.append({"severity": "warning", "message": f"{url}: duplicate title also used by {previous}."})
        if parsed.descriptions:
            previous = seen_descriptions.setdefault(parsed.descriptions[0], url)
            if previous != url:
                issues.append({"severity": "warning", "message": f"{url}: duplicate description also used by {previous}."})

        page_result.update({
            "title": parsed.titles[0] if parsed.titles else "",
            "description": parsed.descriptions[0] if parsed.descriptions else "",
            "canonical": parsed.canonicals[0] if parsed.canonicals else "",
            "h1": parsed.headings[0] if parsed.headings else "",
            "json_ld_blocks": len(parsed.json_ld),
        })
        pages.append(page_result)

    return {"healthy": not any(issue["severity"] == "error" for issue in issues), "issues": issues, "pages": pages}


def build_post_draft(config: dict[str, Any], today: dt.date) -> dict[str, str]:
    topics = config["post_topics"]
    topic = topics[today.isocalendar().week % len(topics)]
    text = topic["text"].format(
        booking_url=config["booking_url"],
        review_url=config["review_url"],
    )
    return {"title": topic["title"], "text": text, "call_to_action": topic["call_to_action"]}


def citation_summary(config: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    citations = config["citations"]
    return {
        "verified": [item for item in citations if item["status"] == "verified"],
        "needs_review": [item for item in citations if item["status"] != "verified"],
    }


def markdown_report(config: dict[str, Any], audit: dict[str, Any], post: dict[str, str], citations: dict[str, Any], generated: str) -> str:
    health = "PASS" if audit["healthy"] else "ATTENTION NEEDED"
    lines = [
        "# Royal Color SEO Bot Report",
        "",
        f"Generated: {generated}",
        f"Technical SEO: **{health}**",
        "",
        "## Findings",
        "",
    ]
    if audit["issues"]:
        lines.extend(f"- **{item['severity'].upper()}**: {item['message']}" for item in audit["issues"])
    else:
        lines.append("- No technical SEO problems detected.")

    lines.extend([
        "",
        "## Google Business Profile Post Draft",
        "",
        f"**{post['title']}**",
        "",
        post["text"],
        "",
        f"Suggested button: **{post['call_to_action']}** -> {config['booking_url']}",
        "",
        "> Approval required: review this copy and publish it manually in Google Business Profile.",
        "",
        "## Local Citations",
        "",
    ])
    if citations["needs_review"]:
        for item in citations["needs_review"]:
            url = item.get("url") or "not recorded"
            lines.append(f"- [ ] **{item['name']}** ({item['status']}) - {url}")
    else:
        lines.append("- All configured citations are verified.")

    lines.extend([
        "",
        "## Verified Citations",
        "",
    ])
    if citations["verified"]:
        lines.extend(f"- [x] **{item['name']}** - {item['url']}" for item in citations["verified"])
    else:
        lines.append("- None recorded yet.")

    lines.extend([
        "",
        "## Review Request",
        "",
        f"Send this only to genuine clients after a completed appointment: {config['review_url']}",
        "",
        "The bot does not publish posts, alter Google Business Profile, or generate reviews.",
    ])
    return "\n".join(lines) + "\n"


def run(config_path: Path, output_dir: Path, today: dt.date | None = None) -> int:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    current_date = today or dt.date.today()
    audit = audit_site(config)
    post = build_post_draft(config, current_date)
    citations = citation_summary(config)
    payload = {
        "generated_at": generated_at,
        "audit": audit,
        "post_draft": post,
        "citations": citations,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "report.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    (output_dir / "report.md").write_text(
        markdown_report(config, audit, post, citations, generated_at),
        encoding="utf-8",
    )
    print(f"SEO report written to {output_dir / 'report.md'}")
    return 0 if audit["healthy"] else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("seo_bot.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("seo-bot-report"))
    args = parser.parse_args()
    return run(args.config, args.output_dir)


if __name__ == "__main__":
    sys.exit(main())