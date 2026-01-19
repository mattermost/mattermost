# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
File API methods mixin for PluginAPIClient.

This module provides all file-related API methods including:
- File metadata retrieval
- File content retrieval
- File uploads
- File link generation
- Plugin file system access
"""

from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import FileInfo
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class FilesMixin:
    """Mixin providing file-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # File Info
    # =========================================================================

    def get_file_info(self, file_id: str) -> FileInfo:
        """
        Get metadata about a file.

        Args:
            file_id: ID of the file.

        Returns:
            FileInfo with metadata about the file.

        Raises:
            NotFoundError: If file does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.GetFileInfoRequest(file_id=file_id)

        try:
            response = stub.GetFileInfo(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return FileInfo.from_proto(response.file_info)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_file_infos(
        self,
        *,
        page: int = 0,
        per_page: int = 60,
        user_id: str = "",
        channel_id: str = "",
        include_deleted: bool = False,
        sort_by: str = "",
        sort_order: str = "",
    ) -> List[FileInfo]:
        """
        Get file metadata with filtering options.

        Args:
            page: Page number (0-indexed).
            per_page: Results per page (default 60).
            user_id: Filter to files uploaded by this user.
            channel_id: Filter to files in this channel.
            include_deleted: Include deleted files in results.
            sort_by: Field to sort by (e.g., "create_at").
            sort_order: Sort order ("asc" or "desc").

        Returns:
            List of FileInfo objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        options = api_file_bot_pb2.GetFileInfosOptions(
            user_id=user_id,
            channel_id=channel_id,
            include_deleted=include_deleted,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        request = api_file_bot_pb2.GetFileInfosRequest(
            page=page,
            per_page=per_page,
            options=options,
        )

        try:
            response = stub.GetFileInfos(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [FileInfo.from_proto(f) for f in response.file_infos]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def set_file_searchable_content(self, file_id: str, content: str) -> None:
        """
        Set searchable text content for a file.

        This is typically used for extracted text from PDFs, documents, etc.
        to make them searchable.

        Args:
            file_id: ID of the file.
            content: Searchable text content.

        Raises:
            NotFoundError: If file does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.SetFileSearchableContentRequest(
            file_id=file_id,
            content=content,
        )

        try:
            response = stub.SetFileSearchableContent(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # File Content
    # =========================================================================

    def get_file(self, file_id: str) -> bytes:
        """
        Get the content of a file.

        Args:
            file_id: ID of the file.

        Returns:
            File content as bytes.

        Raises:
            NotFoundError: If file does not exist.
            PluginAPIError: If the API call fails.

        Note:
            For large files, consider using streaming in Phase 8.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.GetFileRequest(file_id=file_id)

        try:
            response = stub.GetFile(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.data

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_file_link(self, file_id: str) -> str:
        """
        Get a public link to a file.

        Args:
            file_id: ID of the file.

        Returns:
            URL to access the file.

        Raises:
            NotFoundError: If file does not exist.
            PermissionDeniedError: If public links are not enabled.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.GetFileLinkRequest(file_id=file_id)

        try:
            response = stub.GetFileLink(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.link

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def read_file(self, path: str) -> bytes:
        """
        Read a file from the plugin's data directory.

        This reads files from the plugin's server-side storage location,
        not from the general file storage.

        Args:
            path: Relative path within the plugin's data directory.

        Returns:
            File content as bytes.

        Raises:
            NotFoundError: If file does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.ReadFileRequest(path=path)

        try:
            response = stub.ReadFile(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.data

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # File Uploads
    # =========================================================================

    def upload_file(self, data: bytes, channel_id: str, filename: str) -> FileInfo:
        """
        Upload a file to a channel.

        Args:
            data: File content as bytes.
            channel_id: ID of the channel to upload to.
            filename: Name for the file.

        Returns:
            FileInfo with metadata about the uploaded file.

        Raises:
            ValidationError: If file data or parameters are invalid.
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.

        Note:
            For large files, consider using upload sessions (streaming)
            which will be supported in Phase 8.

        Example:
            >>> with open("document.pdf", "rb") as f:
            ...     data = f.read()
            >>> file_info = client.upload_file(data, "channel123", "document.pdf")
            >>> print(file_info.id)  # File ID for attachment
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.UploadFileRequest(
            data=data,
            channel_id=channel_id,
            filename=filename,
        )

        try:
            response = stub.UploadFile(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return FileInfo.from_proto(response.file_info)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def copy_file_infos(self, user_id: str, file_ids: List[str]) -> List[str]:
        """
        Copy file infos to allow re-attaching to another post.

        This creates new file info records that can be attached to a new post
        while preserving the original files.

        Args:
            user_id: ID of the user who will own the copies.
            file_ids: List of file IDs to copy.

        Returns:
            List of new file IDs.

        Raises:
            NotFoundError: If user or files do not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.CopyFileInfosRequest(
            user_id=user_id,
            file_ids=file_ids,
        )

        try:
            response = stub.CopyFileInfos(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return list(response.file_ids)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
