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

    def test_admin_pages_use_google_sign_in(self) -> None:
        for name in ADMIN_PAGES:
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertIn("js/admin-auth.js", text, name)
            self.assertIn("rcAdmin.start", text, name)
            self.assertIn('id="googleSignIn"', text, name)
            self.assertNotIn("loginPass", text, name)

    def test_google_client_id_is_configured(self) -> None:
        text = (ROOT / "js" / "admin-auth.js").read_text(encoding="utf-8")
        self.assertNotIn("PLACEHOLDER", text)
        self.assertRegex(text, r"CLIENT_ID = '\d+-[a-z0-9]+\.apps\.googleusercontent\.com'")

    def test_customer_data_is_not_fetched_with_plain_get_requests(self) -> None:
        pattern = re.compile(r"action=(getLeads|analytics)")
        for name in ADMIN_PAGES:
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertIsNone(pattern.search(text), name)

    def test_apps_script_protects_every_customer_data_action(self) -> None:
        script = (ROOT / "google-apps-script.gs").read_text(encoding="utf-8")
        for action in ("adminAnalytics", "adminLeads", "adminConfig", "saveConfig", "addLead", "deleteLead"):
            match = re.search(rf"data\.type === '{action}'\) \{{\s*(?://[^\n]*\n\s*)?result = !checkAdmin\(data\.idToken\)", script)
            self.assertIsNotNone(match, f"{action} must verify the Google sign-in")
        self.assertIn("ALLOWED_EMAILS", script)
        self.assertIn("info.aud === clientId", script)
        self.assertNotIn("@gmail.com", script.split("function checkAdmin")[1].split("// ============ HELPERS")[0])
        self.assertNotIn("result = getLeads(p.limit", script)
        self.assertIn("delete result.calendarId", script)


if __name__ == "__main__":
    unittest.main()
