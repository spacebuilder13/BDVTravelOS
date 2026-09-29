#!/usr/bin/env python3
"""Fail when a GitHub PR body would show diagram captions instead of pictures.

A tool can report that a pull request was updated while the body only contains
a link. Reviewers then see the caption and no diagram. This checks the saved
body, not the tool's success message.

    python3 scripts/check_pr_images.py --self-test
    python3 scripts/check_pr_images.py --pr 9
    python3 scripts/check_pr_images.py --body-file body.md
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request

MARKDOWN_IMAGE = re.compile(r"!\[[^\]]*\]\((https?://[^)\s]+)\)")
ARTIFACT_LINK = re.compile(r"cursor\.com/agents/[^)\s]*artifacts", re.I)
FOOTER_CHROME = "cursor.com/assets/images/open-in-"


def qualifying_images(body: str) -> list[str]:
    urls = []
    for url in MARKDOWN_IMAGE.findall(body):
        if FOOTER_CHROME in url:
            continue
        urls.append(url)
    return urls


def problems(body: str) -> list[str]:
    found = []
    if ARTIFACT_LINK.search(body):
        found.append(
            "body links a Cursor agent artifact page; GitHub shows that as a caption, not a picture"
        )
    images = qualifying_images(body)
    if not images:
        found.append(
            "body has no Markdown image ![caption](https://...); an HTML <img> or a [caption](url) link does not count"
        )
    return found


def content_type(url: str, timeout: float) -> str:
    request = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        if exc.code != 405:
            raise
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.headers.get("Content-Type", "")


def remote_problems(urls: list[str], timeout: float) -> list[str]:
    found = []
    for url in urls:
        try:
            kind = content_type(url, timeout).split(";", 1)[0].strip().lower()
        except Exception as exc:  # network or HTTP failure is a failed check
            found.append(f"{url} did not load ({exc})")
            continue
        if not kind.startswith("image/"):
            found.append(f"{url} returned {kind or 'no content type'}, not an image")
    return found


def read_pr_body(number: int) -> str:
    result = subprocess.run(
        ["gh", "pr", "view", str(number), "--json", "body"],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout).get("body") or ""


def check(body: str, fetch: bool, timeout: float) -> list[str]:
    found = problems(body)
    if fetch and not found:
        found.extend(remote_problems(qualifying_images(body), timeout))
    return found


def self_test() -> int:
    bad_link = (
        "Why this change exists.\n\n"
        "[Architecture after this change](https://cursor.com/agents/bc-1/artifacts?path=%2Fdiagram.svg)\n"
    )
    html_only = 'Why.\n\n<img alt="Architecture" src="https://example.com/diagram.png" />\n'
    good = (
        "Why.\n\n"
        "![Architecture after this change](https://raw.githubusercontent.com/example/repo/abc/diagram.png)\n"
    )
    footer = good + '<img alt="Open in Web" src="https://cursor.com/assets/images/open-in-web-dark.png">\n'
    cases = [
        ("artifact link", bad_link, True),
        ("html img only", html_only, True),
        ("markdown image", good, False),
        ("footer chrome ignored", footer, False),
    ]
    failed = False
    for name, body, should_fail in cases:
        found = problems(body)
        got_fail = bool(found)
        if got_fail != should_fail:
            print(f"FAIL {name}: expected fail={should_fail}, got {found}")
            failed = True
        else:
            print(f"ok {name}")
    return 1 if failed else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--pr", type=int, help="pull request number whose saved body to check")
    source.add_argument("--body-file", help="file containing the pull request body")
    source.add_argument("--self-test", action="store_true", help="check the failure cases locally")
    parser.add_argument("--no-fetch", action="store_true", help="do not request the image URLs")
    parser.add_argument("--timeout", type=float, default=20.0)
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()
    if args.pr is None and not args.body_file:
        parser.error("pass --pr, --body-file, or --self-test")

    body = read_pr_body(args.pr) if args.pr is not None else open(args.body_file, encoding="utf-8").read()
    found = check(body, fetch=not args.no_fetch, timeout=args.timeout)
    if found:
        print("PR diagrams are not visible:", file=sys.stderr)
        for item in found:
            print(f"- {item}", file=sys.stderr)
        return 1
    print(f"ok {len(qualifying_images(body))} diagram image(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
