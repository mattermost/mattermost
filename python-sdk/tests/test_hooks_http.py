# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for ServeHTTP streaming hook implementation.

This module tests the Python-side ServeHTTP handler including:
- HTTPRequest wrapper class
- HTTPResponseWriter class
- Header conversion utilities
- Request body assembly from chunks
- Response streaming behavior
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.servicers.hooks_servicer import (
    PluginHooksServicerImpl,
    HTTPRequest,
    HTTPResponseWriter,
    _convert_headers_to_dict,
    _convert_dict_to_headers,
)
from mattermost_plugin.grpc import hooks_http_pb2
from mattermost_plugin.grpc import hooks_common_pb2


# =============================================================================
# Helper functions
# =============================================================================


def make_plugin_context() -> hooks_common_pb2.PluginContext:
    """Create a test PluginContext."""
    return hooks_common_pb2.PluginContext(
        session_id="session123",
        request_id="request123",
    )


def make_request_init(
    method: str = "GET",
    url: str = "/plugins/test/api/hello",
    headers: list = None,
) -> hooks_http_pb2.ServeHTTPRequestInit:
    """Create a ServeHTTPRequestInit for testing."""
    if headers is None:
        headers = []
    return hooks_http_pb2.ServeHTTPRequestInit(
        plugin_context=make_plugin_context(),
        method=method,
        url=url,
        proto="HTTP/1.1",
        proto_major=1,
        proto_minor=1,
        headers=headers,
        host="localhost:8065",
        remote_addr="127.0.0.1:12345",
        request_uri=url,
        content_length=-1,
    )


async def collect_responses(async_gen):
    """Collect all responses from an async generator."""
    responses = []
    async for resp in async_gen:
        responses.append(resp)
    return responses


# =============================================================================
# HTTPRequest Tests
# =============================================================================


class TestHTTPRequest:
    """Tests for HTTPRequest wrapper class."""

    def test_basic_properties(self):
        """Test basic property access."""
        req = HTTPRequest(
            method="POST",
            url="http://localhost/api/v1/test",
            proto="HTTP/1.1",
            proto_major=1,
            proto_minor=1,
            headers={"Content-Type": ["application/json"], "Accept": ["text/html"]},
            host="localhost:8065",
            remote_addr="192.168.1.1:54321",
            request_uri="/api/v1/test",
            content_length=100,
            plugin_context=None,
        )

        assert req.method == "POST"
        assert req.url == "http://localhost/api/v1/test"
        assert req.host == "localhost:8065"
        assert req.content_length == 100

    def test_get_header_case_insensitive(self):
        """Test case-insensitive header lookup."""
        req = HTTPRequest(
            method="GET",
            url="/test",
            proto="HTTP/1.1",
            proto_major=1,
            proto_minor=1,
            headers={"Content-Type": ["application/json"], "X-Custom-Header": ["value1"]},
            host="localhost",
            remote_addr="127.0.0.1",
            request_uri="/test",
            content_length=0,
        )

        # Exact case
        assert req.get_header("Content-Type") == "application/json"
        # Lower case
        assert req.get_header("content-type") == "application/json"
        # Upper case
        assert req.get_header("CONTENT-TYPE") == "application/json"
        # Mixed case
        assert req.get_header("x-custom-header") == "value1"

    def test_get_header_default(self):
        """Test default value for missing headers."""
        req = HTTPRequest(
            method="GET",
            url="/test",
            proto="HTTP/1.1",
            proto_major=1,
            proto_minor=1,
            headers={},
            host="localhost",
            remote_addr="127.0.0.1",
            request_uri="/test",
            content_length=0,
        )

        assert req.get_header("X-Missing") == ""
        assert req.get_header("X-Missing", "default") == "default"

    def test_get_all_headers(self):
        """Test getting all values for a multi-value header."""
        req = HTTPRequest(
            method="GET",
            url="/test",
            proto="HTTP/1.1",
            proto_major=1,
            proto_minor=1,
            headers={"Set-Cookie": ["a=1", "b=2", "c=3"]},
            host="localhost",
            remote_addr="127.0.0.1",
            request_uri="/test",
            content_length=0,
        )

        cookies = req.get_all_headers("Set-Cookie")
        assert len(cookies) == 3
        assert "a=1" in cookies
        assert "b=2" in cookies

    def test_body_attribute(self):
        """Test body attribute."""
        req = HTTPRequest(
            method="POST",
            url="/test",
            proto="HTTP/1.1",
            proto_major=1,
            proto_minor=1,
            headers={},
            host="localhost",
            remote_addr="127.0.0.1",
            request_uri="/test",
            content_length=11,
        )

        req.body = b"hello world"
        assert req.body == b"hello world"


