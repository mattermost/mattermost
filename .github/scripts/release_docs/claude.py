"""A minimal Anthropic Messages API client, and JSON answers checked against their sources."""

import json
import os
import re
import urllib.request

API_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-4-6"  # the model generate_changelog.py uses


class Claude:
    def __init__(self, api_key: str, model: str = "", opener=urllib.request.urlopen):
        self.api_key = api_key
        self.model = model or DEFAULT_MODEL
        self.opener = opener

    @classmethod
    def from_env(cls) -> "Claude | None":
        key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        return cls(key, os.environ.get("ANTHROPIC_MODEL", "").strip()) if key else None

    def ask(self, system: str, prompt: str, max_tokens: int = 4000) -> str:
        body = json.dumps({
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }).encode()
        request = urllib.request.Request(API_URL, data=body, method="POST", headers={
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        })
        with self.opener(request, timeout=120) as response:
            payload = json.loads(response.read().decode())
        return "".join(part.get("text", "") for part in payload.get("content", []) if part.get("type") == "text")

    def ask_json(self, system: str, prompt: str, max_tokens: int = 4000):
        return parse_json(self.ask(system, prompt, max_tokens))


def parse_json(text: str):
    """The JSON value in a model reply, tolerating a fenced code block around it."""
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    return json.loads(fenced.group(1) if fenced else text)
