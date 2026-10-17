import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_PAGES = ["admin.html", "dashboard.html", "leads.html", "booking-settings.html"]


class AdminPageSecurityTests(unittest.TestCase):
    def test_no_hardcoded_credentials_in_any_page_or_script(self) -> None:
        pattern = re.compile(r"ADMIN_(USER|PASS)|Password!")
        for path in [*ROOT.glob("*.html"), *ROOT.glob("js/*.js")]:
            text = path.read_text(encoding="utf-8")
            self.assertIsNone(pattern.search(text), f"hard-coded credential found in {path.name}")

    def test_admin_pages_use_server_checked_login(self) -> None:
        for name in ADMIN_PAGES:
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertIn("js/admin-auth.js", text, name)
            self.assertIn("rcAdmin.signIn", text, name)
            self.assertNotIn("loginUser", text, name)

    def test_customer_data_is_not_fetched_with_plain_get_requests(self) -> None:
        pattern = re.compile(r"action=(getLeads|analytics)")
        for name in ADMIN_PAGES:
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertIsNone(pattern.search(text), name)

    def test_apps_script_protects_every_customer_data_action(self) -> None:
        script = (ROOT / "google-apps-script.gs").read_text(encoding="utf-8")
        for action in ("adminAnalytics", "adminLeads", "adminConfig", "saveConfig", "addLead", "deleteLead"):
            match = re.search(rf"data\.type === '{action}'\) \{{\s*(?://[^\n]*\n\s*)?result = !checkAdminKey", script)
            self.assertIsNotNone(match, f"{action} must check the admin key")
        self.assertNotIn("result = getLeads(p.limit", script)
        self.assertIn("delete result.calendarId", script)


if __name__ == "__main__":
    unittest.main()