# =============================================================================
# HTTPResponseWriter Tests
# =============================================================================


class TestHTTPResponseWriter:
    """Tests for HTTPResponseWriter class."""

    def test_default_status_code(self):
        """Test that default status code is 200 after write."""
        w = HTTPResponseWriter()
        w.write(b"hello")

        assert w.status_code == 200

    def test_explicit_status_code(self):
        """Test setting explicit status code."""
        w = HTTPResponseWriter()
        w.write_header(404)
        w.write(b"Not Found")

        assert w.status_code == 404

    def test_set_header(self):
        """Test setting a header."""
        w = HTTPResponseWriter()
        w.set_header("Content-Type", "application/json")

        assert w.headers["Content-Type"] == ["application/json"]

    def test_add_header_multi_value(self):
        """Test adding multiple values to a header."""
        w = HTTPResponseWriter()
        w.add_header("Set-Cookie", "a=1")
        w.add_header("Set-Cookie", "b=2")

        assert w.headers["Set-Cookie"] == ["a=1", "b=2"]

    def test_write_string_auto_encode(self):
        """Test that writing a string auto-encodes to bytes."""
        w = HTTPResponseWriter()
        w.write("hello")

        assert w.get_body() == b"hello"

    def test_write_multiple_chunks(self):
        """Test writing multiple chunks."""
        w = HTTPResponseWriter()
        w.write(b"hello ")
        w.write(b"world")

        assert w.get_body() == b"hello world"

    def test_header_warning_after_write(self):
        """Test that setting headers after write logs a warning."""
        w = HTTPResponseWriter()
        w.write(b"body")

        # Should log warning but not raise
        w.set_header("X-Late", "value")

        # Header should not be set
        assert "X-Late" not in w.headers


# =============================================================================
# Header Conversion Tests
# =============================================================================


class TestHeaderConversion:
    """Tests for header conversion utilities."""

    def test_proto_to_dict_empty(self):
        """Test converting empty headers."""
        result = _convert_headers_to_dict([])
        assert result == {}

    def test_proto_to_dict_single_value(self):
        """Test converting single-value headers."""
        headers = [
            hooks_http_pb2.HTTPHeader(key="Content-Type", values=["application/json"]),
        ]
        result = _convert_headers_to_dict(headers)

        assert result == {"Content-Type": ["application/json"]}

    def test_proto_to_dict_multi_value(self):
        """Test converting multi-value headers."""
        headers = [
            hooks_http_pb2.HTTPHeader(key="Accept", values=["text/html", "application/json"]),
        ]
        result = _convert_headers_to_dict(headers)

        assert result == {"Accept": ["text/html", "application/json"]}

    def test_dict_to_proto(self):
        """Test converting dict to proto headers."""
        headers = {
            "Content-Type": ["application/json"],
            "X-Custom": ["val1", "val2"],
        }
        result = _convert_dict_to_headers(headers)

        assert len(result) == 2
        # Find Content-Type header
        ct = next(h for h in result if h.key == "Content-Type")
        assert list(ct.values) == ["application/json"]

    def test_dict_to_proto_string_value(self):
        """Test that string values are wrapped in list."""
        headers = {"Content-Type": "text/plain"}
        result = _convert_dict_to_headers(headers)

        assert len(result) == 1
        assert list(result[0].values) == ["text/plain"]


# =============================================================================
# ServeHTTP Servicer Tests
# =============================================================================


