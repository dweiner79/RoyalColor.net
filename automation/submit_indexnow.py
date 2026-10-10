import argparse
import json
from pathlib import Path
from urllib import request
from urllib.parse import urlparse
from xml.etree import ElementTree


SITE_HOST = "www.royalcolor.net"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
INDEXNOW_KEY = "c0a230ec4f553e077b116f3f82d1bb7f"
REPOSITORY_ROOT = Path(__file__).resolve().parent.parent


def sitemap_urls(sitemap_path: Path) -> list[str]:
    root = ElementTree.parse(sitemap_path).getroot()
    urls = [element.text.strip() for element in root.findall("{*}url/{*}loc") if element.text]

    if not urls:
        raise ValueError("The sitemap does not contain any URLs")

    invalid_urls = [url for url in urls if urlparse(url).hostname != SITE_HOST]
    if invalid_urls:
        raise ValueError(f"Sitemap contains URLs outside {SITE_HOST}: {invalid_urls}")

    return urls


def submission_payload(urls: list[str]) -> dict[str, object]:
    return {
        "host": SITE_HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": f"https://{SITE_HOST}/{INDEXNOW_KEY}.txt",
        "urlList": urls,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Submit the Royal Color sitemap URLs to IndexNow")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the payload without submitting")
    args = parser.parse_args()

    key_path = REPOSITORY_ROOT / f"{INDEXNOW_KEY}.txt"
    if key_path.read_text(encoding="utf-8").strip() != INDEXNOW_KEY:
        raise ValueError("IndexNow key file is missing or invalid")

    payload = submission_payload(sitemap_urls(REPOSITORY_ROOT / "sitemap.xml"))
    encoded_payload = json.dumps(payload, indent=2).encode("utf-8")

    if args.dry_run:
        print(encoded_payload.decode("utf-8"))
        return

    submission = request.Request(
        INDEXNOW_ENDPOINT,
        data=encoded_payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with request.urlopen(submission, timeout=30) as response:
        if response.status not in (200, 202):
            raise RuntimeError(f"IndexNow returned HTTP {response.status}")
        print(f"IndexNow accepted {len(payload['urlList'])} URLs (HTTP {response.status})")


if __name__ == "__main__":
    main()