# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for hook invocation runner.

Tests verify:
- Sync handlers are executed without blocking (via to_thread)
- Async handlers are awaited directly
- Timeouts produce expected errors
- Exception conversion to gRPC status codes
"""

import asyncio
import time
from typing import Any
from unittest.mock import MagicMock

import grpc
import pytest

from mattermost_plugin._internal.hook_runner import (
    DEFAULT_HOOK_TIMEOUT,
    HookInvocationError,
    HookRunner,
    HookTimeoutError,
    convert_hook_error_to_grpc_status,
    invoke_hook_safe,
    run_hook_async,
)


class TestRunHookAsync:
    """Tests for run_hook_async function."""

    @pytest.mark.asyncio
    async def test_sync_handler_executed(self) -> None:
        """Test that sync handlers are executed successfully."""
        call_count = [0]

        def sync_handler(arg: str) -> str:
            call_count[0] += 1
            return f"result: {arg}"

        result = await run_hook_async(
            sync_handler, "test", timeout=5.0, hook_name="TestHook"
        )

        assert call_count[0] == 1
        assert result == "result: test"

    @pytest.mark.asyncio
    async def test_async_handler_awaited(self) -> None:
        """Test that async handlers are awaited directly."""
        call_count = [0]

        async def async_handler(arg: str) -> str:
            call_count[0] += 1
            await asyncio.sleep(0.01)  # Small delay to prove it's awaited
            return f"async result: {arg}"

        result = await run_hook_async(
            async_handler, "test", timeout=5.0, hook_name="TestHook"
        )

        assert call_count[0] == 1
        assert result == "async result: test"

    @pytest.mark.asyncio
    async def test_sync_handler_timeout(self) -> None:
        """Test that slow sync handlers trigger timeout."""

        def slow_handler() -> str:
            time.sleep(1.0)  # Blocking sleep
            return "never reached"

        with pytest.raises(HookTimeoutError) as exc_info:
            await run_hook_async(
                slow_handler, timeout=0.1, hook_name="SlowHook"
            )

        assert exc_info.value.hook_name == "SlowHook"
        assert exc_info.value.timeout == 0.1

    @pytest.mark.asyncio
    async def test_async_handler_timeout(self) -> None:
        """Test that slow async handlers trigger timeout."""

        async def slow_async_handler() -> str:
            await asyncio.sleep(1.0)
            return "never reached"

        with pytest.raises(HookTimeoutError) as exc_info:
            await run_hook_async(
                slow_async_handler, timeout=0.1, hook_name="SlowAsyncHook"
            )

        assert exc_info.value.hook_name == "SlowAsyncHook"

    @pytest.mark.asyncio
    async def test_handler_exception_wrapped(self) -> None:
        """Test that handler exceptions are wrapped in HookInvocationError."""

        def failing_handler() -> None:
            raise ValueError("Something went wrong")

        with pytest.raises(HookInvocationError) as exc_info:
            await run_hook_async(
                failing_handler, timeout=5.0, hook_name="FailingHook"
            )

        assert exc_info.value.hook_name == "FailingHook"
        assert isinstance(exc_info.value.original_error, ValueError)

    @pytest.mark.asyncio
    async def test_handler_with_kwargs(self) -> None:
        """Test that kwargs are passed to handler."""

        def handler_with_kwargs(*, name: str, value: int) -> str:
            return f"{name}={value}"

        result = await run_hook_async(
            handler_with_kwargs,
            timeout=5.0,
            hook_name="TestHook",
            name="test",
            value=42,
        )

        assert result == "test=42"


class TestConvertHookErrorToGrpcStatus:
    """Tests for exception to gRPC status conversion."""

    def test_timeout_error_to_deadline_exceeded(self) -> None:
        """Test HookTimeoutError maps to DEADLINE_EXCEEDED."""
        error = HookTimeoutError("TestHook", 30.0)
        status_code, details = convert_hook_error_to_grpc_status(error)

        assert status_code == grpc.StatusCode.DEADLINE_EXCEEDED
        assert "timed out" in details.lower()

    def test_value_error_to_invalid_argument(self) -> None:
        """Test ValueError maps to INVALID_ARGUMENT."""
        original = ValueError("bad value")
        error = HookInvocationError("TestHook", original)
        status_code, details = convert_hook_error_to_grpc_status(error)

        assert status_code == grpc.StatusCode.INVALID_ARGUMENT

    def test_permission_error_to_permission_denied(self) -> None:
        """Test PermissionError maps to PERMISSION_DENIED."""
        original = PermissionError("access denied")
        error = HookInvocationError("TestHook", original)
        status_code, details = convert_hook_error_to_grpc_status(error)

        assert status_code == grpc.StatusCode.PERMISSION_DENIED

    def test_file_not_found_to_not_found(self) -> None:
        """Test FileNotFoundError maps to NOT_FOUND."""
        original = FileNotFoundError("file missing")
        error = HookInvocationError("TestHook", original)
        status_code, details = convert_hook_error_to_grpc_status(error)

        assert status_code == grpc.StatusCode.NOT_FOUND

    def test_not_implemented_to_unimplemented(self) -> None:
        """Test NotImplementedError maps to UNIMPLEMENTED."""
        original = NotImplementedError("not supported")
        error = HookInvocationError("TestHook", original)
        status_code, details = convert_hook_error_to_grpc_status(error)

        assert status_code == grpc.StatusCode.UNIMPLEMENTED

    def test_generic_exception_to_internal(self) -> None:
        """Test generic exceptions map to INTERNAL."""
        original = RuntimeError("unexpected error")
        error = HookInvocationError("TestHook", original)
        status_code, details = convert_hook_error_to_grpc_status(error)

        assert status_code == grpc.StatusCode.INTERNAL

    def test_unknown_error_type_to_internal(self) -> None:
        """Test unknown error types map to INTERNAL."""
        error = Exception("unknown")
        status_code, details = convert_hook_error_to_grpc_status(error)

        assert status_code == grpc.StatusCode.INTERNAL


class TestInvokeHookSafe:
    """Tests for invoke_hook_safe function."""

    @pytest.mark.asyncio
    async def test_returns_result_on_success(self) -> None:
        """Test successful invocation returns result."""

        def handler() -> str:
            return "success"

        result, error = await invoke_hook_safe(
            handler, timeout=5.0, hook_name="TestHook"
        )

        assert result == "success"
        assert error is None

    @pytest.mark.asyncio
    async def test_returns_default_on_none_handler(self) -> None:
        """Test None handler returns default value."""
        result, error = await invoke_hook_safe(
            None, timeout=5.0, hook_name="TestHook", default="default_value"
        )

        assert result == "default_value"
        assert error is None

    @pytest.mark.asyncio
    async def test_returns_default_on_failure(self) -> None:
        """Test failed invocation returns default and error."""

        def failing_handler() -> None:
            raise ValueError("failed")

        result, error = await invoke_hook_safe(
            failing_handler,
            timeout=5.0,
            hook_name="TestHook",
            default="fallback",
        )

        assert result == "fallback"
        assert error is not None
        assert isinstance(error, HookInvocationError)

    @pytest.mark.asyncio
    async def test_sets_grpc_context_on_failure(self) -> None:
        """Test that gRPC context is set on failure."""

        def failing_handler() -> None:
            raise ValueError("bad input")

        # Create mock context
        mock_context = MagicMock()

        result, error = await invoke_hook_safe(
            failing_handler,
            timeout=5.0,
            hook_name="TestHook",
            context=mock_context,
        )

        mock_context.set_code.assert_called_once()
        mock_context.set_details.assert_called_once()

        # Check the status code
        call_args = mock_context.set_code.call_args[0]
        assert call_args[0] == grpc.StatusCode.INVALID_ARGUMENT


class TestHookRunner:
    """Tests for HookRunner class."""

    @pytest.mark.asyncio
    async def test_invoke_with_default_timeout(self) -> None:
        """Test runner uses default timeout."""
        runner = HookRunner(timeout=10.0)

        def handler() -> str:
            return "done"

        result, error = await runner.invoke(handler, hook_name="TestHook")

        assert result == "done"
        assert error is None

    @pytest.mark.asyncio
    async def test_invoke_with_override_timeout(self) -> None:
        """Test runner respects timeout override."""
        runner = HookRunner(timeout=60.0)

        async def slow_handler() -> str:
            await asyncio.sleep(1.0)
            return "never"

        result, error = await runner.invoke(
            slow_handler, hook_name="SlowHook", timeout=0.1
        )

        assert result is None
        assert isinstance(error, HookTimeoutError)

    @pytest.mark.asyncio
    async def test_invoke_with_context(self) -> None:
        """Test runner passes context to error handler."""
        runner = HookRunner()
        mock_context = MagicMock()

        def failing() -> None:
            raise RuntimeError("oops")

        result, error = await runner.invoke(
            failing, hook_name="FailHook", context=mock_context
        )

        mock_context.set_code.assert_called_once()


class TestDefaultTimeout:
    """Tests for default timeout behavior."""

    def test_default_timeout_value(self) -> None:
        """Test that default timeout is 30 seconds."""
        assert DEFAULT_HOOK_TIMEOUT == 30.0

    @pytest.mark.asyncio
    async def test_uses_default_timeout_when_not_specified(self) -> None:
        """Test that default timeout is used when not specified."""
        # This is more of a behavioral test - we can't easily verify
        # the actual timeout without making it fail, but we can verify
        # it doesn't fail immediately
        def fast_handler() -> str:
            return "fast"

        result = await run_hook_async(fast_handler, hook_name="FastHook")
        assert result == "fast"
