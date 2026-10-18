#!/usr/bin/env python3
"""Reply to new Google Business Profile reviews after a one-day wait.

Safe by default: previews replies unless --post is passed. Only 4-5 star
reviews are answered automatically; anything lower opens a GitHub issue so a
person writes the reply.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Callable

GBP_REVIEWS_API = "https://mybusiness.googleapis.com/v4"
GBP_ACCOUNTS_API = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
GBP_LOCATIONS_API = "https://mybusinessbusinessinformation.googleapis.com/v1"
TOKEN_URL = "https://oauth2.googleapis.com/token"
MODELS_URL = "https://models.github.ai/inference/chat/completions"
DEFAULT_MODEL = "openai/gpt-4.1-mini"

STAR_VALUES = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}
AUTO_REPLY_MIN_STARS = 4
WAIT_HOURS = 24
MAX_AGE_DAYS = 30
MAX_REPLIES_PER_RUN = 3

SYSTEM_PROMPT = """You write public replies to Google reviews as Daphna Weiner, \
owner of Royal Color Analysis & Styling, a color analysis and personal styling \
business in South Florida.
Rules:
- Thank the reviewer by first name when a name is given.
- Mention one or two specific positive things the reviewer actually wrote.
- Warm, sincere, first person, 40 to 80 words, no emojis, no sign-off.
- Never invent details about their session, and never mention prices, discounts, \
promises, links, phone numbers, or email addresses.
- Vary the wording; do not sound like a template.
Style examples:
Review: First time getting my colors done and I was shocked by the results. Daphna \
explained every detail.
Reply: Thank you, Michelle! I'm so happy your first color analysis was such a \
pleasant surprise. It meant a lot to hear it changed your outfit choices for the \
better. I love explaining every detail so you can use your colors with confidence.
Review: Lovely, warm, and made it personal. I've recommended her to several friends.
Reply: Thank you, Andrea! It was a pleasure working with you. I truly appreciate \
you recommending me to your friends. Referrals mean the world to a small business."""

FORBIDDEN = re.compile(
    r"https?://|www\.|@\w|\$\d|\b(discount|refund|free|guarantee|coupon)\b|\d{3}[-. )]\d{3,4}",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Review:
    name: str
    review_id: str
    reviewer: str
    stars: int
    comment: str
    created: dt.datetime
    replied: bool


def parse_time(value: str) -> dt.datetime:
    trimmed = re.sub(r"(\.\d{6})\d+", r"\1", value)
    return dt.datetime.fromisoformat(trimmed.replace("Z", "+00:00"))


def parse_review(raw: dict) -> Review:
    return Review(
        name=raw["name"],
        review_id=raw.get("reviewId", raw["name"].rsplit("/", 1)[-1]),
        reviewer=raw.get("reviewer", {}).get("displayName", ""),
        stars=STAR_VALUES.get(raw.get("starRating", ""), 0),
        comment=(raw.get("comment") or "").strip(),
        created=parse_time(raw["createTime"]),
        replied=bool(raw.get("reviewReply", {}).get("comment")),
    )


def first_name(display_name: str) -> str:
    cleaned = display_name.strip()
    if not cleaned or cleaned.lower().startswith(("a google user", "anonymous")):
        return ""
    return cleaned.split()[0]


def select_reviews(
    reviews: list[Review],
    now: dt.datetime,
    wait_hours: int = WAIT_HOURS,
    max_age_days: int = MAX_AGE_DAYS,
) -> tuple[list[Review], list[Review]]:
    """Return (reviews to auto-reply to, reviews needing a human reply)."""
    auto: list[Review] = []
    manual: list[Review] = []
    for review in sorted(reviews, key=lambda item: item.created):
        age = now - review.created
        if review.replied or age < dt.timedelta(hours=wait_hours):
            continue
        if age > dt.timedelta(days=max_age_days):
            continue
        (auto if review.stars >= AUTO_REPLY_MIN_STARS else manual).append(review)
    return auto, manual


def fallback_reply(review: Review) -> str:
    name = first_name(review.reviewer)
    greeting = f"Thank you so much, {name}!" if name else "Thank you so much!"
    return (
        f"{greeting} I'm so glad you had a great experience working with me. "
        "Your kind words truly mean a lot to me and to my small business. "
        "I'm grateful you took the time to share it."
    )


def valid_reply(text: str) -> bool:
    return 40 <= len(text) <= 700 and not FORBIDDEN.search(text)


def build_prompt(review: Review) -> str:
    name = first_name(review.reviewer) or "(no name given)"
    return f"Reviewer first name: {name}\nStars: {review.stars}\nReview: {review.comment[:1500]}\nReply:"


def generate_reply(review: Review, ask_model: Callable[[str, str], str] | None) -> tuple[str, str]:
    """Return (reply text, source) where source is 'model' or 'template'."""
    if review.comment and ask_model is not None:
        try:
            text = ask_model(SYSTEM_PROMPT, build_prompt(review)).strip().strip('"')
            if valid_reply(text):
                return text, "model"
        except (urllib.error.URLError, KeyError, ValueError, TimeoutError):
            pass
    return fallback_reply(review), "template"


def http_json(url: str, *, method: str = "GET", headers: dict | None = None,
              body: dict | None = None, form: dict | None = None) -> dict:
    data = None
    request_headers = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    elif form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=request_headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload) if payload else {}


def model_asker(token: str, model: str) -> Callable[[str, str], str]:
    def ask(system: str, user: str) -> str:
        result = http_json(
            MODELS_URL,
            method="POST",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            body={
                "model": model,
                "temperature": 0.7,
                "max_tokens": 220,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
        )
        return result["choices"][0]["message"]["content"]

    return ask


class BusinessProfileClient:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str) -> None:
        self._credentials = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        self._token = ""

    def _auth(self) -> dict:
        if not self._token:
            self._token = http_json(TOKEN_URL, method="POST", form=self._credentials)["access_token"]
        return {"Authorization": f"Bearer {self._token}"}

    def list_accounts(self) -> list[dict]:
        return http_json(GBP_ACCOUNTS_API, headers=self._auth()).get("accounts", [])

    def list_locations(self, account: str) -> list[dict]:
        url = f"{GBP_LOCATIONS_API}/{account}/locations?readMask=name,title&pageSize=100"
        return http_json(url, headers=self._auth()).get("locations", [])

    def list_reviews(self, account_id: str, location_id: str) -> list[Review]:
        reviews: list[Review] = []
        page_token = ""
        while True:
            query = {"pageSize": "50", "orderBy": "updateTime desc"}
            if page_token:
                query["pageToken"] = page_token
            url = (f"{GBP_REVIEWS_API}/accounts/{account_id}/locations/{location_id}/reviews?"
                   + urllib.parse.urlencode(query))
            page = http_json(url, headers=self._auth())
            reviews.extend(parse_review(raw) for raw in page.get("reviews", []))
            page_token = page.get("nextPageToken", "")
            if not page_token:
                return reviews

    def post_reply(self, review_name: str, comment: str) -> None:
        http_json(f"{GBP_REVIEWS_API}/{review_name}/reply", method="PUT",
                  headers=self._auth(), body={"comment": comment})


def open_manual_issue(review: Review) -> bool:
    """Create a GitHub issue for a review that needs a human reply (once per review)."""
    marker = f"review-id:{review.review_id}"
    existing = subprocess.run(
        ["gh", "issue", "list", "--state", "all", "--search", f'"{marker}" in:body',
         "--json", "number", "--jq", "length"],
        capture_output=True, text=True, check=False,
    )
    if existing.returncode == 0 and existing.stdout.strip() not in ("", "0"):
        return False
    body = (f"A {review.stars}-star review needs a personal reply from Daphna.\n\n"
            f"Reviewer: {review.reviewer or 'Anonymous'}\n\n> {review.comment or '(no text)'}\n\n"
            f"Reply in Google Business Profile > Reviews.\n\n<!-- {marker} -->")
    created = subprocess.run(
        ["gh", "issue", "create", "--title",
         f"Review needs a manual reply: {review.reviewer or 'Anonymous'} ({review.stars} stars)",
         "--body", body],
        capture_output=True, text=True, check=False,
    )
    return created.returncode == 0


def run(
    client,
    account_id: str,
    location_id: str,
    ask_model: Callable[[str, str], str] | None,
    post: bool,
    now: dt.datetime,
    max_replies: int = MAX_REPLIES_PER_RUN,
    notify: Callable[[Review], bool] = open_manual_issue,
) -> list[str]:
    reviews = client.list_reviews(account_id, location_id)
    auto, manual = select_reviews(reviews, now)
    lines = [f"Reviews found: {len(reviews)} | due for reply: {len(auto)} | need a person: {len(manual)}"]
    for review in manual:
        opened = notify(review) if post else False
        lines.append(f"MANUAL {review.stars}-star from {review.reviewer or 'Anonymous'}"
                     f"{' (issue opened)' if opened else ''}")
    for review in auto[:max_replies]:
        text, source = generate_reply(review, ask_model)
        if post:
            client.post_reply(review.name, text)
        label = "POSTED" if post else "PREVIEW"
        lines.append(f"{label} ({source}) to {review.reviewer or 'Anonymous'}: {text}")
    if len(auto) > max_replies:
        lines.append(f"{len(auto) - max_replies} more review(s) will be handled on later runs.")
    return lines


def write_summary(lines: list[str]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write("## Review reply bot\n\n" + "\n\n".join(lines) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--post", action="store_true", help="publish replies (default is preview only)")
    parser.add_argument("--discover", action="store_true", help="print account and location IDs")
    parser.add_argument("--max-replies", type=int, default=MAX_REPLIES_PER_RUN)
    args = parser.parse_args(argv)

    keys = ("GBP_CLIENT_ID", "GBP_CLIENT_SECRET", "GBP_REFRESH_TOKEN")
    if any(not os.environ.get(key) for key in keys):
        print("Review bot is not configured yet: missing Google Business Profile secrets. Nothing to do.")
        return 0
    client = BusinessProfileClient(*(os.environ[key] for key in keys))

    if args.discover:
        for account in client.list_accounts():
            print(f"ACCOUNT {account.get('name')} ({account.get('accountName', '')})")
            for location in client.list_locations(account["name"]):
                print(f"  LOCATION {location.get('name')} ({location.get('title', '')})")
        return 0

    account_id, location_id = os.environ.get("GBP_ACCOUNT_ID"), os.environ.get("GBP_LOCATION_ID")
    if not account_id or not location_id:
        print("Missing GBP_ACCOUNT_ID or GBP_LOCATION_ID. Run with --discover to find them.")
        return 0

    token = os.environ.get("GITHUB_TOKEN", "")
    ask = model_asker(token, os.environ.get("REVIEW_BOT_MODEL", DEFAULT_MODEL)) if token else None
    lines = run(client, account_id, location_id, ask, args.post,
                dt.datetime.now(dt.timezone.utc), args.max_replies)
    print("\n".join(lines))
    write_summary(lines)
    return 0


if __name__ == "__main__":
    sys.exit(main())
