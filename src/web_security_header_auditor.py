import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests


SECURITY_HEADERS = {
    "content-security-policy": {
        "name": "Content-Security-Policy",
        "points": 20,
        "note": "Helps reduce cross-site scripting and content injection risk.",
    },
    "strict-transport-security": {
        "name": "Strict-Transport-Security",
        "points": 15,
        "note": "Helps enforce HTTPS usage after the first trusted visit.",
    },
    "x-frame-options": {
        "name": "X-Frame-Options",
        "points": 10,
        "note": "Helps reduce clickjacking risk.",
    },
    "x-content-type-options": {
        "name": "X-Content-Type-Options",
        "points": 10,
        "note": "Helps prevent MIME type sniffing.",
    },
    "referrer-policy": {
        "name": "Referrer-Policy",
        "points": 10,
        "note": "Controls how much referrer information is shared.",
    },
    "permissions-policy": {
        "name": "Permissions-Policy",
        "points": 10,
        "note": "Restricts browser features available to the page.",
    },
}


@dataclass
class HeaderFinding:
    header: str
    present: bool
    value: str | None
    points: int
    note: str


@dataclass
class CookieFinding:
    cookie_name: str
    secure: bool
    httponly: bool
    samesite: bool
    raw_value: str


@dataclass
class AuditResult:
    url: str
    final_url: str
    status_code: int
    checked_at_utc: str
    uses_https: bool
    score: int
    max_score: int
    priority: str
    header_findings: list[HeaderFinding]
    cookie_findings: list[CookieFinding]
    safety_note: str


def normalize_url(url: str) -> str:
    parsed = urlparse(url)

    if not parsed.scheme:
        return f"https://{url}"

    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https URLs are supported.")

    return url


def get_priority(score: int) -> str:
    if score >= 80:
        return "Strong header posture"
    if score >= 50:
        return "Needs review"
    return "High review priority"


def parse_cookies(headers: requests.structures.CaseInsensitiveDict) -> list[CookieFinding]:
    raw_cookie_headers = []

    if "set-cookie" in headers:
        raw_cookie_headers.append(headers["set-cookie"])

    findings: list[CookieFinding] = []

    for raw_cookie in raw_cookie_headers:
        cookie_parts = [part.strip() for part in raw_cookie.split(";")]
        cookie_name = cookie_parts[0].split("=", 1)[0] if cookie_parts else "unknown"
        lower_parts = [part.lower() for part in cookie_parts]

        findings.append(
            CookieFinding(
                cookie_name=cookie_name,
                secure="secure" in lower_parts,
                httponly="httponly" in lower_parts,
                samesite=any(part.startswith("samesite=") for part in lower_parts),
                raw_value=raw_cookie,
            )
        )

    return findings


def audit_url(url: str, timeout: int) -> AuditResult:
    normalized_url = normalize_url(url)

    response = requests.get(
        normalized_url,
        timeout=timeout,
        allow_redirects=True,
        headers={"User-Agent": "Web-Security-Header-Auditor/1.0"},
    )

    lower_headers = {key.lower(): value for key, value in response.headers.items()}
    findings: list[HeaderFinding] = []
    score = 0

    for header_key, metadata in SECURITY_HEADERS.items():
        value = lower_headers.get(header_key)
        present = value is not None
        points = metadata["points"] if present else 0
        score += points

        findings.append(
            HeaderFinding(
                header=metadata["name"],
                present=present,
                value=value,
                points=points,
                note=metadata["note"],
            )
        )

    uses_https = urlparse(response.url).scheme == "https"
    https_points = 25 if uses_https else 0
    score += https_points
    max_score = sum(item["points"] for item in SECURITY_HEADERS.values()) + 25

    return AuditResult(
        url=normalized_url,
        final_url=response.url,
        status_code=response.status_code,
        checked_at_utc=datetime.now(timezone.utc).isoformat(),
        uses_https=uses_https,
        score=score,
        max_score=max_score,
        priority=get_priority(score),
        header_findings=findings,
        cookie_findings=parse_cookies(response.headers),
        safety_note=(
            "This tool performs passive HTTP response review only. "
            "It does not exploit, fuzz, brute force, or send attack payloads."
        ),
    )


