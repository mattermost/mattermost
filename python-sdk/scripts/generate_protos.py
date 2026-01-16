#!/usr/bin/env python3
# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Protocol Buffer and gRPC code generator for the Mattermost Plugin SDK.

This script generates Python code and type stubs from the .proto files
in the server/public/pluginapi/grpc/proto directory.

Usage:
    cd python-sdk
    python scripts/generate_protos.py

Prerequisites:
    pip install grpcio-tools mypy-protobuf

Generated files:
    - src/mattermost_plugin/grpc/*_pb2.py (Protocol Buffer messages)
    - src/mattermost_plugin/grpc/*_pb2_grpc.py (gRPC service stubs)
    - src/mattermost_plugin/grpc/*_pb2.pyi (Type stubs for messages)
    - src/mattermost_plugin/grpc/*_pb2_grpc.pyi (Type stubs for services)
"""

import subprocess
import sys
from pathlib import Path


def get_repo_root() -> Path:
    """Find the repository root by looking for .git directory."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current
        # Also check parent in case we're in python-sdk/scripts
        parent = current.parent
        if (parent / ".git").exists():
            return parent
        current = parent
    raise RuntimeError("Could not find repository root (.git directory)")


def main() -> int:
    """Generate Protocol Buffer and gRPC code from .proto files."""
    # Determine paths
    script_dir = Path(__file__).resolve().parent
    sdk_root = script_dir.parent
    repo_root = get_repo_root()

    proto_dir = repo_root / "server" / "public" / "pluginapi" / "grpc" / "proto"
    output_dir = sdk_root / "src" / "mattermost_plugin" / "grpc"

    # Validate paths
    if not proto_dir.exists():
        print(f"ERROR: Proto directory not found: {proto_dir}", file=sys.stderr)
        return 1

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all .proto files
    proto_files = sorted(proto_dir.glob("*.proto"))
    if not proto_files:
        print(f"ERROR: No .proto files found in {proto_dir}", file=sys.stderr)
        return 1

    print(f"Found {len(proto_files)} .proto files in {proto_dir}")
    for pf in proto_files:
        print(f"  - {pf.name}")

    # Build the protoc command
    # We need to include the Google well-known types path
    cmd = [
        sys.executable, "-m", "grpc_tools.protoc",
        f"-I{proto_dir}",
        f"--python_out={output_dir}",
        f"--grpc_python_out={output_dir}",
        f"--mypy_out={output_dir}",
        f"--mypy_grpc_out={output_dir}",
    ] + [str(pf) for pf in proto_files]

    print(f"\nRunning: {' '.join(cmd[:6])} [... {len(proto_files)} proto files]")

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        if result.stdout:
            print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"ERROR: protoc failed with exit code {e.returncode}", file=sys.stderr)
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        return 1
    except FileNotFoundError:
        print(
            "ERROR: grpcio-tools not found. Install with:\n"
            "  pip install grpcio-tools mypy-protobuf",
            file=sys.stderr
        )
        return 1

    # Fix imports in generated files (convert absolute to relative imports)
    # Python protoc generates absolute imports like "import common_pb2"
    # but we need "from . import common_pb2" for package-relative imports
    fix_imports(output_dir)

    # Verify generated files
    generated = list(output_dir.glob("*_pb2*.py")) + list(output_dir.glob("*_pb2*.pyi"))
    print(f"\nGenerated {len(generated)} files in {output_dir}")

    # Check that we have the key files
    required_files = [
        "api_pb2.py",
        "api_pb2_grpc.py",
        "common_pb2.py",
    ]

    missing = [f for f in required_files if not (output_dir / f).exists()]
    if missing:
        print(f"ERROR: Missing required files: {missing}", file=sys.stderr)
        return 1

    print("\nCode generation completed successfully!")
    return 0


def fix_imports(output_dir: Path) -> None:
    """
    Fix imports in generated Python files.

    The protoc compiler generates imports like:
        import common_pb2 as common__pb2

    But for proper package imports, we need:
        from . import common_pb2 as common__pb2
    """
    import re

    # Pattern to match: import <name>_pb2 as <alias>
    # or: from <name>_pb2 import <stuff>
    # We need to convert to relative imports
    import_pattern = re.compile(
        r'^import ((?:api|common|user|team|channel|post|file|hooks|api_\w+|hooks_\w+)_pb2(?:_grpc)?)'
        r'(?: as (\w+))?$',
        re.MULTILINE
    )
    from_import_pattern = re.compile(
        r'^from ((?:api|common|user|team|channel|post|file|hooks|api_\w+|hooks_\w+)_pb2(?:_grpc)?)'
        r' import (.+)$',
        re.MULTILINE
    )

    for py_file in output_dir.glob("*.py"):
        content = py_file.read_text()
        original = content

        # Replace "import foo_pb2 as bar" with "from . import foo_pb2 as bar"
        def replace_import(match: re.Match[str]) -> str:
            module = match.group(1)
            alias = match.group(2)
            if alias:
                return f"from . import {module} as {alias}"
            return f"from . import {module}"

        content = import_pattern.sub(replace_import, content)

        # Replace "from foo_pb2 import X" with "from .foo_pb2 import X"
        def replace_from_import(match: re.Match[str]) -> str:
            module = match.group(1)
            imports = match.group(2)
            return f"from .{module} import {imports}"

        content = from_import_pattern.sub(replace_from_import, content)

        if content != original:
            py_file.write_text(content)
            print(f"  Fixed imports in {py_file.name}")


if __name__ == "__main__":
    sys.exit(main())
