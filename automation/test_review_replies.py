import datetime as dt
import unittest

import review_replies as bot

NOW = dt.datetime(2026, 10, 20, 12, 0, tzinfo=dt.timezone.utc)


def raw_review(review_id: str, stars: str, hours_old: float, comment: str = "Wonderful session!",
               reviewer: str = "Jane Doe", reply: str = "") -> dict:
    created = NOW - dt.timedelta(hours=hours_old)
    raw = {
        "name": f"accounts/1/locations/2/reviews/{review_id}",
        "reviewId": review_id,
        "reviewer": {"displayName": reviewer},
        "starRating": stars,
        "comment": comment,
        "createTime": created.strftime("%Y-%m-%dT%H:%M:%S.123456789Z"),
    }
    if reply:
        raw["reviewReply"] = {"comment": reply}
    return raw


class FakeClient:
    def __init__(self, raws: list[dict]) -> None:
        self._reviews = [bot.parse_review(raw) for raw in raws]
        self.posted: list[tuple[str, str]] = []

    def list_reviews(self, account_id: str, location_id: str) -> list[bot.Review]:
        return self._reviews

    def post_reply(self, review_name: str, comment: str) -> None:
        self.posted.append((review_name, comment))


GOOD_REPLY = (
    "Thank you, Jane! I'm so happy you enjoyed your session and left feeling "
    "confident about your colors. Your kind words mean a lot to me."
)


class SelectionTests(unittest.TestCase):
    def select(self, raws: list[dict]):
        return bot.select_reviews([bot.parse_review(raw) for raw in raws], NOW)

    def test_waits_a_full_day_before_replying(self) -> None:
        auto, manual = self.select([raw_review("new", "FIVE", 23), raw_review("due", "FIVE", 25)])
        self.assertEqual(["due"], [review.review_id for review in auto])
        self.assertEqual([], manual)

    def test_skips_reviews_that_already_have_a_reply(self) -> None:
        auto, _ = self.select([raw_review("done", "FIVE", 72, reply="Thanks!")])
        self.assertEqual([], auto)

    def test_low_ratings_go_to_a_person(self) -> None:
        auto, manual = self.select([raw_review("bad", "TWO", 30), raw_review("ok", "FOUR", 30)])
        self.assertEqual(["ok"], [review.review_id for review in auto])
        self.assertEqual(["bad"], [review.review_id for review in manual])

    def test_ignores_very_old_reviews(self) -> None:
        auto, manual = self.select([raw_review("ancient", "FIVE", 24 * 45)])
        self.assertEqual(([], []), (auto, manual))


class ReplyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.review = bot.parse_review(raw_review("r1", "FIVE", 30))

    def test_uses_model_reply_when_valid(self) -> None:
        text, source = bot.generate_reply(self.review, lambda system, user: GOOD_REPLY)
        self.assertEqual(("model", GOOD_REPLY), (source, text))

    def test_falls_back_when_model_reply_has_a_link(self) -> None:
        bad = GOOD_REPLY + " Book again at https://example.com today."
        text, source = bot.generate_reply(self.review, lambda system, user: bad)
        self.assertEqual("template", source)
        self.assertIn("Jane", text)

    def test_falls_back_when_model_fails(self) -> None:
        def broken(system: str, user: str) -> str:
            raise ValueError("boom")

        self.assertEqual("template", bot.generate_reply(self.review, broken)[1])

    def test_rating_only_review_uses_template(self) -> None:
        review = bot.parse_review(raw_review("r2", "FIVE", 30, comment=""))
        self.assertEqual("template", bot.generate_reply(review, lambda s, u: GOOD_REPLY)[1])

    def test_anonymous_reviewer_gets_no_name(self) -> None:
        self.assertEqual("", bot.first_name("A Google User"))
        self.assertEqual("Jane", bot.first_name("Jane Doe"))


class RunTests(unittest.TestCase):
    def test_preview_mode_never_posts(self) -> None:
        client = FakeClient([raw_review("due", "FIVE", 30)])
        lines = bot.run(client, "1", "2", lambda s, u: GOOD_REPLY, post=False, now=NOW)
        self.assertEqual([], client.posted)
        self.assertTrue(any(line.startswith("PREVIEW") for line in lines))

    def test_post_mode_posts_and_caps_replies(self) -> None:
        client = FakeClient([raw_review(f"r{index}", "FIVE", 30 + index) for index in range(5)])
        bot.run(client, "1", "2", lambda s, u: GOOD_REPLY, post=True, now=NOW, max_replies=2,
                notify=lambda review: False)
        self.assertEqual(2, len(client.posted))

    def test_manual_reviews_notify_only_when_posting(self) -> None:
        notified: list[str] = []
        client = FakeClient([raw_review("bad", "ONE", 30)])
        bot.run(client, "1", "2", None, post=False, now=NOW, notify=lambda r: notified.append(r.review_id) or True)
        self.assertEqual([], notified)
        bot.run(client, "1", "2", None, post=True, now=NOW, notify=lambda r: notified.append(r.review_id) or True)
        self.assertEqual(["bad"], notified)


class ParsingTests(unittest.TestCase):
    def test_parses_nanosecond_timestamps(self) -> None:
        parsed = bot.parse_time("2026-09-10T17:20:11.123456789Z")
        self.assertEqual(dt.datetime(2026, 9, 10, 17, 20, 11, 123456, tzinfo=dt.timezone.utc), parsed)

    def test_parses_timestamps_without_fraction(self) -> None:
        self.assertEqual(2026, bot.parse_time("2026-09-10T17:20:11Z").year)


if __name__ == "__main__":
    unittest.main()
