# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Hook invocation runner with timeout and sync/async support.

This module provides utilities for invoking hook handlers safely:
- Timeout enforcement using asyncio.wait_for
- Support for both sync and async handlers
- Consistent exception to gRPC error conversion
"""

from __future__ import annotations

import asyncio
import inspect
import logging
from typing import Any, Callable, Optional, Tuple, TypeVar

import grpc

# Use inspect.iscoroutinefunction to avoid deprecation warning in Python 3.14+
_iscoroutinefunction = inspect.iscoroutinefunction

# Default timeout for hook invocations (seconds)
DEFAULT_HOOK_TIMEOUT = 30.0

T = TypeVar("T")

logger = logging.getLogger(__name__)


class HookTimeoutError(Exception):
    """Raised when a hook handler exceeds its timeout."""

    def __init__(self, hook_name: str, timeout: float) -> None:
        self.hook_name = hook_name
        self.timeout = timeout
        super().__init__(
            f"Hook '{hook_name}' timed out after {timeout:.1f} seconds"
        )


class HookInvocationError(Exception):
    """Raised when a hook handler raises an exception."""

    def __init__(
        self,
        hook_name: str,
        original_error: BaseException,
        message: Optional[str] = None,
    ) -> None:
        self.hook_name = hook_name
        self.original_error = original_error
        msg = message or f"Hook '{hook_name}' raised {type(original_error).__name__}: {original_error}"
        super().__init__(msg)


async def run_hook_async(
    handler: Callable[..., T],
    *args: Any,
    timeout: float = DEFAULT_HOOK_TIMEOUT,
    hook_name: str = "unknown",
    **kwargs: Any,
) -> T:
    """
    Run a hook handler with timeout support.

    This function handles both sync and async handlers:
    - Async handlers (coroutine functions) are awaited directly
    - Sync handlers are run in a thread pool via asyncio.to_thread

    Args:
        handler: The hook handler callable (sync or async).
        *args: Positional arguments to pass to the handler.
        timeout: Maximum time in seconds to wait for the handler.
        hook_name: Name of the hook (for error messages).
        **kwargs: Keyword arguments to pass to the handler.

    Returns:
        The return value from the handler.

    Raises:
        HookTimeoutError: If the handler exceeds the timeout.
        HookInvocationError: If the handler raises an exception.
    """
    try:
        if _iscoroutinefunction(handler):
            # Handler is async - await it directly
            coro = handler(*args, **kwargs)
        else:
            # Handler is sync - run in thread pool to avoid blocking
            coro = asyncio.to_thread(handler, *args, **kwargs)

        # Apply timeout
        result = await asyncio.wait_for(coro, timeout=timeout)
        return result

    except asyncio.TimeoutError:
        raise HookTimeoutError(hook_name, timeout)
    except HookTimeoutError:
        # Re-raise our own timeout errors
        raise
    except Exception as e:
        raise HookInvocationError(hook_name, e)


def convert_hook_error_to_grpc_status(
    error: BaseException,
) -> Tuple[grpc.StatusCode, str]:
    """
    Convert a hook error to gRPC status code and details.

    This function maps Python exceptions to appropriate gRPC status codes
    for consistent error handling across the plugin boundary.

    Args:
        error: The exception raised by the hook handler.

    Returns:
        Tuple of (status_code, details_string).
    """
    if isinstance(error, HookTimeoutError):
        return (
            grpc.StatusCode.DEADLINE_EXCEEDED,
            f"Hook execution timed out: {error}",
        )

    if isinstance(error, HookInvocationError):
        original = error.original_error

        # Map common exception types to gRPC codes
        if isinstance(original, ValueError):
            return (
                grpc.StatusCode.INVALID_ARGUMENT,
                f"Invalid argument in hook: {original}",
            )
        if isinstance(original, PermissionError):
            return (
                grpc.StatusCode.PERMISSION_DENIED,
                f"Permission denied in hook: {original}",
            )
        if isinstance(original, FileNotFoundError):
            return (
                grpc.StatusCode.NOT_FOUND,
                f"Resource not found in hook: {original}",
            )
        if isinstance(original, NotImplementedError):
            return (
                grpc.StatusCode.UNIMPLEMENTED,
                f"Not implemented: {original}",
            )

        # Default: internal error
        return (
            grpc.StatusCode.INTERNAL,
            f"Hook execution failed: {original}",
        )

    # Unknown error type
    return (
        grpc.StatusCode.INTERNAL,
        f"Unexpected error: {error}",
    )


async def invoke_hook_safe(
    handler: Optional[Callable[..., T]],
    *args: Any,
    timeout: float = DEFAULT_HOOK_TIMEOUT,
    hook_name: str = "unknown",
    default: Optional[T] = None,
    context: Optional[grpc.ServicerContext] = None,
    **kwargs: Any,
) -> Tuple[Optional[T], Optional[BaseException]]:
    """
    Safely invoke a hook handler, catching and logging exceptions.

    This is a convenience wrapper around run_hook_async that catches
    exceptions and optionally sets gRPC error status.

    Args:
        handler: The hook handler callable, or None if not implemented.
        *args: Positional arguments to pass to the handler.
        timeout: Maximum time in seconds to wait for the handler.
        hook_name: Name of the hook (for logging).
        default: Default value to return if handler is None or fails.
        context: Optional gRPC servicer context for setting error status.
        **kwargs: Keyword arguments to pass to the handler.

    Returns:
        Tuple of (result, error) where:
        - result is the handler return value, or default on failure/not implemented
        - error is the exception if one occurred, or None on success
    """
    if handler is None:
        return (default, None)

    try:
        result = await run_hook_async(
            handler,
            *args,
            timeout=timeout,
            hook_name=hook_name,
            **kwargs,
        )
        return (result, None)

    except (HookTimeoutError, HookInvocationError) as e:
        logger.exception(f"Hook '{hook_name}' failed")

        if context is not None:
            status_code, details = convert_hook_error_to_grpc_status(e)
            context.set_code(status_code)
            context.set_details(details)

        return (default, e)

    except Exception as e:
        # Unexpected error
        logger.exception(f"Unexpected error in hook '{hook_name}'")

        if context is not None:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Unexpected error: {e}")

        return (default, e)


class HookRunner:
    """
    Runner class for invoking plugin hooks with configured defaults.

    This class encapsulates hook invocation logic with configurable
    timeout and logging settings.

    Usage:
        runner = HookRunner(timeout=30.0)

        async def servicer_method(self, request, context):
            result, error = await runner.invoke(
                self.plugin.get_hook_handler("OnActivate"),
                hook_name="OnActivate",
                context=context,
            )
            if error:
                return OnActivateResponse(error=to_app_error(error))
            return OnActivateResponse()
    """

    def __init__(
        self,
        timeout: float = DEFAULT_HOOK_TIMEOUT,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        """
        Initialize the hook runner.

        Args:
            timeout: Default timeout for hook invocations.
            logger: Logger instance for hook execution logs.
        """
        self.timeout = timeout
        self.logger = logger or logging.getLogger(__name__)

    async def invoke(
        self,
        handler: Optional[Callable[..., T]],
        *args: Any,
        hook_name: str = "unknown",
        timeout: Optional[float] = None,
        default: Optional[T] = None,
        context: Optional[grpc.ServicerContext] = None,
        **kwargs: Any,
    ) -> Tuple[Optional[T], Optional[BaseException]]:
        """
        Invoke a hook handler safely.

        Args:
            handler: The hook handler callable, or None if not implemented.
            *args: Positional arguments to pass to the handler.
            hook_name: Name of the hook (for logging).
            timeout: Override timeout for this invocation.
            default: Default value to return if handler fails.
            context: Optional gRPC servicer context for setting error status.
            **kwargs: Keyword arguments to pass to the handler.

        Returns:
            Tuple of (result, error).
        """
        effective_timeout = timeout if timeout is not None else self.timeout

        return await invoke_hook_safe(
            handler,
            *args,
            timeout=effective_timeout,
            hook_name=hook_name,
            default=default,
            context=context,
            **kwargs,
        )
