#!/usr/bin/env python3
"""Create privacy-conscious conversation profiles inside the Kakao archive LXC.

Message bodies are streamed from a read-only SQLite connection and never placed
in the output. Ambiguous source users remain in the local merge_review list until
an operator-approved, server-private alias rule resolves them.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import hmac
import json
import math
import os
import re
import sqlite3
import statistics
import unicodedata
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable


SCHEMA_VERSION = "kakao-profile-analysis-v1"
MIN_TRAIT_MESSAGES = 5
SIGNAL_LABELS = {
    "volume": "수다스러운", "consistency": "꾸준한", "night": "야행성",
    "story": "서사적인", "curiosity": "호기심 많은", "cheer": "유쾌한",
    "links": "탐색하는", "attachments": "나눠 주는", "code": "코드에 진심인",
}
TOPIC_PATTERNS = {
    "frontend": re.compile(r"(?i)(?<![a-z])(css|html|react|vue|svelte|javascript|typescript|js|ts)(?![a-z])|프론트|브라우저"),
    "backend": re.compile(r"(?i)(?<![a-z])(api|backend|database|sql|db)(?![a-z])|백엔드|서버"),
    "infra": re.compile(r"(?i)(?<![a-z])(docker|kubernetes|k8s|aws|nginx|cloudflare)(?![a-z])|배포|인프라|컨테이너"),
    "quality": re.compile(r"(?i)(?<![a-z])(test|bug|error|debug)(?![a-z])|테스트|버그|에러|디버깅"),
    "design": re.compile(r"(?i)(?<![a-z])(figma|ux|ui)(?![a-z])|피그마|디자인|인터페이스"),
    "tools": re.compile(r"(?i)(?<![a-z])(git|github|vscode|ide|cli)(?![a-z])|깃허브|터미널|커밋"),
}
TOPIC_NOUNS = {
    "frontend": ("마법사", "픽셀 조각가", "브라우저 조련사"),
    "backend": ("연금술사", "서버 수호자", "API 항해사"),
    "infra": ("배포 항해사", "컨테이너 조련사", "인프라 수호자"),
    "quality": ("버그 사냥꾼", "타입 수호자", "테스트 감별사"),
    "design": ("인터페이스 조각가", "픽셀 설계자", "레이아웃 건축가"),
    "tools": ("커밋 기록관", "터미널 소환사", "도구 수집가"),
}


@dataclass(frozen=True)
class Participant:
    name: str
    user_ids: tuple[int, ...]
    aliases: tuple[str, ...]


@dataclass(frozen=True)
class AliasRule:
    name: str
    aliases: tuple[str, ...]
    source_user_ids: tuple[int, ...]


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value or "")).strip()


def normalize_display_name(value: str | None) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value or "")).strip()


def nickname_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    compact = re.sub(r"[^0-9a-z가-힣]", "", normalized)
    return compact or normalize_text(normalized)


def nickname_stem(value: str) -> str:
    return nickname_key(value.split("/", 1)[0])


def parse_date(value: str | None) -> date | None:
    text = normalize_text(value)
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        match = re.search(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})", text)
        if not match:
            return None
        try:
            return date(*(int(part) for part in match.groups()))
        except ValueError:
            return None


def parse_hour(value: str | None) -> int | None:
    text = normalize_text(value)
    match = re.search(r"(\d{1,2}):(\d{2})", text)
    if not match:
        return None
    hour = int(match.group(1))
    if "오후" in text and hour < 12:
        hour += 12
    elif "오전" in text and hour == 12:
        hour = 0
    return hour if 0 <= hour <= 23 else None


def safe_ratio(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def percentile(values: list[float], value: float) -> float:
    if len(values) < 2:
        return 0.5
    lower = sum(candidate < value for candidate in values)
    equal = sum(candidate == value for candidate in values)
    return round((lower + (equal - 1) / 2) / (len(values) - 1), 4)


def percentile_value(values: list[int], fraction: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(len(ordered) * fraction) - 1))
    return ordered[index]


def load_alias_rules(path: Path | None) -> list[AliasRule]:
    if path is None:
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schema_version") == "kakao-participant-aliases-v2":
        entries = raw.get("profiles")
        if not isinstance(entries, list):
            raise ValueError("profiles must be an array")
        rules = []
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError("profile rule must be an object")
            name = entry.get("join_nickname")
            aliases = entry.get("aliases", [])
            user_ids = entry.get("source_user_ids", [])
            if not isinstance(name, str) or not name.strip():
                raise ValueError("join_nickname must be a non-empty string")
            if not isinstance(aliases, list) or not all(isinstance(value, str) and value.strip() for value in aliases):
                raise ValueError(f"Invalid aliases for {name}")
            if not isinstance(user_ids, list) or not all(isinstance(value, int) and value > 0 for value in user_ids):
                raise ValueError(f"Invalid source_user_ids for {name}")
            rules.append(AliasRule(name, tuple(dict.fromkeys((name, *aliases))), tuple(dict.fromkeys(user_ids))))
        return rules
    if not isinstance(raw, dict):
        raise ValueError("Alias configuration must be an object")
    rules = []
    for name, aliases in raw.items():
        if not isinstance(name, str) or not isinstance(aliases, list) or not aliases:
            raise ValueError("Legacy alias entries must contain a name and aliases")
        rules.append(AliasRule(name, tuple(dict.fromkeys((name, *aliases))), ()))
    return rules


def discover_participants(connection: sqlite3.Connection, rules: list[AliasRule]):
    rows = connection.execute("""
        SELECT id, display_name, message_count FROM users
        WHERE coalesce(is_system, 0)=0 AND coalesce(message_count, 0)>0
        ORDER BY id
    """).fetchall()
    eligible = [(int(user_id), normalize_display_name(name), int(count)) for user_id, name, count in rows]
    by_id = {row[0]: row for row in eligible}
    by_name: dict[str, list[tuple[int, str, int]]] = {}
    for row in eligible:
        by_name.setdefault(row[1], []).append(row)

    participants: list[Participant] = []
    unmatched: list[str] = []
    claimed: set[int] = set()
    approved_keys: set[str] = set()
    approved_key_rows: dict[str, list[tuple[int, str, int]]] = {}
    for rule in rules:
        if rule.source_user_ids:
            matched = [by_id[user_id] for user_id in rule.source_user_ids if user_id in by_id]
            if len(matched) != len(rule.source_user_ids):
                unmatched.append(rule.name)
                continue
        else:
            matched = [row for alias in rule.aliases for row in by_name.get(normalize_display_name(alias), [])]
        ids = tuple(dict.fromkeys(row[0] for row in matched))
        if not ids:
            unmatched.append(rule.name)
            continue
        if len(ids) > 1:
            approved_aliases = {normalize_display_name(alias) for alias in rule.aliases}
            missing_aliases = sorted({row[1] for row in matched if row[1] not in approved_aliases})
            if missing_aliases:
                raise ValueError(
                    f"Merged profile {rule.name} must list every source display name in aliases: {missing_aliases}"
                )
        overlap = claimed.intersection(ids)
        if overlap:
            raise ValueError(f"source_user_ids used by more than one profile: {sorted(overlap)}")
        rule_keys: dict[str, str] = {}
        for alias in rule.aliases:
            key = nickname_key(alias)
            if not key:
                raise ValueError(f"Alias normalization collision: {alias}")
            rule_keys.setdefault(key, alias)
        for key, alias in rule_keys.items():
            if key in approved_keys:
                raise ValueError(f"Alias normalization collision: {alias}")
            approved_keys.add(key)
            approved_key_rows[key] = list(matched)
        claimed.update(ids)
        participants.append(Participant(rule.name, ids, rule.aliases))

    groups: dict[str, list[tuple[int, str, int]]] = {}
    for row in eligible:
        if row[0] in claimed:
            continue
        key = nickname_key(row[1])
        if key:
            groups.setdefault(key, []).append(row)

    merge_review: list[dict[str, object]] = []
    for key, group in sorted(groups.items()):
        if len(group) > 1 or key in approved_keys:
            review_rows = list({row[0]: row for row in [*approved_key_rows.get(key, []), *group]}.values())
            merge_review.append({
                "nickname_key": key,
                "source_users": [
                    {"user_id": user_id, "display_name": name, "message_count": count}
                    for user_id, name, count in review_rows
                ],
            })
        else:
            user_id, name, _ = group[0]
            participants.append(Participant(name, (user_id,), (name,)))
    return participants, unmatched, len(eligible), merge_review


def suggest_aliases(connection: sqlite3.Connection, names: Iterable[str], limit: int = 5):
    candidates = connection.execute(
        "SELECT display_name, message_count FROM users WHERE coalesce(is_system, 0)=0"
    ).fetchall()
    result = {}
    for target in names:
        target_key = nickname_key(target)
        scored = []
        for name, count in candidates:
            similarity = max(
                difflib.SequenceMatcher(None, target_key, nickname_key(name)).ratio(),
                difflib.SequenceMatcher(None, target_key, nickname_stem(name)).ratio(),
            )
            scored.append({"candidate": name, "messages": int(count), "similarity": round(similarity, 3)})
        result[target] = sorted(scored, key=lambda item: (-item["similarity"], -item["messages"]))[:limit]
    return result


def related_count(connection: sqlite3.Connection, table: str, user_ids: tuple[int, ...]) -> int:
    placeholders = ",".join("?" for _ in user_ids)
    return connection.execute(
        f"SELECT count(*) FROM {table} item JOIN messages message ON message.id=item.message_id WHERE message.user_id IN ({placeholders})",
        user_ids,
    ).fetchone()[0]


def analyze_user(connection: sqlite3.Connection, participant: Participant, hash_key: bytes):
    daily: Counter[str] = Counter()
    hourly: Counter[int] = Counter()
    weekdays: Counter[int] = Counter()
    topics: Counter[str] = Counter()
    lengths: list[int] = []
    questions = laughter = code_messages = total_chars = 0
    digest = hmac.new(hash_key, digestmod=hashlib.sha256)
    placeholders = ",".join("?" for _ in participant.user_ids)
    cursor = connection.execute(f"""
        SELECT id, date, time, body FROM messages
        WHERE user_id IN ({placeholders}) AND coalesce(is_system, 0)=0
        ORDER BY date, time, id
    """, participant.user_ids)
    for message_id, raw_date, raw_time, raw_body in cursor:
        body = normalize_text(raw_body)
        lengths.append(len(body))
        total_chars += len(body)
        questions += int("?" in body or "？" in body)
        laughter += int(bool(re.search(r"ㅋ{2,}|ㅎ{2,}|하하|헤헤", body)))
        code_messages += int(bool(re.search(r"```|`[^`]+`|(?i:(?<![a-z])(npm|pnpm|yarn|const|function|class|interface)(?![a-z]))", body)))
        for topic, pattern in TOPIC_PATTERNS.items():
            topics[topic] += len(pattern.findall(body))
        parsed_date = parse_date(raw_date)
        if parsed_date:
            daily[parsed_date.isoformat()] += 1
            weekdays[parsed_date.weekday()] += 1
        hour = parse_hour(raw_time)
        if hour is not None:
            hourly[hour] += 1
        canonical = "\0".join((str(message_id), normalize_text(raw_date), normalize_text(raw_time), body))
        digest.update(canonical.encode("utf-8")); digest.update(b"\n")

    messages = len(lengths)
    first_day, last_day = (min(daily), max(daily)) if daily else (None, None)
    span_days = (date.fromisoformat(last_day) - date.fromisoformat(first_day)).days + 1 if first_day and last_day else 0
    links = related_count(connection, "links", participant.user_ids)
    attachments = related_count(connection, "attachments", participant.user_ids)
    return {
        "name": participant.name,
        "source_aliases": list(participant.aliases),
        "source_row_count": len(participant.user_ids),
        "metrics": {
            "messages": messages, "active_days": len(daily), "span_days": span_days,
            "messages_per_active_day": round(safe_ratio(messages, len(daily)), 2),
            "top_day_share": round(safe_ratio(max(daily.values(), default=0), messages), 4),
            "avg_chars": round(statistics.fmean(lengths), 2), "median_chars": round(statistics.median(lengths), 2),
            "p90_chars": percentile_value(lengths, .9), "question_pct": round(100 * safe_ratio(questions, messages), 2),
            "laughter_pct": round(100 * safe_ratio(laughter, messages), 2), "code_pct": round(100 * safe_ratio(code_messages, messages), 2),
            "night_pct": round(100 * safe_ratio(sum(count for hour, count in hourly.items() if hour < 6), sum(hourly.values())), 2),
            "weekend_pct": round(100 * safe_ratio(sum(count for weekday, count in weekdays.items() if weekday >= 5), sum(weekdays.values())), 2),
            "top_hour": hourly.most_common(1)[0][0] if hourly else None,
            "links": links, "attachments": attachments,
            "links_per_100": round(100 * safe_ratio(links, messages), 2),
            "attachments_per_100": round(100 * safe_ratio(attachments, messages), 2),
            "first_date": first_day, "last_date": last_day,
        },
        "topic_rates_per_10k_chars": {topic: round(10000 * safe_ratio(topics[topic], total_chars), 3) for topic in sorted(TOPIC_PATTERNS)},
        "conversation_digest": digest.hexdigest(),
    }


def add_relative_signals(profiles: list[dict[str, object]]) -> None:
    def metric(profile, key):
        return float(profile["metrics"][key])
    raw = {
        "volume": [math.log1p(metric(profile, "messages")) for profile in profiles],
        "consistency": [safe_ratio(metric(profile, "active_days"), metric(profile, "span_days")) * (1 - metric(profile, "top_day_share")) for profile in profiles],
        "night": [metric(profile, "night_pct") for profile in profiles],
        "story": [metric(profile, "avg_chars") for profile in profiles],
        "curiosity": [metric(profile, "question_pct") for profile in profiles],
        "cheer": [metric(profile, "laughter_pct") for profile in profiles],
        "links": [metric(profile, "links_per_100") for profile in profiles],
        "attachments": [metric(profile, "attachments_per_100") for profile in profiles],
        "code": [metric(profile, "code_pct") for profile in profiles],
    }
    for index, profile in enumerate(profiles):
        signals = {name: percentile(values, values[index]) for name, values in raw.items()}
        profile["signals"] = signals
        if metric(profile, "messages") < MIN_TRAIT_MESSAGES:
            profile["adjective_candidates"] = []
            profile["noun_candidates"] = []
            continue
        profile["adjective_candidates"] = [SIGNAL_LABELS[name] for name in sorted(signals, key=lambda name: (-signals[name], name))[:3]]
        rates = profile["topic_rates_per_10k_chars"]
        nouns: list[str] = []
        for topic in sorted(rates, key=lambda name: (-rates[name], name)):
            if rates[topic] <= 0:
                continue
            nouns.extend(TOPIC_NOUNS[topic])
        profile["noun_candidates"] = list(dict.fromkeys(nouns))[:6]


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--aliases", type=Path)
    parser.add_argument("--all-participants", action="store_true", required=True)
    parser.add_argument("--hash-key-env", default="AVATAR_HASH_KEY")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    hash_key_value = os.environ.get(args.hash_key_env)
    if not hash_key_value:
        raise SystemExit(f"{args.hash_key_env} must be set on the archive server")
    connection = sqlite3.connect(f"file:{args.db.resolve().as_posix()}?mode=ro", uri=True)
    try:
        participants, unmatched, source_user_count, merge_review = discover_participants(connection, load_alias_rules(args.aliases))
        profiles = [analyze_user(connection, participant, hash_key_value.encode("utf-8")) for participant in participants]
        add_relative_signals(profiles)
        suggestions = suggest_aliases(connection, unmatched)
    finally:
        connection.close()
    result = {
        "schema_version": SCHEMA_VERSION,
        "privacy": {"contains_message_bodies": False, "conversation_digest": "hmac-sha256"},
        "selection": "all-non-system-message-authors",
        "source_user_count": source_user_count,
        "matched_count": len(profiles),
        "unmatched": unmatched,
        "alias_suggestions": suggestions,
        "merge_review": merge_review,
        "profiles": profiles,
    }
    payload = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload, end="")
    return 2 if unmatched or merge_review else 0


if __name__ == "__main__":
    raise SystemExit(main())
