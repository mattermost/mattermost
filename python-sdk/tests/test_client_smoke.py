# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Smoke tests for the PluginAPIClient.

These tests verify that:
1. Client can be created and used as context manager
2. Client properly connects and disconnects
3. Error mapping from gRPC errors to SDK exceptions works
4. AppError to SDK exception conversion works
"""

from concurrent import futures
from typing import Any, Iterator
import threading

import grpc
import pytest

from mattermost_plugin import (
    PluginAPIClient,
    AsyncPluginAPIClient,
    PluginAPIError,
    NotFoundError,
    PermissionDeniedError,
    convert_grpc_error,
)
from mattermost_plugin.exceptions import convert_app_error
from mattermost_plugin.grpc import api_pb2_grpc, api_remaining_pb2, common_pb2


class FakePluginAPIServicer(api_pb2_grpc.PluginAPIServicer):
    """Fake gRPC server for testing the client."""

    def __init__(self) -> None:
        self.server_version = "9.5.0-test"
        self.install_date = 1704067200000  # Jan 1, 2024
        self.diagnostic_id = "test-diagnostic-id-123"
        self._should_fail = False
        self._fail_code = grpc.StatusCode.UNKNOWN
        self._fail_message = ""
        self._should_return_app_error = False
        self._app_error: Any = None

    def set_should_fail(
        self, code: grpc.StatusCode = grpc.StatusCode.UNKNOWN, message: str = ""
    ) -> None:
        """Configure the servicer to fail requests with a gRPC error."""
        self._should_fail = True
        self._fail_code = code
        self._fail_message = message

    def set_should_return_app_error(self, error_id: str, message: str, status_code: int) -> None:
        """Configure the servicer to return an AppError in the response."""
        self._should_return_app_error = True
        self._app_error = common_pb2.AppError(
            id=error_id,
            message=message,
            status_code=status_code,
        )

    def reset(self) -> None:
        """Reset the servicer to default state."""
        self._should_fail = False
        self._should_return_app_error = False
        self._app_error = None

    def GetServerVersion(
        self, request: api_remaining_pb2.GetServerVersionRequest, context: grpc.ServicerContext
    ) -> api_remaining_pb2.GetServerVersionResponse:
        if self._should_fail:
            context.abort(self._fail_code, self._fail_message)
            return api_remaining_pb2.GetServerVersionResponse()  # Never reached

        if self._should_return_app_error:
            return api_remaining_pb2.GetServerVersionResponse(error=self._app_error)

        return api_remaining_pb2.GetServerVersionResponse(version=self.server_version)

    def GetSystemInstallDate(
        self, request: api_remaining_pb2.GetSystemInstallDateRequest, context: grpc.ServicerContext
    ) -> api_remaining_pb2.GetSystemInstallDateResponse:
        if self._should_fail:
            context.abort(self._fail_code, self._fail_message)
            return api_remaining_pb2.GetSystemInstallDateResponse()

        return api_remaining_pb2.GetSystemInstallDateResponse(install_date=self.install_date)

    def GetDiagnosticId(
        self, request: api_remaining_pb2.GetDiagnosticIdRequest, context: grpc.ServicerContext
    ) -> api_remaining_pb2.GetDiagnosticIdResponse:
        if self._should_fail:
            context.abort(self._fail_code, self._fail_message)
            return api_remaining_pb2.GetDiagnosticIdResponse()

        return api_remaining_pb2.GetDiagnosticIdResponse(diagnostic_id=self.diagnostic_id)


@pytest.fixture
def fake_server() -> Iterator[tuple[str, FakePluginAPIServicer]]:
    """Start a fake gRPC server and yield its address."""
    servicer = FakePluginAPIServicer()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    api_pb2_grpc.add_PluginAPIServicer_to_server(servicer, server)

    # Use port 0 to get a free port
    port = server.add_insecure_port("[::]:0")
    server.start()

    target = f"localhost:{port}"

    try:
        yield target, servicer
    finally:
        server.stop(grace=0.5)


class TestPluginAPIClient:
    """Tests for the synchronous PluginAPIClient."""

    def test_context_manager_connects_and_disconnects(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that context manager properly manages connection."""
        target, _ = fake_server

        client = PluginAPIClient(target=target)
        assert not client.connected

        with client:
            assert client.connected

        assert not client.connected

    def test_manual_connect_and_close(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test manual connect/close lifecycle."""
        target, _ = fake_server

        client = PluginAPIClient(target=target)
        assert not client.connected

        client.connect()
        assert client.connected

        client.close()
        assert not client.connected

        # Close is idempotent
        client.close()
        assert not client.connected

    def test_double_connect_raises_error(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that connecting twice raises an error."""
        target, _ = fake_server

        client = PluginAPIClient(target=target)
        client.connect()

        with pytest.raises(RuntimeError, match="already connected"):
            client.connect()

        client.close()

    def test_call_without_connect_raises_error(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that calling methods without connecting raises an error."""
        target, _ = fake_server

        client = PluginAPIClient(target=target)

        with pytest.raises(RuntimeError, match="not connected"):
            client.get_server_version()

    def test_get_server_version(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test successful get_server_version call."""
        target, servicer = fake_server
        servicer.server_version = "10.0.0-custom"

        with PluginAPIClient(target=target) as client:
            version = client.get_server_version()
            assert version == "10.0.0-custom"

    def test_get_system_install_date(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test successful get_system_install_date call."""
        target, servicer = fake_server
        servicer.install_date = 1234567890000

        with PluginAPIClient(target=target) as client:
            install_date = client.get_system_install_date()
            assert install_date == 1234567890000

    def test_get_diagnostic_id(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test successful get_diagnostic_id call."""
        target, servicer = fake_server
        servicer.diagnostic_id = "unique-id-456"

        with PluginAPIClient(target=target) as client:
            diagnostic_id = client.get_diagnostic_id()
            assert diagnostic_id == "unique-id-456"

    def test_target_property(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that target property returns the server address."""
        target, _ = fake_server

        client = PluginAPIClient(target=target)
        assert client.target == target


class TestErrorMapping:
    """Tests for gRPC error to SDK exception mapping."""

    def test_not_found_error(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that NOT_FOUND status maps to NotFoundError."""
        target, servicer = fake_server
        servicer.set_should_fail(grpc.StatusCode.NOT_FOUND, "User not found")

        with PluginAPIClient(target=target) as client:
            with pytest.raises(NotFoundError) as exc_info:
                client.get_server_version()

            assert "User not found" in str(exc_info.value)
            assert exc_info.value.code == grpc.StatusCode.NOT_FOUND

    def test_permission_denied_error(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that PERMISSION_DENIED status maps to PermissionDeniedError."""
        target, servicer = fake_server
        servicer.set_should_fail(grpc.StatusCode.PERMISSION_DENIED, "Access denied")

        with PluginAPIClient(target=target) as client:
            with pytest.raises(PermissionDeniedError) as exc_info:
                client.get_server_version()

            assert "Access denied" in str(exc_info.value)
            assert exc_info.value.code == grpc.StatusCode.PERMISSION_DENIED

    def test_app_error_in_response(
        self, fake_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that AppError in response is converted to SDK exception."""
        target, servicer = fake_server
        servicer.set_should_return_app_error(
            error_id="api.test.error",
            message="Test error message",
            status_code=400,
        )

        with PluginAPIClient(target=target) as client:
            with pytest.raises(PluginAPIError) as exc_info:
                client.get_server_version()

            assert exc_info.value.error_id == "api.test.error"
            assert exc_info.value.message == "Test error message"
            assert exc_info.value.status_code == 400


class TestConvertGrpcError:
    """Tests for the convert_grpc_error utility function."""

    def test_all_status_codes_are_handled(self) -> None:
        """Test that all gRPC status codes are mapped to exceptions."""
        # Create a mock error for each status code
        import grpc

        status_codes = [
            grpc.StatusCode.OK,
            grpc.StatusCode.CANCELLED,
            grpc.StatusCode.UNKNOWN,
            grpc.StatusCode.INVALID_ARGUMENT,
            grpc.StatusCode.DEADLINE_EXCEEDED,
            grpc.StatusCode.NOT_FOUND,
            grpc.StatusCode.ALREADY_EXISTS,
            grpc.StatusCode.PERMISSION_DENIED,
            grpc.StatusCode.RESOURCE_EXHAUSTED,
            grpc.StatusCode.FAILED_PRECONDITION,
            grpc.StatusCode.ABORTED,
            grpc.StatusCode.OUT_OF_RANGE,
            grpc.StatusCode.UNIMPLEMENTED,
            grpc.StatusCode.INTERNAL,
            grpc.StatusCode.UNAVAILABLE,
            grpc.StatusCode.DATA_LOSS,
            grpc.StatusCode.UNAUTHENTICATED,
        ]

        for code in status_codes:
            # Create a mock RpcError
            class MockRpcError(grpc.RpcError):
                def code(self) -> grpc.StatusCode:
                    return code

                def details(self) -> str:
                    return f"Error with code {code.name}"

            error = MockRpcError()
            result = convert_grpc_error(error)

            # All codes should produce a PluginAPIError (or subclass)
            assert isinstance(result, PluginAPIError)
            assert result.code == code


class TestConvertAppError:
    """Tests for the convert_app_error utility function."""

    def test_convert_404_to_not_found(self) -> None:
        """Test that 404 status converts to NotFoundError."""
        error = common_pb2.AppError(
            id="api.user.get.not_found.app_error",
            message="User not found",
            status_code=404,
        )

        result = convert_app_error(error)

        assert isinstance(result, NotFoundError)
        assert result.error_id == "api.user.get.not_found.app_error"
        assert result.message == "User not found"
        assert result.status_code == 404

    def test_convert_403_to_permission_denied(self) -> None:
        """Test that 403 status converts to PermissionDeniedError."""
        error = common_pb2.AppError(
            id="api.context.permissions.app_error",
            message="Permission denied",
            status_code=403,
        )

        result = convert_app_error(error)

        assert isinstance(result, PermissionDeniedError)
        assert result.status_code == 403

    def test_preserves_all_fields(self) -> None:
        """Test that all AppError fields are preserved in the exception."""
        error = common_pb2.AppError(
            id="api.test.error",
            message="Test message",
            detailed_error="Detailed info",
            status_code=500,
            where="TestFunction",
        )

        result = convert_app_error(error)

        assert result.error_id == "api.test.error"
        assert result.message == "Test message"
        assert result.detailed_error == "Detailed info"
        assert result.status_code == 500
        assert result.where == "TestFunction"


class TestExceptionHierarchy:
    """Tests for the exception class hierarchy."""

    def test_all_exceptions_inherit_from_plugin_api_error(self) -> None:
        """Test that all SDK exceptions inherit from PluginAPIError."""
        from mattermost_plugin import (
            NotFoundError,
            PermissionDeniedError,
            ValidationError,
            AlreadyExistsError,
            UnavailableError,
        )

        assert issubclass(NotFoundError, PluginAPIError)
        assert issubclass(PermissionDeniedError, PluginAPIError)
        assert issubclass(ValidationError, PluginAPIError)
        assert issubclass(AlreadyExistsError, PluginAPIError)
        assert issubclass(UnavailableError, PluginAPIError)

    def test_exception_str_representation(self) -> None:
        """Test string representation of exceptions."""
        error = PluginAPIError(
            "Something went wrong",
            error_id="api.test.error",
            status_code=500,
        )

        str_repr = str(error)

        assert "Something went wrong" in str_repr
        assert "api.test.error" in str_repr
        assert "500" in str_repr

    def test_exception_repr_representation(self) -> None:
        """Test repr representation of exceptions."""
        error = NotFoundError(
            "User not found",
            error_id="api.user.not_found",
            status_code=404,
        )

        repr_str = repr(error)

        assert "NotFoundError" in repr_str
        assert "User not found" in repr_str
