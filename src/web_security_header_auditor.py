import argparse
import csv
import json
from collections import Counter
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
    grade: str
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

def validate_timeout(timeout: int) -> int:
    if timeout <= 0:
        raise ValueError("Timeout must be greater than zero.")

    return timeout


def get_priority(score: int) -> str:
    if score >= 80:
        return "Strong header posture"
    if score >= 50:
        return "Needs review"
    return "High review priority"

def get_grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 70:
        return "B"
    if score >= 50:
        return "C"
    if score >= 25:
        return "D"
    return "F"


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

    try:
        response = requests.get(
            normalized_url,
            timeout=timeout,
            allow_redirects=True,
            headers={"User-Agent": "Web-Security-Header-Auditor/1.0"},
        )
    except requests.RequestException as error:
        raise RuntimeError(
            f"Request failed for {normalized_url}. Reason: {error}"
        ) from error

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
        grade=get_grade(score),
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

    for finding in result.header_findings:
        if not finding.present or not finding.value:
            continue

        normalized_value = finding.value.lower().replace(" ", "")

        if (
            finding.header == "Strict-Transport-Security"
            and "max-age=0" in normalized_value
        ):
            notes.append(
                "Strict-Transport-Security has max-age=0; review whether HSTS is intentionally disabled."
            )
        if (
            finding.header == "Content-Security-Policy"
            and "'unsafe-inline'" in normalized_value
        ):
            notes.append(
                "Content-Security-Policy allows unsafe-inline; review whether inline script or style usage can be reduced."
            )
        if (
            finding.header == "Content-Security-Policy"
            and "'unsafe-eval'" in normalized_value
        ):
            notes.append(
                "Content-Security-Policy allows unsafe-eval; review whether dynamic code evaluation can be avoided."
            )

        if finding.header == "X-Frame-Options":
            normalized_frame_option = finding.value.strip().upper()

            if normalized_frame_option not in {"DENY", "SAMEORIGIN"}:
                notes.append(
                    "X-Frame-Options has an uncommon value; review whether clickjacking protection is configured as intended."
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
    review_notes = build_review_notes(result)

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
    lines.append(f"Review Grade: {result.grade}")
    lines.append(f"Review Notes Count: {len(review_notes)}")

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

    for note in review_notes:
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
    review_notes = build_review_notes(result)
    payload["review_notes"] = review_notes
    payload["review_notes_count"] = len(review_notes)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

def save_batch_json_report(
    results: list[AuditResult],
    failures: list[tuple[str, str]],
    total_urls: int,
    output_path: Path,
) -> None:
    payload = {
        "mode": "batch",
        "total_urls": total_urls,
        "successful_audits": len(results),
        "failed_audits": len(failures),
        "average_score": get_average_score(results),
        "review_recommendation": get_batch_review_recommendation(results, failures),
        "grade_distribution": get_grade_distribution(results),
        "priority_distribution": get_priority_distribution(results),
        "highest_score": summarize_score_result(
            max(results, key=lambda result: result.score, default=None)
        ),
        "lowest_score": summarize_score_result(
            min(results, key=lambda result: result.score, default=None)
        ),
        "results": [
            {
                **asdict(result),
                "review_notes": build_review_notes(result),
            }
            for result in results
        ],
        "failures": [
            {
                "url": url,
                "error": error_message,
            }
            for url, error_message in failures
        ],
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def save_text_report(result: AuditResult, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(build_text_report(result), encoding="utf-8")

def save_batch_text_report(
    results: list[AuditResult],
    failures: list[tuple[str, str]],
    total_urls: int,
    output_path: Path,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        build_batch_text_report(results, failures, total_urls),
        encoding="utf-8",
    )

def get_header_names_by_status(result: AuditResult, present: bool) -> str:
    return "; ".join(
        finding.header
        for finding in result.header_findings
        if finding.present is present
    )


def save_csv_report(results: list[AuditResult], output_path: Path) -> None:
    fieldnames = [
        "url",
        "final_url",
        "status_code",
        "uses_https",
        "score",
        "max_score",
        "grade",
        "priority",
        "present_header_count",
        "missing_header_count",
        "cookie_count",
        "review_note_count",
        "present_headers",
        "missing_headers",
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()

        for result in sorted(results, key=lambda item: item.score):
            writer.writerow(
                {
                    "url": result.url,
                    "final_url": result.final_url,
                    "status_code": result.status_code,
                    "uses_https": result.uses_https,
                    "score": result.score,
                    "max_score": result.max_score,
                    "grade": result.grade,
                    "priority": result.priority,
                    "priority": result.priority,
                    "present_header_count": len(
                        [finding for finding in result.header_findings if finding.present]
                    ),
                    "missing_header_count": len(
                        [finding for finding in result.header_findings if not finding.present]
                    ),
                    "cookie_count": len(result.cookie_findings),
                    "review_note_count": len(build_review_notes(result)),
                    "present_headers": get_header_names_by_status(result, True),
                    "missing_headers": get_header_names_by_status(result, False),
                }
            )

def load_urls_file(urls_path: Path) -> list[str]:
    urls: list[str] = []

    for line in urls_path.read_text(encoding="utf-8").splitlines():
        stripped_line = line.strip().lstrip("\ufeff")

        if not stripped_line or stripped_line.startswith("#"):
            continue

        urls.append(stripped_line)

    return urls

def get_grade_distribution(results: list[AuditResult]) -> dict[str, int]:
    return dict(sorted(Counter(result.grade for result in results).items()))

def get_priority_distribution(results: list[AuditResult]) -> dict[str, int]:
    priority_counts = Counter(result.priority for result in results)
    return dict(sorted(priority_counts.items()))

def get_average_score(results: list[AuditResult]) -> float | None:
    if not results:
        return None

    return round(
        sum(result.score for result in results) / len(results),
        2,
    )

def get_batch_review_recommendation(results: list[AuditResult], failures: list[tuple[str, str]]) -> str:
    if failures and not results:
        return "Review failed URLs first because no successful audits were completed."

    if failures:
        return "Review failed URLs separately, then start with the lowest score and high priority URLs."

    if not results:
        return "No successful audits were completed."

    return "Start with the lowest score and high priority URLs first."

def summarize_score_result(result: AuditResult | None) -> dict[str, str | int] | None:
    if result is None:
        return None

    return {
        "url": result.final_url,
        "score": result.score,
        "max_score": result.max_score,
        "grade": result.grade,
        "priority": result.priority,
    }

def build_batch_summary(
    results: list[AuditResult],
    failures: list[tuple[str, str]],
    total_urls: int,
) -> str:
    lines: list[str] = []

    lines.append("Batch Summary")
    lines.append("-------------")
    lines.append(f"Total URLs: {total_urls}")
    lines.append(f"Successful Audits: {len(results)}")
    lines.append(f"Failed Audits: {len(failures)}")
    average_score = get_average_score(results)

    if average_score is None:
        lines.append("Average Score: None")
    else:
        lines.append(f"Average Score: {average_score:.2f} / 100")

    lines.append(
        f"Review Recommendation: {get_batch_review_recommendation(results, failures)}"
    )

    grade_counts = get_grade_distribution(results)
    grade_distribution = ", ".join(
        f"{grade}: {count}" for grade, count in grade_counts.items()
    )

    priority_distribution = ", ".join(
        f"{priority}: {count}"
        for priority, count in get_priority_distribution(results).items()
    )

    if priority_distribution:
        lines.append(f"Priority Distribution: {priority_distribution}")
    else:
        lines.append("Priority Distribution: None")

    if grade_distribution:
        lines.append(f"Grade Distribution: {grade_distribution}")
    else:
        lines.append("Grade Distribution: None")

    highest_result = max(results, key=lambda result: result.score, default=None)
    lowest_result = min(results, key=lambda result: result.score, default=None)

    if highest_result:
        lines.append(
            f"Highest Score: {highest_result.score} / {highest_result.max_score} - {highest_result.final_url}"
        )
    else:
        lines.append("Highest Score: None")

    if lowest_result:
        lines.append(
            f"Lowest Score: {lowest_result.score} / {lowest_result.max_score} - {lowest_result.final_url}"
        )
    else:
        lines.append("Lowest Score: None")

    if failures:
        lines.append("")
        lines.append("Failed URLs")
        lines.append("-----------")
        for url, error_message in failures:
            lines.append(f"- {url}: {error_message}")

    return "\n".join(lines)

def build_batch_text_report(
    results: list[AuditResult],
    failures: list[tuple[str, str]],
    total_urls: int,
) -> str:
    lines: list[str] = []

    for index, result in enumerate(results, start=1):
        lines.append(f"Batch Item {index} / {total_urls}")
        lines.append("================")
        lines.append(build_text_report(result))
        lines.append("")

    if failures:
        lines.append("Failed Batch Items")
        lines.append("------------------")
        for url, error_message in failures:
            lines.append(f"- {url}: {error_message}")
        lines.append("")

    lines.append(build_batch_summary(results, failures, total_urls))

    return "\n".join(lines)

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Passive web security header auditor for authorized URLs."
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--url", help="Single URL to review.")
    input_group.add_argument("--urls-file", help="Text file containing URLs to review.")
    parser.add_argument("--timeout", type=int, default=10, help="Request timeout in seconds.")
    parser.add_argument("--json-out", help="Optional JSON report output path.")
    parser.add_argument("--text-out", help="Optional text report output path.")
    parser.add_argument("--csv-out", help="Optional CSV report output path.")

    args = parser.parse_args()

    try:
        timeout = validate_timeout(args.timeout)
    except ValueError as error:
        print(f"Error: {error}")
        return

    if args.urls_file:
        urls = load_urls_file(Path(args.urls_file))

        if not urls:
            print(f"Error: no URLs found in {args.urls_file}")
            return

        results: list[AuditResult] = []
        failures: list[tuple[str, str]] = []

        for index, url in enumerate(urls, start=1):
            print(f"Batch Item {index} / {len(urls)}")
            print("================")
            try:
                result = audit_url(url, timeout)
            except RuntimeError as error:
                failures.append((url, str(error)))
                print(f"Error: {error}")
                print("")
                continue

            results.append(result)
            print(build_text_report(result))
            print("")

        if args.json_out:
            save_batch_json_report(results, failures, len(urls), Path(args.json_out))

        if args.text_out:
            save_batch_text_report(results, failures, len(urls), Path(args.text_out))

        if args.csv_out:
            save_csv_report(results, Path(args.csv_out))

        print(build_batch_summary(results, failures, len(urls)))
        return

    try:
        result = audit_url(args.url, timeout)
    except RuntimeError as error:
        print(f"Error: {error}")
        return

    print(build_text_report(result))

    if args.json_out:
        save_json_report(result, Path(args.json_out))

    if args.text_out:
        save_text_report(result, Path(args.text_out))

    if args.csv_out:
        save_csv_report([result], Path(args.csv_out))


if __name__ == "__main__":
    main()
