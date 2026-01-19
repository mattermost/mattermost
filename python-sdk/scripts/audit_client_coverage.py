#!/usr/bin/env python3
# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Audit script for verifying that all gRPC RPCs have corresponding client methods.

This script inspects the PluginAPIClient class and compares its methods against
the RPCs defined in the protobuf service definition. It reports any RPCs that
are missing Python client method implementations.

Usage:
    python scripts/audit_client_coverage.py
    python scripts/audit_client_coverage.py --include '(User|Team|Channel)'
    python scripts/audit_client_coverage.py --exclude '(Post|File|KV)'
    python scripts/audit_client_coverage.py --include '(User|Team|Channel)' --exclude '(Post|File|KV)'

The script:
1. Loads the generated protobuf service descriptor
2. Extracts all RPC method names
3. Applies include/exclude regex filters
4. Inspects PluginAPIClient for corresponding methods
5. Reports coverage statistics and any missing methods
"""

import argparse
import inspect
import re
import sys
from typing import List, Set, Tuple


def camel_to_snake(name: str) -> str:
    """
    Convert CamelCase to snake_case.

    Examples:
        GetUser -> get_user
        GetUserByEmail -> get_user_by_email
        HasPermissionToChannel -> has_permission_to_channel
    """
    # Insert underscore before uppercase letters and convert to lower
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def get_rpc_names_from_stub() -> List[str]:
    """
    Get all RPC names from the PluginAPI gRPC stub.

    We inspect the stub class attributes to find all registered RPC methods.
    """
    try:
        from mattermost_plugin.grpc import api_pb2_grpc
    except ImportError:
        print("ERROR: Could not import api_pb2_grpc. Are protos generated?")
        sys.exit(1)

    # Get all attributes of the stub class
    stub_class = api_pb2_grpc.PluginAPIStub

    # Find RPC methods by looking at what the __init__ sets up
    # We can infer RPC names from the stub source or by introspection
    rpc_names = []

    # The stub's __init__ signature shows all the RPCs it configures
    # We'll look at the source to extract RPC names
    source = inspect.getsource(stub_class.__init__)

    # Find patterns like "self.CreateUser = channel.unary_unary("
    pattern = r"self\.(\w+)\s*=\s*channel\.unary_unary\("
    matches = re.findall(pattern, source)

    rpc_names.extend(matches)

    # Also check for streaming patterns if any
    pattern = r"self\.(\w+)\s*=\s*channel\.(?:unary_stream|stream_unary|stream_stream)\("
    matches = re.findall(pattern, source)
    rpc_names.extend(matches)

    return sorted(set(rpc_names))


def get_client_methods() -> Set[str]:
    """
    Get all public methods from PluginAPIClient.
    """
    try:
        from mattermost_plugin.client import PluginAPIClient
    except ImportError:
        print("ERROR: Could not import PluginAPIClient. Is the SDK installed?")
        sys.exit(1)

    methods = set()

    for name, value in inspect.getmembers(PluginAPIClient, predicate=inspect.isfunction):
        # Skip private methods
        if name.startswith("_"):
            continue
        methods.add(name)

    return methods


def filter_rpcs(
    rpc_names: List[str],
    include_pattern: str = "",
    exclude_pattern: str = "",
) -> List[str]:
    """
    Filter RPC names based on include/exclude patterns.
    """
    filtered = rpc_names

    if include_pattern:
        include_re = re.compile(include_pattern)
        filtered = [n for n in filtered if include_re.search(n)]

    if exclude_pattern:
        exclude_re = re.compile(exclude_pattern)
        filtered = [n for n in filtered if not exclude_re.search(n)]

    return filtered


def find_missing_and_extra(
    rpc_names: List[str],
    client_methods: Set[str],
) -> Tuple[List[str], List[str]]:
    """
    Find RPCs that are missing client methods and vice versa.

    Returns:
        Tuple of (missing_rpcs, extra_client_methods)
        - missing_rpcs: RPCs without corresponding client methods
        - extra_client_methods: Client methods that don't map to an RPC in scope
    """
    missing = []
    expected_methods = set()

    for rpc_name in rpc_names:
        expected_method = camel_to_snake(rpc_name)
        expected_methods.add(expected_method)

        if expected_method not in client_methods:
            missing.append(rpc_name)

    # Find extra methods in the scope that aren't RPCs
    # (This is informational - extra methods are fine)

    return missing, []


def main():
    parser = argparse.ArgumentParser(
        description="Audit PluginAPIClient coverage against gRPC service definition",
    )
    parser.add_argument(
        "--include",
        default="",
        help="Regex pattern to include RPC names (applied first)",
    )
    parser.add_argument(
        "--exclude",
        default="",
        help="Regex pattern to exclude RPC names (applied after include)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output including all RPCs",
    )

    args = parser.parse_args()

    # Get all RPC names
    all_rpcs = get_rpc_names_from_stub()
    print(f"Total RPCs in service: {len(all_rpcs)}")

    # Filter RPCs
    filtered_rpcs = filter_rpcs(all_rpcs, args.include, args.exclude)
    print(f"RPCs after filtering: {len(filtered_rpcs)}")

    if args.include:
        print(f"  Include pattern: {args.include}")
    if args.exclude:
        print(f"  Exclude pattern: {args.exclude}")

    # Get client methods
    client_methods = get_client_methods()
    print(f"Client methods: {len(client_methods)}")

    # Find missing
    missing, _ = find_missing_and_extra(filtered_rpcs, client_methods)

    if args.verbose:
        print("\nFiltered RPCs:")
        for rpc in filtered_rpcs:
            method = camel_to_snake(rpc)
            status = "OK" if method in client_methods else "MISSING"
            print(f"  {rpc} -> {method} [{status}]")

    print()

    # Report results
    covered = len(filtered_rpcs) - len(missing)
    percentage = (covered / len(filtered_rpcs) * 100) if filtered_rpcs else 100

    print(f"Coverage: {covered}/{len(filtered_rpcs)} ({percentage:.1f}%)")

    if missing:
        print(f"\nMissing client methods for {len(missing)} RPCs:")
        for rpc in missing:
            method = camel_to_snake(rpc)
            print(f"  - {rpc} (expected method: {method})")

        return 1
    else:
        print("\nAll in-scope RPCs have corresponding client methods!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
