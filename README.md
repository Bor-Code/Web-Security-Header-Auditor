# Web Security Header Auditor

Web Security Header Auditor is a defensive command-line tool for passive HTTP response review.

It checks common security headers, HTTPS usage, cookie flags, and produces text, JSON, and CSV reports for manual review.

## Safety Scope

This project is defensive only.

It does not perform:

- exploitation
- fuzzing
- brute force
- payload testing
- authentication attacks
- vulnerability exploitation

Use it only on websites you own or are authorized to review.

## Features

- Passive HTTP response header review
- HTTPS detection
- Security header checklist
- Cookie flag review
- Review notes for missing headers and cookie flags
- 0-100 review score
- A-F review grade
- Single URL audit
- Batch URL audit from a text file
- Batch summary output
- Average batch score
- Grade distribution
- Priority distribution
- Highest and lowest score summary
- Text report export
- JSON report export
- CSV report export
- Automatic output directory creation
- Timeout validation

## Checked Headers

- Content-Security-Policy
- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy

## Install

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\requirements.txt
```

## Usage

### Single URL Audit

```powershell
python .\src\web_security_header_auditor.py --url https://example.com
```

Save text and JSON reports:

```powershell
python .\src\web_security_header_auditor.py --url https://example.com --text-out .\reports\example.txt --json-out .\reports\example.json
```

Save a CSV report:

```powershell
python .\src\web_security_header_auditor.py --url https://example.com --csv-out .\reports\example.csv
```

### Batch URL Audit

Create a URL list:

```text
https://example.com
https://www.iana.org
```

Run a batch audit:

```powershell
python .\src\web_security_header_auditor.py --urls-file .\sample-inputs\urls.txt
```

Save batch reports:

```powershell
python .\src\web_security_header_auditor.py --urls-file .\sample-inputs\urls.txt --text-out .\reports\batch.txt --json-out .\reports\batch.json --csv-out .\reports\batch.csv
```

## CSV Columns

CSV output includes:

- url
- final_url
- status_code
- uses_https
- score
- max_score
- grade
- priority
- present_header_count
- missing_header_count
- cookie_count
- review_note_count
- present_headers
- missing_headers

## Review Score

The score is a manual review signal, not a final security verdict.

A missing header does not prove that a website is vulnerable by itself. It means the configuration deserves review.

Current scoring includes:

- HTTPS usage
- Content-Security-Policy
- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy

## Review Priority

The tool maps scores to review priority labels:

- Strong header posture
- Needs review
- High review priority

These labels help decide what to review first. They are not vulnerability classifications.

## Example Output

```text
Web Security Header Audit Report
===============================

URL: https://example.com
Final URL: https://example.com/
Status Code: 200
Uses HTTPS: True
Score: 25 / 100
Review Priority: High review priority
Review Grade: D
```

## Notes

This tool only reviews HTTP response metadata.

It does not execute code from the target website, bypass controls, exploit vulnerabilities, or send attack payloads.
