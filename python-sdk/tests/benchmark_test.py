# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Performance benchmark tests for the Mattermost Python Plugin SDK.

These benchmarks measure:
1. gRPC call overhead (client to fake server round-trip)
2. Protobuf-to-wrapper conversion overhead
3. Hook decorator dispatch overhead

Benchmarks use simple timing with time.perf_counter() since pytest-benchmark
is not a required dependency. Results are reported as averages over multiple
iterations.

Run benchmarks:
    python -m pytest tests/benchmark_test.py -v -s

Note: These benchmarks require a running gRPC server or use mocked responses.
The focus is on measuring SDK overhead, not actual server performance.
"""

from __future__ import annotations

import statistics
import time
from concurrent import futures
from typing import Iterator, List

import grpc
import pytest

from mattermost_plugin import PluginAPIClient, hook, HookName
from mattermost_plugin._internal.wrappers import User, Post, Channel
from mattermost_plugin.grpc import (
    api_pb2_grpc,
    api_remaining_pb2,
    api_user_team_pb2,
    api_channel_post_pb2,
    user_pb2,
    post_pb2,
    channel_pb2,
)


# =============================================================================
# Benchmark Configuration
# =============================================================================

# Number of iterations for each benchmark
BENCHMARK_ITERATIONS = 1000

# Number of warmup iterations (not counted)
WARMUP_ITERATIONS = 100


class BenchmarkResult:
    """Stores benchmark timing results."""

    def __init__(self, name: str, times: List[float]) -> None:
        self.name = name
        self.times = times
        self.count = len(times)
        self.total = sum(times)
        self.mean = statistics.mean(times)
        self.median = statistics.median(times)
        self.stdev = statistics.stdev(times) if len(times) > 1 else 0.0
        self.min = min(times)
        self.max = max(times)

    def __str__(self) -> str:
        return (
            f"{self.name}:\n"
            f"  iterations: {self.count}\n"
            f"  mean: {self.mean * 1_000_000:.2f} us\n"
            f"  median: {self.median * 1_000_000:.2f} us\n"
            f"  stdev: {self.stdev * 1_000_000:.2f} us\n"
            f"  min: {self.min * 1_000_000:.2f} us\n"
            f"  max: {self.max * 1_000_000:.2f} us\n"
            f"  ops/sec: {1 / self.mean:.0f}"
        )


def run_benchmark(
    name: str,
    func: callable,
    iterations: int = BENCHMARK_ITERATIONS,
    warmup: int = WARMUP_ITERATIONS,
) -> BenchmarkResult:
    """Run a benchmark function and collect timing data."""
    # Warmup
    for _ in range(warmup):
        func()

    # Timed iterations
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        func()
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(name, times)


# =============================================================================
# Fake gRPC Server for Benchmarking
# =============================================================================


class BenchmarkPluginAPIServicer(api_pb2_grpc.PluginAPIServicer):
    """Fast fake gRPC server for benchmarking SDK overhead."""

    def __init__(self) -> None:
        # Pre-create response objects to minimize server-side overhead
        self._server_version_response = api_remaining_pb2.GetServerVersionResponse(
            version="9.5.0-benchmark"
        )
        self._user_response = self._create_user_response()
        self._channel_response = self._create_channel_response()
        self._post_response = self._create_post_response()

    def _create_user_response(self) -> api_user_team_pb2.GetUserResponse:
        """Create a pre-built user response."""
        return api_user_team_pb2.GetUserResponse(
            user=user_pb2.User(
                id="user-id-benchmark",
                username="benchmarkuser",
                email="benchmark@example.com",
                nickname="Benchmark User",
                first_name="Benchmark",
                last_name="User",
                position="Developer",
                roles="system_user",
                locale="en",
                create_at=1609459200000,
                update_at=1609545600000,
            )
        )

    def _create_channel_response(self) -> api_channel_post_pb2.GetChannelResponse:
        """Create a pre-built channel response."""
        return api_channel_post_pb2.GetChannelResponse(
            channel=channel_pb2.Channel(
                id="channel-id-benchmark",
                team_id="team-id-benchmark",
                type=channel_pb2.CHANNEL_TYPE_OPEN,
                display_name="Benchmark Channel",
                name="benchmark-channel",
                header="Benchmark channel header",
                purpose="For benchmarking",
                create_at=1609459200000,
                update_at=1609545600000,
            )
        )

    def _create_post_response(self) -> api_channel_post_pb2.CreatePostResponse:
        """Create a pre-built post response."""
        return api_channel_post_pb2.CreatePostResponse(
            post=post_pb2.Post(
                id="post-id-benchmark",
                channel_id="channel-id-benchmark",
                user_id="user-id-benchmark",
                message="This is a benchmark test message.",
                create_at=1609459200000,
                update_at=1609459200000,
            )
        )

    def GetServerVersion(
        self,
        request: api_remaining_pb2.GetServerVersionRequest,
        context: grpc.ServicerContext,
    ) -> api_remaining_pb2.GetServerVersionResponse:
        return self._server_version_response

    def GetUser(
        self,
        request: api_user_team_pb2.GetUserRequest,
        context: grpc.ServicerContext,
    ) -> api_user_team_pb2.GetUserResponse:
        return self._user_response

    def GetChannel(
        self,
        request: api_channel_post_pb2.GetChannelRequest,
        context: grpc.ServicerContext,
    ) -> api_channel_post_pb2.GetChannelResponse:
        return self._channel_response

    def CreatePost(
        self,
        request: api_channel_post_pb2.CreatePostRequest,
        context: grpc.ServicerContext,
    ) -> api_channel_post_pb2.CreatePostResponse:
        return self._post_response


@pytest.fixture
def benchmark_server() -> Iterator[tuple[str, BenchmarkPluginAPIServicer]]:
    """Start a fast fake gRPC server for benchmarking."""
    servicer = BenchmarkPluginAPIServicer()
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=4),
        options=[
            ("grpc.so_reuseport", 0),
        ],
    )
    api_pb2_grpc.add_PluginAPIServicer_to_server(servicer, server)

    port = server.add_insecure_port("[::]:0")
    server.start()

    target = f"localhost:{port}"

    try:
        yield target, servicer
    finally:
        server.stop(grace=0.5)


# =============================================================================
# API Call Benchmarks
# =============================================================================


class TestAPICallBenchmarks:
    """Benchmarks for gRPC API call overhead."""

    def test_benchmark_get_server_version(
        self, benchmark_server: tuple[str, BenchmarkPluginAPIServicer]
    ) -> None:
        """Benchmark GetServerVersion - minimal RPC overhead baseline."""
        target, _ = benchmark_server

        with PluginAPIClient(target=target) as client:
            result = run_benchmark(
                "GetServerVersion",
                lambda: client.get_server_version(),
            )

        print(f"\n{result}")
        # Sanity check: should complete in reasonable time
        assert result.mean < 0.1  # Less than 100ms average

    def test_benchmark_get_user(
        self, benchmark_server: tuple[str, BenchmarkPluginAPIServicer]
    ) -> None:
        """Benchmark GetUser - entity retrieval with wrapper conversion."""
        target, _ = benchmark_server

        with PluginAPIClient(target=target) as client:
            result = run_benchmark(
                "GetUser",
                lambda: client.get_user("user-id-benchmark"),
            )

        print(f"\n{result}")
        assert result.mean < 0.1

    def test_benchmark_get_channel(
        self, benchmark_server: tuple[str, BenchmarkPluginAPIServicer]
    ) -> None:
        """Benchmark GetChannel - another entity retrieval pattern."""
        target, _ = benchmark_server

        with PluginAPIClient(target=target) as client:
            result = run_benchmark(
                "GetChannel",
                lambda: client.get_channel("channel-id-benchmark"),
            )

        print(f"\n{result}")
        assert result.mean < 0.1


# =============================================================================
# Wrapper Conversion Benchmarks
# =============================================================================


class TestWrapperConversionBenchmarks:
    """Benchmarks for protobuf-to-wrapper conversion overhead."""

    def test_benchmark_user_from_proto(self) -> None:
        """Benchmark User.from_proto() conversion."""
        proto_user = user_pb2.User(
            id="user-id-benchmark",
            username="benchmarkuser",
            email="benchmark@example.com",
            nickname="Benchmark User",
            first_name="Benchmark",
            last_name="User",
            position="Developer",
            roles="system_user",
            locale="en",
            create_at=1609459200000,
            update_at=1609545600000,
        )

        result = run_benchmark(
            "User.from_proto",
            lambda: User.from_proto(proto_user),
            iterations=10000,
        )

        print(f"\n{result}")
        # Conversion should be very fast (microseconds)
        assert result.mean < 0.001  # Less than 1ms

    def test_benchmark_user_to_proto(self) -> None:
        """Benchmark User.to_proto() conversion."""
        user = User(
            id="user-id-benchmark",
            username="benchmarkuser",
            email="benchmark@example.com",
            nickname="Benchmark User",
            first_name="Benchmark",
            last_name="User",
            position="Developer",
            roles="system_user",
            locale="en",
            create_at=1609459200000,
            update_at=1609545600000,
        )

        result = run_benchmark(
            "User.to_proto",
            lambda: user.to_proto(),
            iterations=10000,
        )

        print(f"\n{result}")
        assert result.mean < 0.001

    def test_benchmark_post_from_proto(self) -> None:
        """Benchmark Post.from_proto() conversion."""
        proto_post = post_pb2.Post(
            id="post-id-benchmark",
            channel_id="channel-id-benchmark",
            user_id="user-id-benchmark",
            message="This is a benchmark test message with some content.",
            create_at=1609459200000,
            update_at=1609459200000,
        )

        result = run_benchmark(
            "Post.from_proto",
            lambda: Post.from_proto(proto_post),
            iterations=10000,
        )

        print(f"\n{result}")
        assert result.mean < 0.001

    def test_benchmark_channel_from_proto(self) -> None:
        """Benchmark Channel.from_proto() conversion."""
        proto_channel = channel_pb2.Channel(
            id="channel-id-benchmark",
            team_id="team-id-benchmark",
            type=channel_pb2.CHANNEL_TYPE_OPEN,
            display_name="Benchmark Channel",
            name="benchmark-channel",
            header="Channel header",
            purpose="Channel purpose",
            create_at=1609459200000,
            update_at=1609545600000,
        )

        result = run_benchmark(
            "Channel.from_proto",
            lambda: Channel.from_proto(proto_channel),
            iterations=10000,
        )

        print(f"\n{result}")
        assert result.mean < 0.001


# =============================================================================
# Hook Decorator Benchmarks
# =============================================================================


class TestHookDecoratorBenchmarks:
    """Benchmarks for hook decorator dispatch overhead."""

    def test_benchmark_hook_decorator_application(self) -> None:
        """Benchmark applying the @hook decorator to a function."""

        def benchmark_func() -> None:
            @hook(HookName.OnActivate)
            def on_activate(self) -> None:
                pass

        result = run_benchmark(
            "hook_decorator_application",
            benchmark_func,
            iterations=10000,
        )

        print(f"\n{result}")
        # Decorator application should be fast
        assert result.mean < 0.001

    def test_benchmark_hook_lookup(self) -> None:
        """Benchmark hook metadata lookup via get_hook_name."""
        from mattermost_plugin.hooks import get_hook_name, is_hook_handler

        @hook(HookName.OnActivate)
        def handler() -> None:
            pass

        result = run_benchmark(
            "get_hook_name_lookup",
            lambda: get_hook_name(handler),
            iterations=10000,
        )

        print(f"\n{result}")
        assert result.mean < 0.0001  # Very fast lookup

        # Also benchmark is_hook_handler
        result2 = run_benchmark(
            "is_hook_handler_check",
            lambda: is_hook_handler(handler),
            iterations=10000,
        )

        print(f"\n{result2}")
        assert result2.mean < 0.0001


# =============================================================================
# Summary Output
# =============================================================================


class TestBenchmarkSummary:
    """Generate a benchmark summary for documentation."""

    def test_print_benchmark_summary(
        self, benchmark_server: tuple[str, BenchmarkPluginAPIServicer]
    ) -> None:
        """Print a summary of all benchmarks (for CI/documentation)."""
        target, _ = benchmark_server
        results: List[BenchmarkResult] = []

        # API calls
        with PluginAPIClient(target=target) as client:
            results.append(
                run_benchmark(
                    "API: GetServerVersion",
                    lambda: client.get_server_version(),
                    iterations=500,
                )
            )
            results.append(
                run_benchmark(
                    "API: GetUser",
                    lambda: client.get_user("user-id-benchmark"),
                    iterations=500,
                )
            )

        # Wrapper conversions
        proto_user = user_pb2.User(
            id="user-id-benchmark",
            username="benchmarkuser",
            email="benchmark@example.com",
        )
        results.append(
            run_benchmark(
                "Wrapper: User.from_proto",
                lambda: User.from_proto(proto_user),
                iterations=5000,
            )
        )

        proto_post = post_pb2.Post(
            id="post-id",
            channel_id="channel-id",
            message="Test message",
        )
        results.append(
            run_benchmark(
                "Wrapper: Post.from_proto",
                lambda: Post.from_proto(proto_post),
                iterations=5000,
            )
        )

        # Hook lookup
        from mattermost_plugin.hooks import get_hook_name

        @hook(HookName.OnActivate)
        def sample_handler() -> None:
            pass

        results.append(
            run_benchmark(
                "Hook: get_hook_name",
                lambda: get_hook_name(sample_handler),
                iterations=5000,
            )
        )

        # Print summary
        print("\n" + "=" * 60)
        print("PYTHON SDK BENCHMARK SUMMARY")
        print("=" * 60)
        for result in results:
            print(f"\n{result.name}")
            print(f"  mean: {result.mean * 1_000_000:.2f} us")
            print(f"  ops/sec: {1 / result.mean:.0f}")
        print("\n" + "=" * 60)

        # All benchmarks should pass basic sanity checks
        for result in results:
            assert result.mean < 0.1, f"{result.name} too slow: {result.mean}s"