def build_review_notes(result: AuditResult) -> list[str]:
    notes: list[str] = []

    if not result.uses_https:
        notes.append(
            "HTTPS is not used; review whether the site should enforce encrypted transport."
        )

    for finding in result.header_findings:
        if finding.present:
            continue

        if finding.header == "Content-Security-Policy":
            notes.append(
                "Content-Security-Policy is missing; review whether CSP should be configured to reduce script injection risk."
            )
        elif finding.header == "Strict-Transport-Security":
            notes.append(
                "Strict-Transport-Security is missing; review whether HTTPS should be enforced with HSTS."
            )
        elif finding.header == "X-Frame-Options":
            notes.append(
                "X-Frame-Options is missing; review whether clickjacking protection is required."
            )
        elif finding.header == "X-Content-Type-Options":
            notes.append(
                "X-Content-Type-Options is missing; review whether MIME sniffing protection should be enabled."
            )
        elif finding.header == "Referrer-Policy":
            notes.append(
                "Referrer-Policy is missing; review whether referrer data should be limited."
            )
        elif finding.header == "Permissions-Policy":
            notes.append(
                "Permissions-Policy is missing; review whether browser feature access should be restricted."
            )

    for cookie in result.cookie_findings:
        if not cookie.secure:
            notes.append(
                f"Cookie '{cookie.cookie_name}' is missing Secure; review whether it should only be sent over HTTPS."
            )
        if not cookie.httponly:
            notes.append(
                f"Cookie '{cookie.cookie_name}' is missing HttpOnly; review whether client-side script access should be blocked."
            )
        if not cookie.samesite:
            notes.append(
                f"Cookie '{cookie.cookie_name}' is missing SameSite; review whether cross-site cookie behavior should be restricted."
            )

    if not notes:
        notes.append("No immediate header or cookie review notes were generated.")

    return notes

def build_text_report(result: AuditResult) -> str:
    lines: list[str] = []

    lines.append("Web Security Header Audit Report")
    lines.append("===============================")
    lines.append("")
    lines.append(f"URL: {result.url}")
    lines.append(f"Final URL: {result.final_url}")
    lines.append(f"Status Code: {result.status_code}")
    lines.append(f"Checked At UTC: {result.checked_at_utc}")
    lines.append(f"Uses HTTPS: {result.uses_https}")
    lines.append(f"Score: {result.score} / {result.max_score}")
    lines.append(f"Review Priority: {result.priority}")

    lines.append("")
    lines.append("Security Header Findings")
    lines.append("------------------------")

    for finding in result.header_findings:
        status = "Present" if finding.present else "Missing"
        lines.append(f"- {finding.header}: {status} ({finding.points} points)")
        if finding.value:
            lines.append(f"  Value: {finding.value}")
        lines.append(f"  Note: {finding.note}")

    lines.append("")
    lines.append("Review Notes")
    lines.append("------------")

    for note in build_review_notes(result):
        lines.append(f"- {note}")

    lines.append("")
    lines.append("Cookie Findings")
    lines.append("---------------")

    if not result.cookie_findings:
        lines.append("No Set-Cookie header observed.")
    else:
        for cookie in result.cookie_findings:
            lines.append(f"- {cookie.cookie_name}")
            lines.append(f"  Secure: {cookie.secure}")
            lines.append(f"  HttpOnly: {cookie.httponly}")
            lines.append(f"  SameSite: {cookie.samesite}")

    lines.append("")
    lines.append("Safety Note")
    lines.append("-----------")
    lines.append(result.safety_note)

    return "\n".join(lines)


def save_json_report(result: AuditResult, output_path: Path) -> None:
    payload = asdict(result)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def save_text_report(result: AuditResult, output_path: Path) -> None:
    output_path.write_text(build_text_report(result), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Passive web security header auditor for authorized URLs."
    )
    parser.add_argument("--url", required=True, help="URL to review.")
    parser.add_argument("--timeout", type=int, default=10, help="Request timeout in seconds.")
    parser.add_argument("--json-out", help="Optional JSON report output path.")
    parser.add_argument("--text-out", help="Optional text report output path.")

    args = parser.parse_args()

    result = audit_url(args.url, args.timeout)
    print(build_text_report(result))

    if args.json_out:
        save_json_report(result, Path(args.json_out))

    if args.text_out:
        save_text_report(result, Path(args.text_out))


if __name__ == "__main__":
    main()
