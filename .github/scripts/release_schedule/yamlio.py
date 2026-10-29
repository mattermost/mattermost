"""A reader for the YAML subset schedule.yml is written in, so nothing needs PyYAML.

Supported: block mappings and sequences, flow sequences and mappings of scalars, ``#``
comments, double- and single-quoted strings, null, booleans, integers and ISO dates.
Anything else (anchors, multi-line strings, tags) is an error rather than a guess.
"""

import json
import re
from datetime import date

DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
INT = re.compile(r"[-+]?\d+")


class YAMLError(ValueError):
    pass


def load(text: str):
    lines = []
    for number, raw in enumerate(text.splitlines(), 1):
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise YAMLError(f"line {number}: tabs are not allowed in indentation")
        content = _strip_comment(raw).rstrip()
        if content.strip() in ("---", "..."):
            continue
        if content.strip():
            lines.append((number, len(content) - len(content.lstrip()), content.strip()))
    if not lines:
        return None
    value, index = _block(lines, 0, lines[0][1])
    if index != len(lines):
        raise YAMLError(f"line {lines[index][0]}: unexpected indentation")
    return value


def _strip_comment(line: str) -> str:
    i = 0
    while i < len(line):
        char = line[i]
        if char in "\"'" and (i == 0 or line[i - 1] in " [{,:-"):
            end = _closing_quote(line, i)
            if end is None:
                return line
            i = end
        elif char == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i]
        i += 1
    return line


def _is_item(content: str) -> bool:
    return content == "-" or content.startswith("- ")


def _block(lines, index, indent):
    if _is_item(lines[index][2]):
        return _sequence(lines, index, indent)
    return _mapping(lines, index, indent)


def _sequence(lines, index, indent):
    items = []
    while index < len(lines) and lines[index][1] == indent and _is_item(lines[index][2]):
        number, _, content = lines[index]
        rest = content[1:].strip()
        if not rest:
            if index + 1 < len(lines) and lines[index + 1][1] > indent:
                value, index = _block(lines, index + 1, lines[index + 1][1])
            else:
                value, index = None, index + 1
        elif _split_key(rest) and not rest.startswith(("[", "{", '"', "'")):
            column = indent + (len(content) - len(rest))
            lines = lines[:index] + [(number, column, rest)] + lines[index + 1:]
            value, index = _mapping(lines, index, column)
        else:
            value, index = _scalar(rest, number), index + 1
        items.append(value)
    return items, index


def _mapping(lines, index, indent):
    result = {}
    while index < len(lines) and lines[index][1] == indent and not _is_item(lines[index][2]):
        number, _, content = lines[index]
        split = _split_key(content)
        if not split:
            raise YAMLError(f"line {number}: expected 'key: value'")
        key, rest = split
        if key in result:
            raise YAMLError(f"line {number}: duplicate key {key!r}")
        index += 1
        if rest:
            result[key] = _scalar(rest, number)
        elif index < len(lines) and (lines[index][1] > indent
                                     or (lines[index][1] == indent and _is_item(lines[index][2]))):
            result[key], index = _block(lines, index, lines[index][1])
        else:
            result[key] = None
    return result, index


def _split_key(content: str):
    """``(key, rest)`` for ``key: rest`` or ``key:``, else None."""
    if content[:1] in "\"'":
        end = _closing_quote(content, 0)
        if end is None or not content[end + 1:].startswith(":"):
            return None
        key, after = _scalar(content[: end + 1], 0), content[end + 2:]
    else:
        match = re.match(r"([^\s:#\[\]{},][^:#]*?):(?:\s|$)", content + " ")
        if not match:
            return None
        key, after = match.group(1), content[match.end() - 1:]
    if after and not after[0].isspace():
        return None
    return str(key), after.strip()


def _closing_quote(text: str, start: int):
    quote, i = text[start], start + 1
    while i < len(text):
        if quote == '"' and text[i] == "\\":
            i += 2
            continue
        if text[i] == quote:
            if quote == "'" and text[i + 1: i + 2] == "'":
                i += 2
                continue
            return i
        i += 1
    return None


def _split_flow(body: str, number: int) -> list[str]:
    parts, depth, start, i = [], 0, 0, 0
    while i < len(body):
        char = body[i]
        if char in "\"'":
            end = _closing_quote(body, i)
            if end is None:
                raise YAMLError(f"line {number}: unterminated string")
            i = end
        elif char in "[{":
            depth += 1
        elif char in "]}":
            depth -= 1
        elif char == "," and depth == 0:
            parts.append(body[start:i])
            start = i + 1
        i += 1
    parts.append(body[start:])
    parts = [part.strip() for part in parts]
    if parts and not parts[-1]:
        parts.pop()
    return parts


def _scalar(text: str, number: int):
    text = text.strip()
    if text.startswith("["):
        if not text.endswith("]"):
            raise YAMLError(f"line {number}: flow sequences must be on one line")
        return [_scalar(part, number) for part in _split_flow(text[1:-1], number)]
    if text.startswith("{"):
        if not text.endswith("}"):
            raise YAMLError(f"line {number}: flow mappings must be on one line")
        result = {}
        for part in _split_flow(text[1:-1], number):
            split = _split_key(part)
            if not split:
                raise YAMLError(f"line {number}: expected 'key: value' in {text}")
            result[split[0]] = _scalar(split[1], number) if split[1] else None
        return result
    if text.startswith('"'):
        if _closing_quote(text, 0) != len(text) - 1:
            raise YAMLError(f"line {number}: bad double-quoted string {text}")
        return json.loads(text)
    if text.startswith("'"):
        if _closing_quote(text, 0) != len(text) - 1:
            raise YAMLError(f"line {number}: bad single-quoted string {text}")
        return text[1:-1].replace("''", "'")
    if text[:1] in "&*!|>%@`":
        raise YAMLError(f"line {number}: unsupported YAML syntax: {text}")
    if text in ("null", "~", "Null", "NULL"):
        return None
    if text in ("true", "True", "TRUE"):
        return True
    if text in ("false", "False", "FALSE"):
        return False
    if INT.fullmatch(text):
        return int(text)
    if DATE.fullmatch(text):
        try:
            return date.fromisoformat(text)
        except ValueError as exc:
            raise YAMLError(f"line {number}: {exc}") from exc
    return text


def quote(value: str) -> str:
    """A double-quoted YAML string; JSON's escapes are a subset of YAML's."""
    return json.dumps(value, ensure_ascii=False)