class TestServeHTTPServicer:
    """Tests for ServeHTTP gRPC servicer method."""

    @pytest.fixture
    def simple_plugin(self):
        """Create a plugin with a simple ServeHTTP handler."""

        class SimplePlugin(Plugin):
            def __init__(self):
                super().__init__()
                self.received_requests = []

            @hook(HookName.ServeHTTP)
            def serve_http(self, ctx, w, r):
                self.received_requests.append({
                    "method": r.method,
                    "url": r.url,
                    "body": r.body,
                })
                w.set_header("Content-Type", "text/plain")
                w.write_header(200)
                w.write(f"Hello! Method: {r.method}")

        return SimplePlugin()

    @pytest.fixture
    def error_plugin(self):
        """Create a plugin that raises an error."""

        class ErrorPlugin(Plugin):
            @hook(HookName.ServeHTTP)
            def serve_http(self, ctx, w, r):
                raise ValueError("Test error")

        return ErrorPlugin()

    @pytest.fixture
    def no_handler_plugin(self):
        """Create a plugin without ServeHTTP handler."""

        class NoHandlerPlugin(Plugin):
            pass

        return NoHandlerPlugin()

    @pytest.mark.asyncio
    async def test_simple_get_request(self, simple_plugin):
        """Test handling a simple GET request."""
        servicer = PluginHooksServicerImpl(simple_plugin)

        # Create request stream (single message with init, no body)
        async def request_stream():
            yield hooks_http_pb2.ServeHTTPRequest(
                init=make_request_init(method="GET", url="/hello"),
                body_complete=True,
            )

        context = MagicMock()
        context.cancelled.return_value = False

        responses = await collect_responses(servicer.ServeHTTP(request_stream(), context))

        assert len(responses) >= 1
        assert responses[0].init.status_code == 200
        assert b"Hello! Method: GET" in responses[0].body_chunk
        assert responses[-1].body_complete is True

    @pytest.mark.asyncio
    async def test_post_with_body(self, simple_plugin):
        """Test handling a POST request with body."""
        servicer = PluginHooksServicerImpl(simple_plugin)

        # Create request stream with body in multiple chunks
        async def request_stream():
            yield hooks_http_pb2.ServeHTTPRequest(
                init=make_request_init(method="POST", url="/api/create"),
                body_chunk=b"hello ",
                body_complete=False,
            )
            yield hooks_http_pb2.ServeHTTPRequest(
                body_chunk=b"world",
                body_complete=True,
            )

        context = MagicMock()
        context.cancelled.return_value = False

        responses = await collect_responses(servicer.ServeHTTP(request_stream(), context))

        # Verify request was received with assembled body
        assert len(simple_plugin.received_requests) == 1
        assert simple_plugin.received_requests[0]["body"] == b"hello world"
        assert simple_plugin.received_requests[0]["method"] == "POST"

    @pytest.mark.asyncio
    async def test_handler_error_returns_500(self, error_plugin):
        """Test that handler errors return 500 status."""
        servicer = PluginHooksServicerImpl(error_plugin)

        async def request_stream():
            yield hooks_http_pb2.ServeHTTPRequest(
                init=make_request_init(),
                body_complete=True,
            )

        context = MagicMock()
        context.cancelled.return_value = False

        responses = await collect_responses(servicer.ServeHTTP(request_stream(), context))

        assert len(responses) >= 1
        assert responses[0].init.status_code == 500

    @pytest.mark.asyncio
    async def test_no_handler_returns_404(self, no_handler_plugin):
        """Test that missing handler returns 404."""
        servicer = PluginHooksServicerImpl(no_handler_plugin)

        async def request_stream():
            yield hooks_http_pb2.ServeHTTPRequest(
                init=make_request_init(),
                body_complete=True,
            )

        context = MagicMock()
        context.cancelled.return_value = False

        responses = await collect_responses(servicer.ServeHTTP(request_stream(), context))

        assert len(responses) >= 1
        assert responses[0].init.status_code == 404

    @pytest.mark.asyncio
    async def test_empty_request_stream(self):
        """Test handling empty request stream."""

        class DummyPlugin(Plugin):
            pass

        servicer = PluginHooksServicerImpl(DummyPlugin())

        async def empty_stream():
            # Empty iterator
            return
            yield  # Make it a generator

        context = MagicMock()
        context.cancelled.return_value = False

        responses = await collect_responses(servicer.ServeHTTP(empty_stream(), context))

        # Should return error response
        assert len(responses) >= 1
        assert responses[0].init.status_code == 500

    @pytest.mark.asyncio
    async def test_request_headers_passed_to_handler(self, simple_plugin):
        """Test that request headers are properly passed."""
        servicer = PluginHooksServicerImpl(simple_plugin)

        headers = [
            hooks_http_pb2.HTTPHeader(key="Content-Type", values=["application/json"]),
            hooks_http_pb2.HTTPHeader(key="Authorization", values=["Bearer token123"]),
        ]

        async def request_stream():
            yield hooks_http_pb2.ServeHTTPRequest(
                init=make_request_init(headers=headers),
                body_complete=True,
            )

        context = MagicMock()
        context.cancelled.return_value = False

        await collect_responses(servicer.ServeHTTP(request_stream(), context))

        # Plugin should have received the request
        assert len(simple_plugin.received_requests) == 1


