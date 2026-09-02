#!/usr/bin/env python3
"""Validate ``${{ ... }}`` expression syntax in GitHub Actions YAML files.

GitHub evaluates expressions anywhere in a workflow or action template,
including inside ``run:`` script bodies and comments within them. A malformed
expression makes the whole file fail to load at runtime with a bare
"An expression was expected", which no YAML linter reports. actionlint covers
this for workflows but cannot parse composite ``action.yml`` files, and zizmor
only warns. This check covers both.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

TOKEN_RE = re.compile(
    r"""
    (?P<space>\s+)
    | (?P<number>-?(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?))
    | (?P<string>'(?:[^']|'')*')
    | (?P<ident>[a-zA-Z_][a-zA-Z0-9_-]*)
    | (?P<op>&&|\|\||==|!=|<=|>=|<|>|!|\(|\)|\[|\]|,|\.|\*)
    """,
    re.VERBOSE,
)


class ExpressionError(Exception):
    pass


def tokenize(source: str) -> list[tuple[str, str]]:
    tokens: list[tuple[str, str]] = []
    position = 0
    while position < len(source):
        match = TOKEN_RE.match(source, position)
        if not match:
            raise ExpressionError(f"unexpected character {source[position]!r}")
        position = match.end()
        kind = match.lastgroup
        if kind != "space":
            tokens.append((kind, match.group()))
    return tokens


class Parser:
    """Recursive-descent parser for the GitHub Actions expression grammar.

    https://docs.github.com/en/actions/reference/workflows-and-actions/expressions
    """

    BINARY_PRECEDENCE = (("||",), ("&&",), ("==", "!="), ("<", "<=", ">", ">="))
    LITERALS = ("true", "false", "null")

    def __init__(self, tokens: list[tuple[str, str]]) -> None:
        self.tokens = tokens
        self.position = 0

    def parse(self) -> None:
        self.expression()
        if self.position != len(self.tokens):
            raise ExpressionError(f"unexpected trailing {self.peek()[1]!r}")

    def peek(self) -> tuple[str, str]:
        if self.position >= len(self.tokens):
            return ("end", "end of expression")
        return self.tokens[self.position]

    def accept(self, value: str) -> bool:
        if self.peek()[1] == value:
            self.position += 1
            return True
        return False

    def expect(self, value: str) -> None:
        if not self.accept(value):
            raise ExpressionError(f"expected {value!r}, found {self.peek()[1]!r}")

    def expression(self, level: int = 0) -> None:
        if level == len(self.BINARY_PRECEDENCE):
            self.unary()
            return
        self.expression(level + 1)
        while self.peek()[1] in self.BINARY_PRECEDENCE[level]:
            self.position += 1
            self.expression(level + 1)

    def unary(self) -> None:
        if self.accept("!"):
            self.unary()
            return
        self.primary()

    def primary(self) -> None:
        kind, value = self.peek()
        if self.accept("("):
            self.expression()
            self.expect(")")
        elif kind in ("number", "string"):
            self.position += 1
        elif kind == "ident":
            self.position += 1
            if value not in self.LITERALS and self.accept("("):
                if not self.accept(")"):
                    self.expression()
                    while self.accept(","):
                        self.expression()
                    self.expect(")")
        elif self.accept("*"):
            return
        else:
            raise ExpressionError(f"expected a value, found {value!r}")
        self.trailers()

    def trailers(self) -> None:
        while True:
            if self.accept("."):
                kind, value = self.peek()
                if kind != "ident" and value != "*":
                    raise ExpressionError(f"expected a property name, found {value!r}")
                self.position += 1
            elif self.accept("["):
                self.expression()
                self.expect("]")
            else:
                return


def check_expression(body: str) -> str | None:
    if not body.strip():
        return "empty expression"
    if "${{" in body:
        return "nested '${{' inside an expression"
    try:
        Parser(tokenize(body)).parse()
    except ExpressionError as error:
        return str(error)
    return None


def check_text(text: str) -> list[tuple[int, int, str]]:
    problems: list[tuple[int, int, str]] = []
    for match in re.finditer(r"\$\{\{", text):
        start = match.end()
        end = text.find("}}", start)
        if end < 0:
            problem = "unterminated '${{'"
            end = len(text)
        else:
            problem = check_expression(text[start:end])
        if problem:
            line = text.count("\n", 0, match.start()) + 1
            column = match.start() - (text.rfind("\n", 0, match.start()) + 1) + 1
            problems.append((line, column, problem))
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()

    files = sorted(
        path
        for root in args.paths
        for pattern in ("**/*.yml", "**/*.yaml")
        for path in ([root] if root.is_file() else root.glob(pattern))
    )
    if not files:
        print(f"error: no YAML files found under {args.paths}", file=sys.stderr)
        return 2

    failures = 0
    for path in files:
        for line, column, problem in check_text(path.read_text()):
            print(f"{path}:{line}:{column}: {problem}")
            failures += 1

    print(f"checked {len(files)} files, found {failures} invalid expressions")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
