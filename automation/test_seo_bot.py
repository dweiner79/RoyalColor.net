import datetime as dt
import unittest
from unittest.mock import patch

import seo_bot


SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.royalcolor.net/</loc></url>
</urlset>
"""

VALID_PAGE = """<!doctype html>
<html><head>
<title>Color Analysis South Florida | Royal Color</title>
<meta name="description" content="Professional color analysis in South Florida.">
<link rel="canonical" href="https://www.royalcolor.net/">
<script type="application/ld+json">{"@type":"ProfessionalService"}</script>
</head><body><h1>Personal Color Analysis in South Florida</h1></body></html>
"""


class SeoBotTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "sitemap_url": "https://www.royalcolor.net/sitemap.xml",
            "canonical_origin": "https://www.royalcolor.net/",
            "expected_sitemap_urls": 1,
            "booking_url": "https://www.royalcolor.net/booking.html",
            "review_url": "https://g.page/example/review",
            "post_topics": [
                {"title": "Test", "text": "Book here: {booking_url}", "call_to_action": "Book"}
            ],
            "citations": [
                {"name": "Google", "status": "verified", "url": "https://example.com"},
                {"name": "Bing", "status": "not_configured", "url": ""}
            ],
        }

    @patch("seo_bot.fetch")
    def test_healthy_site_passes(self, mock_fetch):
        mock_fetch.side_effect = [
            (200, "text/xml", self.config["sitemap_url"], SITEMAP),
            (200, "text/html", "https://www.royalcolor.net/", VALID_PAGE),
        ]

        result = seo_bot.audit_site(self.config)

        self.assertTrue(result["healthy"])
        self.assertEqual(result["issues"], [])
        self.assertEqual(result["pages"][0]["json_ld_blocks"], 1)

    @patch("seo_bot.fetch")
    def test_missing_description_fails(self, mock_fetch):
        broken_page = VALID_PAGE.replace(
            '<meta name="description" content="Professional color analysis in South Florida.">',
            "",
        )
        mock_fetch.side_effect = [
            (200, "text/xml", self.config["sitemap_url"], SITEMAP),
            (200, "text/html", "https://www.royalcolor.net/", broken_page),
        ]

        result = seo_bot.audit_site(self.config)

        self.assertFalse(result["healthy"])
        self.assertTrue(any("meta description" in item["message"] for item in result["issues"]))

    def test_post_and_citation_output(self):
        post = seo_bot.build_post_draft(self.config, dt.date(2026, 9, 13))
        citations = seo_bot.citation_summary(self.config)

        self.assertIn(self.config["booking_url"], post["text"])
        self.assertEqual(len(citations["verified"]), 1)
        self.assertEqual(len(citations["needs_review"]), 1)


if __name__ == "__main__":
    unittest.main()