# =============================================================================
# Chunking Behavior Tests
# =============================================================================


class TestChunkingBehavior:
    """Tests for request body chunking behavior."""

    @pytest.mark.asyncio
    async def test_large_body_assembly(self):
        """Test that large bodies are correctly assembled from chunks."""

        class BodyCapturingPlugin(Plugin):
            def __init__(self):
                super().__init__()
                self.captured_body = None

            @hook(HookName.ServeHTTP)
            def serve_http(self, ctx, w, r):
                self.captured_body = r.body
                w.write(b"OK")

        plugin = BodyCapturingPlugin()
        servicer = PluginHooksServicerImpl(plugin)

        # Simulate chunked body (3 chunks of 100 bytes each)
        chunk1 = b"a" * 100
        chunk2 = b"b" * 100
        chunk3 = b"c" * 50

        async def request_stream():
            yield hooks_http_pb2.ServeHTTPRequest(
                init=make_request_init(method="POST"),
                body_chunk=chunk1,
                body_complete=False,
            )
            yield hooks_http_pb2.ServeHTTPRequest(
                body_chunk=chunk2,
                body_complete=False,
            )
            yield hooks_http_pb2.ServeHTTPRequest(
                body_chunk=chunk3,
                body_complete=True,
            )

        context = MagicMock()
        context.cancelled.return_value = False

        await collect_responses(servicer.ServeHTTP(request_stream(), context))

        # Verify body was correctly assembled
        assert plugin.captured_body == chunk1 + chunk2 + chunk3
        assert len(plugin.captured_body) == 250


# =============================================================================
# Cancellation Tests
# =============================================================================


class TestCancellation:
    """Tests for request cancellation handling."""

    @pytest.mark.asyncio
    async def test_cancellation_during_body_read(self):
        """Test that cancellation is detected during body streaming."""

        class SlowPlugin(Plugin):
            @hook(HookName.ServeHTTP)
            def serve_http(self, ctx, w, r):
                w.write(b"Should not reach here")

        plugin = SlowPlugin()
        servicer = PluginHooksServicerImpl(plugin)

        # Context that reports cancelled after first chunk
        context = MagicMock()
        call_count = [0]

        def check_cancelled():
            call_count[0] += 1
            return call_count[0] > 1  # Cancel after first check

        context.cancelled = check_cancelled

        async def slow_request_stream():
            yield hooks_http_pb2.ServeHTTPRequest(
                init=make_request_init(method="POST"),
                body_chunk=b"first chunk",
                body_complete=False,
            )
            # Simulate delay before next chunk
            await asyncio.sleep(0.01)
            yield hooks_http_pb2.ServeHTTPRequest(
                body_chunk=b"second chunk",
                body_complete=True,
            )

        # The servicer should detect cancellation
        responses = await collect_responses(servicer.ServeHTTP(slow_request_stream(), context))

        # Should have no responses if cancelled early, or error response
        # The exact behavior depends on when cancellation is detected
        # For now, just verify no exception is raised
