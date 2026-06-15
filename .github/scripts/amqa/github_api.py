#!/usr/bin/env python3
"""Shared GitHub API helpers for AMQA."""

from __future__ import annotations

import os
from typing import Any, Optional

import requests

_TIMEOUT = (5, 60)
BASE_URL = "https://api.github.com"


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def get_pr(token: str, repo: str, pr_number: int) -> dict[str, Any]:
    r = requests.get(
        f"{BASE_URL}/repos/{repo}/pulls/{pr_number}",
        headers=_headers(token),
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def get_pr_files(token: str, repo: str, pr_number: int) -> list[str]:
    files: list[str] = []
    page = 1
    while True:
        r = requests.get(
            f"{BASE_URL}/repos/{repo}/pulls/{pr_number}/files",
            headers=_headers(token),
            params={"per_page": 100, "page": page},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        files.extend(item["filename"] for item in batch)
        page += 1
    return files


def get_issue_comments(token: str, repo: str, issue_number: int) -> list[dict[str, Any]]:
    r = requests.get(
        f"{BASE_URL}/repos/{repo}/issues/{issue_number}/comments",
        headers=_headers(token),
        params={"per_page": 100},
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def get_coderabbit_walkthrough(token: str, repo: str, pr_number: int) -> str:
    for comment in get_issue_comments(token, repo, pr_number):
        login = comment.get("user", {}).get("login", "")
        if "coderabbit" not in login.lower():
            continue
        body = comment.get("body", "")
        if "summarize by coderabbit.ai" in body or "walkthrough_start" in body:
            return body
    return ""


def get_commit_status(token: str, repo: str, sha: str, context: str) -> str:
    r = requests.get(
        f"{BASE_URL}/repos/{repo}/commits/{sha}/status",
        headers=_headers(token),
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    for status in r.json().get("statuses", []):
        if status.get("context") == context:
            return status.get("state", "")
    return ""


def set_commit_status(
    token: str,
    repo: str,
    sha: str,
    context: str,
    state: str,
    description: str,
    target_url: Optional[str] = None,
) -> None:
    payload: dict[str, Any] = {
        "state": state,
        "context": context,
        "description": description[:140],
    }
    if target_url:
        payload["target_url"] = target_url
    r = requests.post(
        f"{BASE_URL}/repos/{repo}/statuses/{sha}",
        headers=_headers(token),
        json=payload,
        timeout=_TIMEOUT,
    )
    r.raise_for_status()


def upsert_pr_comment(token: str, repo: str, pr_number: int, marker: str, body: str) -> None:
    comments = get_issue_comments(token, repo, pr_number)
    existing_id = None
    for comment in comments:
        if marker in comment.get("body", ""):
            existing_id = comment["id"]
            break
    full_body = f"{marker}\n{body}"
    if existing_id:
        r = requests.patch(
            f"{BASE_URL}/repos/{repo}/issues/comments/{existing_id}",
            headers=_headers(token),
            json={"body": full_body},
            timeout=_TIMEOUT,
        )
    else:
        r = requests.post(
            f"{BASE_URL}/repos/{repo}/issues/{pr_number}/comments",
            headers=_headers(token),
            json={"body": full_body},
            timeout=_TIMEOUT,
        )
    r.raise_for_status()


def env_token() -> str:
    return os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
