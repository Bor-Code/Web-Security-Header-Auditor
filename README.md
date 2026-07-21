# Web Security Header Auditor

Web Security Header Auditor is a defensive command-line tool for passive HTTP response review.

The tool checks common security headers, HTTPS usage, cookie flags, and produces a manual review score.

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
- 0-100 style review score
- Text report output
- JSON report output
- Batch URL input
- Batch summary output

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

```powershell
python .\src\web_security_header_auditor.py --url https://example.com
```

Batch review from a URL list:

```powershell
python .\src\web_security_header_auditor.py --urls-file .\sample-inputs\urls.txt
```

Save reports:

```powershell
python .\src\web_security_header_auditor.py --url https://example.com --json-out .\reports\example.json --text-out .\reports\example.txt
```

Save a batch JSON report:

```powershell
python .\src\web_security_header_auditor.py --urls-file .\sample-inputs\urls.txt --json-out .\reports\batch.json
```

## Review Score

The score is a manual review signal, not a final security verdict.

A missing header does not prove a site is vulnerable by itself. It only means the configuration deserves review.