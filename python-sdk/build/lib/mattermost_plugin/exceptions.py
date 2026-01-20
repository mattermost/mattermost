# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Exception hierarchy for the Mattermost Plugin SDK.

This module defines a hierarchy of exceptions that map gRPC status codes
and Mattermost AppError semantics to Python exceptions. The SDK never
exposes raw grpc.RpcError to users - all gRPC errors are converted to
SDK-specific exceptions.

Exception Hierarchy:
    PluginAPIError (base)
    |-- NotFoundError (404, NOT_FOUND)
    |-- PermissionDeniedError (403, PERMISSION_DENIED)
    |-- ValidationError (400, INVALID_ARGUMENT)
    |-- AlreadyExistsError (409, ALREADY_EXISTS)
    |-- UnavailableError (503, UNAVAILABLE)
"""

from __future__ import annotations

from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    import grpc


class PluginAPIError(Exception):
    """
    Base exception for all Plugin API errors.

    All exceptions raised by the Mattermost Plugin SDK inherit from this class.
    Users can catch this exception to handle any SDK error.

    Attributes:
        message: Human-readable error message.
        code: Optional gRPC status code (grpc.StatusCode).
        error_id: Mattermost error ID (e.g., "api.user.get.not_found.app_error").
        status_code: HTTP status code from Mattermost (e.g., 404).
        detailed_error: Internal error details for debugging.
        where: The function/method where the error originated.
        params: Optional parameters for error message interpolation.
    """

    def __init__(
        self,
        message: str,
        *,
        code: Optional["grpc.StatusCode"] = None,
        error_id: Optional[str] = None,
        status_code: Optional[int] = None,
        detailed_error: Optional[str] = None,
        where: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.error_id = error_id
        self.status_code = status_code
        self.detailed_error = detailed_error
        self.where = where
        self.params = params or {}

    def __str__(self) -> str:
        """Return a human-readable string representation."""
        parts = [self.message]
        if self.error_id:
            parts.append(f"[{self.error_id}]")
        if self.status_code:
            parts.append(f"(HTTP {self.status_code})")
        return " ".join(parts)

    def __repr__(self) -> str:
        """Return a detailed string representation for debugging."""
        return (
            f"{self.__class__.__name__}("
            f"message={self.message!r}, "
            f"error_id={self.error_id!r}, "
            f"status_code={self.status_code!r}, "
            f"code={self.code!r})"
        )


class NotFoundError(PluginAPIError):
    """
    Raised when a requested resource is not found.

    Corresponds to HTTP 404 and gRPC NOT_FOUND status code.

    Examples:
        - User with given ID does not exist
        - Channel not found
        - Post not found
    """

    pass


class PermissionDeniedError(PluginAPIError):
    """
    Raised when the operation is not permitted.

    Corresponds to HTTP 403 and gRPC PERMISSION_DENIED status code.

    Examples:
        - User does not have permission to view channel
        - Plugin does not have required capability
        - Access denied to configuration
    """

    pass


class ValidationError(PluginAPIError):
    """
    Raised when input validation fails.

    Corresponds to HTTP 400 and gRPC INVALID_ARGUMENT status code.

    Examples:
        - Invalid email format
        - Required field missing
        - Value out of allowed range
    """

    pass


class AlreadyExistsError(PluginAPIError):
    """
    Raised when attempting to create a resource that already exists.

    Corresponds to HTTP 409 and gRPC ALREADY_EXISTS status code.

    Examples:
        - Username already taken
        - Channel with that name already exists
        - Duplicate key in KV store
    """

    pass


class UnavailableError(PluginAPIError):
    """
    Raised when the service is temporarily unavailable.

    Corresponds to HTTP 503 and gRPC UNAVAILABLE status code.

    Examples:
        - Server is starting up
        - Database connection lost
        - Rate limited
    """

    pass


def convert_grpc_error(error: "grpc.RpcError") -> PluginAPIError:
    """
    Convert a gRPC error to an SDK exception.

    This function examines the gRPC status code and error details to
    determine the appropriate SDK exception type. It extracts any
    Mattermost-specific error information from the error details.

    Args:
        error: The gRPC RpcError to convert.

    Returns:
        An appropriate PluginAPIError subclass.

    Example:
        >>> try:
        ...     response = stub.GetUser(request)
        ... except grpc.RpcError as e:
        ...     raise convert_grpc_error(e)
    """
    import grpc

    code = error.code()
    details = error.details() or ""

    # Map gRPC status codes to SDK exceptions
    if code == grpc.StatusCode.NOT_FOUND:
        return NotFoundError(details, code=code)

    elif code == grpc.StatusCode.PERMISSION_DENIED:
        return PermissionDeniedError(details, code=code)

    elif code == grpc.StatusCode.INVALID_ARGUMENT:
        return ValidationError(details, code=code)

    elif code == grpc.StatusCode.ALREADY_EXISTS:
        return AlreadyExistsError(details, code=code)

    elif code == grpc.StatusCode.UNAVAILABLE:
        return UnavailableError(details, code=code)

    elif code == grpc.StatusCode.DEADLINE_EXCEEDED:
        return UnavailableError(f"Request timed out: {details}", code=code)

    elif code == grpc.StatusCode.UNAUTHENTICATED:
        return PermissionDeniedError(f"Not authenticated: {details}", code=code)

    elif code == grpc.StatusCode.RESOURCE_EXHAUSTED:
        return UnavailableError(f"Resource exhausted: {details}", code=code)

    elif code == grpc.StatusCode.FAILED_PRECONDITION:
        return ValidationError(f"Precondition failed: {details}", code=code)

    elif code == grpc.StatusCode.ABORTED:
        return PluginAPIError(f"Operation aborted: {details}", code=code)

    elif code == grpc.StatusCode.OUT_OF_RANGE:
        return ValidationError(f"Value out of range: {details}", code=code)

    elif code == grpc.StatusCode.UNIMPLEMENTED:
        return PluginAPIError(f"Method not implemented: {details}", code=code)

    elif code == grpc.StatusCode.INTERNAL:
        return PluginAPIError(f"Internal server error: {details}", code=code)

    elif code == grpc.StatusCode.DATA_LOSS:
        return PluginAPIError(f"Data loss: {details}", code=code)

    elif code == grpc.StatusCode.CANCELLED:
        return PluginAPIError(f"Operation cancelled: {details}", code=code)

    elif code == grpc.StatusCode.UNKNOWN:
        return PluginAPIError(f"Unknown error: {details}", code=code)

    else:
        # Fallback for any other status codes
        return PluginAPIError(f"API error: {details}", code=code)


def convert_app_error(app_error: Any) -> PluginAPIError:
    """
    Convert a Mattermost AppError (from protobuf) to an SDK exception.

    This function extracts error information from the AppError protobuf
    message and creates an appropriate SDK exception based on the HTTP
    status code.

    Args:
        app_error: The AppError protobuf message.

    Returns:
        An appropriate PluginAPIError subclass.
    """
    # Extract fields from AppError protobuf message
    error_id = getattr(app_error, "id", "")
    message = getattr(app_error, "message", "Unknown error")
    detailed_error = getattr(app_error, "detailed_error", "")
    status_code = getattr(app_error, "status_code", 500)
    where = getattr(app_error, "where", "")

    # Extract params if present (it's a google.protobuf.Struct)
    params: Dict[str, Any] = {}
    if hasattr(app_error, "params") and app_error.params:
        try:
            # Convert Struct to dict
            from google.protobuf.json_format import MessageToDict
            params = MessageToDict(app_error.params)
        except Exception:
            pass

    # Common kwargs for all exception types
    kwargs = {
        "error_id": error_id,
        "status_code": status_code,
        "detailed_error": detailed_error,
        "where": where,
        "params": params,
    }

    # Map HTTP status codes to SDK exceptions
    if status_code == 404:
        return NotFoundError(message, **kwargs)

    elif status_code == 403:
        return PermissionDeniedError(message, **kwargs)

    elif status_code == 400:
        return ValidationError(message, **kwargs)

    elif status_code == 409:
        return AlreadyExistsError(message, **kwargs)

    elif status_code == 503 or status_code == 429:
        return UnavailableError(message, **kwargs)

    elif status_code == 401:
        return PermissionDeniedError(message, **kwargs)

    else:
        return PluginAPIError(message, **kwargs)
