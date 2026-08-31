import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "analyze_kakao_profiles.py"


def build_archive(path: Path, users, messages):
    connection = sqlite3.connect(path)
    connection.executescript("""
        CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT, message_count INTEGER, is_system INTEGER DEFAULT 0);
        CREATE TABLE messages (id INTEGER PRIMARY KEY, user_id INTEGER, date TEXT, time TEXT, body TEXT, is_system INTEGER DEFAULT 0);
        CREATE TABLE links (id INTEGER PRIMARY KEY, message_id INTEGER);
        CREATE TABLE attachments (id INTEGER PRIMARY KEY, message_id INTEGER);
    """)
    connection.executemany("INSERT INTO users(id, display_name, message_count, is_system) VALUES (?, ?, ?, ?)", users)
    connection.executemany("INSERT INTO messages(id, user_id, date, time, body, is_system) VALUES (?, ?, ?, ?, ?, ?)", messages)
    connection.commit()
    connection.close()


class AnalyzeKakaoProfilesTest(unittest.TestCase):
    def run_analysis(self, database: Path, output: Path, aliases: Path | None = None):
        command = [sys.executable, str(SCRIPT), "--db", str(database), "--output", str(output), "--all-participants"]
        if aliases:
            command.extend(["--aliases", str(aliases)])
        env = {**os.environ, "AVATAR_HASH_KEY": "fixture-only-secret"}
        return subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, check=False)

    def test_discovers_every_talking_human_without_exporting_bodies_or_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); database = root / "archive.sqlite3"; output = root / "profiles.json"
            users = [(1, "Alice", 6, 0), (2, "Bob", 1, 0), (3, "System", 2, 1), (4, "Silent", 0, 0)]
            messages = [
                (index, 1, "2025-01-01", f"2{index}:00", "React test? ㅋㅋ", 0) for index in range(1, 7)
            ] + [(7, 2, "2025-01-02", "10:00", "안녕하세요", 0), (8, 3, "2025-01-02", "10:01", "system body", 1)]
            build_archive(database, users, messages)
            first = self.run_analysis(database, output)
            self.assertEqual(first.returncode, 0, first.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["source_user_count"], 2)
            self.assertEqual({profile["name"] for profile in payload["profiles"]}, {"Alice", "Bob"})
            bob = next(profile for profile in payload["profiles"] if profile["name"] == "Bob")
            self.assertEqual(bob["adjective_candidates"], [])
            self.assertEqual(bob["noun_candidates"], [])
            self.assertNotIn("React test?", output.read_text(encoding="utf-8"))
            self.assertNotIn("user_id", json.dumps(payload["profiles"]))
            digest = payload["profiles"][0]["conversation_digest"]
            second = self.run_analysis(database, output)
            self.assertEqual(second.returncode, 0)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["profiles"][0]["conversation_digest"], digest)

    def test_keeps_nicknames_made_only_of_punctuation_or_korean_jamo(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); database = root / "archive.sqlite3"; output = root / "profiles.json"
            users = [(9, ".", 1, 0), (10, "ㅈ.ㅅ.ㄱ.", 1, 0)]
            messages = [(1, 9, "2025-01-01", "10:00", "one", 0), (2, 10, "2025-01-01", "11:00", "two", 0)]
            build_archive(database, users, messages)

            result = self.run_analysis(database, output)

            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["source_user_count"], 2)
            self.assertEqual(len(payload["profiles"]), 2)
            self.assertEqual(sum(profile["source_row_count"] for profile in payload["profiles"]), 2)
            self.assertEqual({profile["name"] for profile in payload["profiles"]}, {".", "ㅈ.ㅅ.ㄱ."})

    def test_requires_explicit_source_ids_before_same_key_rows_are_merged_or_split(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); database = root / "archive.sqlite3"; output = root / "profiles.json"
            users = [(11, "Dup", 1, 0), (12, "Ｄｕｐ", 1, 0)]
            messages = [(1, 11, "2025-01-01", "10:00", "one", 0), (2, 12, "2025-01-01", "11:00", "two", 0)]
            build_archive(database, users, messages)
            unresolved = self.run_analysis(database, output)
            self.assertEqual(unresolved.returncode, 2)
            review = json.loads(output.read_text(encoding="utf-8"))["merge_review"]
            self.assertEqual({row["user_id"] for row in review[0]["source_users"]}, {11, 12})

            aliases = root / "aliases.json"
            aliases.write_text(json.dumps({
                "schema_version": "kakao-participant-aliases-v2",
                "profiles": [
                    {"join_nickname": "Dup A", "aliases": [], "source_user_ids": [11]},
                    {"join_nickname": "Dup B", "aliases": [], "source_user_ids": [12]},
                ],
            }), encoding="utf-8")
            resolved = self.run_analysis(database, output, aliases)
            self.assertEqual(resolved.returncode, 0, resolved.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["merge_review"], [])
            self.assertEqual({profile["name"] for profile in payload["profiles"]}, {"Dup A", "Dup B"})
            self.assertEqual(sum(profile["source_row_count"] for profile in payload["profiles"]), 2)

    def test_allows_operator_approved_case_only_aliases_in_one_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); database = root / "archive.sqlite3"; output = root / "profiles.json"
            users = [(21, "Case/React", 1, 0), (22, "Case/react", 1, 0)]
            messages = [(1, 21, "2025-01-01", "10:00", "one", 0), (2, 22, "2025-01-01", "11:00", "two", 0)]
            build_archive(database, users, messages)
            aliases = root / "aliases.json"
            aliases.write_text(json.dumps({
                "schema_version": "kakao-participant-aliases-v2",
                "profiles": [{
                    "join_nickname": "Case/React",
                    "aliases": ["Case/react"],
                    "source_user_ids": [21, 22],
                }],
            }), encoding="utf-8")

            resolved = self.run_analysis(database, output, aliases)

            self.assertEqual(resolved.returncode, 0, resolved.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["merge_review"], [])
            self.assertEqual(len(payload["profiles"]), 1)
            self.assertEqual(payload["profiles"][0]["name"], "Case/React")
            self.assertEqual(payload["profiles"][0]["source_row_count"], 2)


if __name__ == "__main__":
    unittest.main()
