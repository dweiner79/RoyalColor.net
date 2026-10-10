import tempfile
import unittest
from pathlib import Path

from submit_indexnow import INDEXNOW_KEY, SITE_HOST, sitemap_urls, submission_payload


class IndexNowSubmissionTests(unittest.TestCase):
    def test_sitemap_urls_reads_canonical_site_urls(self) -> None:
        sitemap_path = Path(__file__).resolve().parent.parent / "sitemap.xml"

        urls = sitemap_urls(sitemap_path)

        self.assertEqual(9, len(urls))
        self.assertTrue(all(url.startswith(f"https://{SITE_HOST}/") for url in urls))

    def test_sitemap_urls_rejects_external_hosts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            sitemap_path = Path(temporary_directory) / "sitemap.xml"
            sitemap_path.write_text(
                "<urlset><url><loc>https://example.com/page</loc></url></urlset>",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "outside"):
                sitemap_urls(sitemap_path)

    def test_submission_payload_uses_public_key_location(self) -> None:
        urls = [f"https://{SITE_HOST}/"]

        payload = submission_payload(urls)

        self.assertEqual(SITE_HOST, payload["host"])
        self.assertEqual(INDEXNOW_KEY, payload["key"])
        self.assertEqual(f"https://{SITE_HOST}/{INDEXNOW_KEY}.txt", payload["keyLocation"])
        self.assertEqual(urls, payload["urlList"])


if __name__ == "__main__":
    unittest.main()