# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for Post, File, and KV Store API client methods.

This module tests the wrapper types and client method implementations for
Post, File, and KV Store operations.
"""

import pytest
from unittest.mock import MagicMock

import grpc


class TestPostWrapperTypes:
    """Tests for Post-related wrapper dataclasses."""

    def test_post_from_proto_and_to_proto(self):
        """Test Post wrapper round-trip conversion."""
        from mattermost_plugin._internal.wrappers import Post
        from mattermost_plugin.grpc import post_pb2

        # Create a protobuf Post
        proto_post = post_pb2.Post(
            id="post123",
            channel_id="channel123",
            user_id="user123",
            message="Hello, world!",
            create_at=1234567890000,
            update_at=1234567890000,
            is_pinned=True,
            root_id="",
            type="",
            hashtags="#test",
        )
        proto_post.file_ids.append("file1")
        proto_post.file_ids.append("file2")

        # Convert to wrapper
        post = Post.from_proto(proto_post)

        # Verify fields
        assert post.id == "post123"
        assert post.channel_id == "channel123"
        assert post.user_id == "user123"
        assert post.message == "Hello, world!"
        assert post.create_at == 1234567890000
        assert post.is_pinned is True
        assert post.hashtags == "#test"
        assert post.file_ids == ["file1", "file2"]

        # Convert back to proto
        proto_back = post.to_proto()

        # Verify round-trip
        assert proto_back.id == proto_post.id
        assert proto_back.channel_id == proto_post.channel_id
        assert proto_back.message == proto_post.message
        assert list(proto_back.file_ids) == ["file1", "file2"]

    def test_reaction_from_proto_and_to_proto(self):
        """Test Reaction wrapper round-trip conversion."""
        from mattermost_plugin._internal.wrappers import Reaction
        from mattermost_plugin.grpc import post_pb2

        # Create a protobuf Reaction
        proto_reaction = post_pb2.Reaction(
            user_id="user123",
            post_id="post123",
            emoji_name="thumbsup",
            create_at=1234567890000,
        )

        # Convert to wrapper
        reaction = Reaction.from_proto(proto_reaction)

        # Verify fields
        assert reaction.user_id == "user123"
        assert reaction.post_id == "post123"
        assert reaction.emoji_name == "thumbsup"
        assert reaction.create_at == 1234567890000

        # Convert back to proto
        proto_back = reaction.to_proto()

        # Verify round-trip
        assert proto_back.user_id == proto_reaction.user_id
        assert proto_back.post_id == proto_reaction.post_id
        assert proto_back.emoji_name == proto_reaction.emoji_name

    def test_post_list_from_proto(self):
        """Test PostList wrapper conversion."""
        from mattermost_plugin._internal.wrappers import PostList
        from mattermost_plugin.grpc import post_pb2

        # Create a protobuf PostList
        proto_post_list = post_pb2.PostList(
            next_post_id="next123",
            prev_post_id="prev123",
            has_next=True,
        )
        proto_post_list.order.append("post1")
        proto_post_list.order.append("post2")

        post1 = post_pb2.Post(id="post1", channel_id="ch1", message="First")
        post2 = post_pb2.Post(id="post2", channel_id="ch1", message="Second")
        proto_post_list.posts["post1"].CopyFrom(post1)
        proto_post_list.posts["post2"].CopyFrom(post2)

        # Convert to wrapper
        post_list = PostList.from_proto(proto_post_list)

        # Verify fields
        assert post_list.order == ["post1", "post2"]
        assert len(post_list.posts) == 2
        assert post_list.posts["post1"].message == "First"
        assert post_list.posts["post2"].message == "Second"
        assert post_list.next_post_id == "next123"
        assert post_list.has_next is True


class TestFileWrapperTypes:
    """Tests for File-related wrapper dataclasses."""

    def test_file_info_from_proto(self):
        """Test FileInfo wrapper conversion."""
        from mattermost_plugin._internal.wrappers import FileInfo
        from mattermost_plugin.grpc import file_pb2

        # Create a protobuf FileInfo
        proto_file_info = file_pb2.FileInfo(
            id="file123",
            creator_id="user123",
            post_id="post123",
            channel_id="channel123",
            create_at=1234567890000,
            name="document.pdf",
            extension="pdf",
            size=1024000,
            mime_type="application/pdf",
            width=0,
            height=0,
            has_preview_image=False,
        )

        # Convert to wrapper
        file_info = FileInfo.from_proto(proto_file_info)

        # Verify fields
        assert file_info.id == "file123"
        assert file_info.creator_id == "user123"
        assert file_info.post_id == "post123"
        assert file_info.name == "document.pdf"
        assert file_info.extension == "pdf"
        assert file_info.size == 1024000
        assert file_info.mime_type == "application/pdf"

    def test_upload_session_from_proto_and_to_proto(self):
        """Test UploadSession wrapper round-trip conversion."""
        from mattermost_plugin._internal.wrappers import UploadSession
        from mattermost_plugin.grpc import api_file_bot_pb2

        # Create a protobuf UploadSession
        proto_session = api_file_bot_pb2.UploadSession(
            id="session123",
            type="attachment",
            user_id="user123",
            channel_id="channel123",
            filename="large_file.zip",
            file_size=10485760,
            file_offset=5242880,
        )

        # Convert to wrapper
        session = UploadSession.from_proto(proto_session)

        # Verify fields
        assert session.id == "session123"
        assert session.type == "attachment"
        assert session.user_id == "user123"
        assert session.filename == "large_file.zip"
        assert session.file_size == 10485760
        assert session.file_offset == 5242880

        # Convert back to proto
        proto_back = session.to_proto()

        # Verify round-trip
        assert proto_back.id == proto_session.id
        assert proto_back.filename == proto_session.filename


class TestKVWrapperTypes:
    """Tests for KV Store related wrapper types."""

    def test_plugin_kv_set_options_to_proto(self):
        """Test PluginKVSetOptions wrapper conversion."""
        from mattermost_plugin._internal.wrappers import PluginKVSetOptions

        # Create options
        options = PluginKVSetOptions(
            atomic=True,
            old_value=b"old_data",
            expire_in_seconds=3600,
        )

        # Convert to proto
        proto = options.to_proto()

        # Verify
        assert proto.atomic is True
        assert proto.old_value == b"old_data"
        assert proto.expire_in_seconds == 3600


class TestClientPostMethods:
    """Tests for Post-related client methods."""

    @pytest.fixture
    def mock_client(self):
        """Create a mocked client for testing."""
        from mattermost_plugin.client import PluginAPIClient

        client = PluginAPIClient(target="localhost:50051")
        client._stub = MagicMock()
        client._channel = MagicMock()
        return client

    def test_create_post_success(self, mock_client):
        """Test create_post with successful response."""
        from mattermost_plugin._internal.wrappers import Post
        from mattermost_plugin.grpc import api_channel_post_pb2, post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.CreatePostResponse()
        mock_response.post.CopyFrom(post_pb2.Post(
            id="newpost123",
            channel_id="channel123",
            user_id="user123",
            message="Hello!",
            create_at=1234567890000,
        ))
        mock_client._stub.CreatePost.return_value = mock_response

        # Create a post
        post_to_create = Post(id="", channel_id="channel123", message="Hello!")
        created_post = mock_client.create_post(post_to_create)

        # Verify
        assert created_post.id == "newpost123"
        assert created_post.channel_id == "channel123"
        assert created_post.message == "Hello!"

    def test_get_post_success(self, mock_client):
        """Test get_post with successful response."""
        from mattermost_plugin.grpc import api_channel_post_pb2, post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.GetPostResponse()
        mock_response.post.CopyFrom(post_pb2.Post(
            id="post123",
            channel_id="channel123",
            message="Test message",
        ))
        mock_client._stub.GetPost.return_value = mock_response

        # Get the post
        post = mock_client.get_post("post123")

        # Verify
        assert post.id == "post123"
        assert post.message == "Test message"

    def test_get_post_not_found(self, mock_client):
        """Test get_post when post is not found."""
        from mattermost_plugin.grpc import api_channel_post_pb2, common_pb2
        from mattermost_plugin.exceptions import NotFoundError

        # Mock the response with error
        mock_response = api_channel_post_pb2.GetPostResponse()
        mock_response.error.CopyFrom(common_pb2.AppError(
            id="api.post.get.not_found.app_error",
            message="Post not found",
            status_code=404,
        ))
        mock_client._stub.GetPost.return_value = mock_response

        # Call the method and expect exception
        with pytest.raises(NotFoundError) as exc_info:
            mock_client.get_post("nonexistent")

        assert "Post not found" in str(exc_info.value)

    def test_update_post_success(self, mock_client):
        """Test update_post with successful response."""
        from mattermost_plugin._internal.wrappers import Post
        from mattermost_plugin.grpc import api_channel_post_pb2, post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.UpdatePostResponse()
        mock_response.post.CopyFrom(post_pb2.Post(
            id="post123",
            channel_id="channel123",
            message="Updated message",
            edit_at=1234567890001,
        ))
        mock_client._stub.UpdatePost.return_value = mock_response

        # Update the post
        post_to_update = Post(id="post123", channel_id="channel123", message="Updated message")
        updated_post = mock_client.update_post(post_to_update)

        # Verify
        assert updated_post.message == "Updated message"
        assert updated_post.edit_at == 1234567890001

    def test_delete_post_success(self, mock_client):
        """Test delete_post with successful response."""
        from mattermost_plugin.grpc import api_channel_post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.DeletePostResponse()
        mock_client._stub.DeletePost.return_value = mock_response

        # Delete should not raise
        mock_client.delete_post("post123")

        # Verify the request was made
        mock_client._stub.DeletePost.assert_called_once()

    def test_send_ephemeral_post(self, mock_client):
        """Test send_ephemeral_post."""
        from mattermost_plugin._internal.wrappers import Post
        from mattermost_plugin.grpc import api_channel_post_pb2, post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.SendEphemeralPostResponse()
        mock_response.post.CopyFrom(post_pb2.Post(
            id="ephemeral123",
            channel_id="channel123",
            message="Only you can see this!",
        ))
        mock_client._stub.SendEphemeralPost.return_value = mock_response

        # Send ephemeral post
        post = Post(id="", channel_id="channel123", message="Only you can see this!")
        result = mock_client.send_ephemeral_post("user123", post)

        # Verify
        assert result.id == "ephemeral123"
        assert result.message == "Only you can see this!"

    def test_add_reaction(self, mock_client):
        """Test add_reaction."""
        from mattermost_plugin._internal.wrappers import Reaction
        from mattermost_plugin.grpc import api_channel_post_pb2, post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.AddReactionResponse()
        mock_response.reaction.CopyFrom(post_pb2.Reaction(
            user_id="user123",
            post_id="post123",
            emoji_name="thumbsup",
            create_at=1234567890000,
        ))
        mock_client._stub.AddReaction.return_value = mock_response

        # Add reaction
        reaction = Reaction(user_id="user123", post_id="post123", emoji_name="thumbsup")
        result = mock_client.add_reaction(reaction)

        # Verify
        assert result.emoji_name == "thumbsup"
        assert result.user_id == "user123"

    def test_get_reactions(self, mock_client):
        """Test get_reactions."""
        from mattermost_plugin.grpc import api_channel_post_pb2, post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.GetReactionsResponse()
        mock_response.reactions.append(post_pb2.Reaction(
            user_id="user1",
            post_id="post123",
            emoji_name="thumbsup",
        ))
        mock_response.reactions.append(post_pb2.Reaction(
            user_id="user2",
            post_id="post123",
            emoji_name="heart",
        ))
        mock_client._stub.GetReactions.return_value = mock_response

        # Get reactions
        reactions = mock_client.get_reactions("post123")

        # Verify
        assert len(reactions) == 2
        assert reactions[0].emoji_name == "thumbsup"
        assert reactions[1].emoji_name == "heart"

    def test_get_post_thread(self, mock_client):
        """Test get_post_thread."""
        from mattermost_plugin.grpc import api_channel_post_pb2, post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.GetPostThreadResponse()
        mock_response.post_list.order.append("root")
        mock_response.post_list.order.append("reply1")
        mock_response.post_list.posts["root"].CopyFrom(post_pb2.Post(
            id="root",
            channel_id="ch1",
            message="Root post",
        ))
        mock_response.post_list.posts["reply1"].CopyFrom(post_pb2.Post(
            id="reply1",
            channel_id="ch1",
            message="Reply",
            root_id="root",
        ))
        mock_client._stub.GetPostThread.return_value = mock_response

        # Get thread
        post_list = mock_client.get_post_thread("root")

        # Verify
        assert len(post_list.order) == 2
        assert "root" in post_list.posts
        assert "reply1" in post_list.posts


class TestClientFileMethods:
    """Tests for File-related client methods."""

    @pytest.fixture
    def mock_client(self):
        """Create a mocked client for testing."""
        from mattermost_plugin.client import PluginAPIClient

        client = PluginAPIClient(target="localhost:50051")
        client._stub = MagicMock()
        client._channel = MagicMock()
        return client

    def test_get_file_info_success(self, mock_client):
        """Test get_file_info with successful response."""
        from mattermost_plugin.grpc import api_file_bot_pb2, file_pb2

        # Mock the response
        mock_response = api_file_bot_pb2.GetFileInfoResponse()
        mock_response.file_info.CopyFrom(file_pb2.FileInfo(
            id="file123",
            name="document.pdf",
            extension="pdf",
            size=1024000,
            mime_type="application/pdf",
        ))
        mock_client._stub.GetFileInfo.return_value = mock_response

        # Get file info
        file_info = mock_client.get_file_info("file123")

        # Verify
        assert file_info.id == "file123"
        assert file_info.name == "document.pdf"
        assert file_info.size == 1024000

    def test_get_file_info_not_found(self, mock_client):
        """Test get_file_info when file is not found."""
        from mattermost_plugin.grpc import api_file_bot_pb2, common_pb2
        from mattermost_plugin.exceptions import NotFoundError

        # Mock the response with error
        mock_response = api_file_bot_pb2.GetFileInfoResponse()
        mock_response.error.CopyFrom(common_pb2.AppError(
            id="api.file.get_info.not_found.app_error",
            message="File not found",
            status_code=404,
        ))
        mock_client._stub.GetFileInfo.return_value = mock_response

        # Call the method and expect exception
        with pytest.raises(NotFoundError):
            mock_client.get_file_info("nonexistent")

    def test_get_file_success(self, mock_client):
        """Test get_file with successful response."""
        from mattermost_plugin.grpc import api_file_bot_pb2

        # Mock the response
        mock_response = api_file_bot_pb2.GetFileResponse()
        mock_response.data = b"file content data"
        mock_client._stub.GetFile.return_value = mock_response

        # Get file
        data = mock_client.get_file("file123")

        # Verify
        assert data == b"file content data"

    def test_upload_file_success(self, mock_client):
        """Test upload_file with successful response."""
        from mattermost_plugin.grpc import api_file_bot_pb2, file_pb2

        # Mock the response
        mock_response = api_file_bot_pb2.UploadFileResponse()
        mock_response.file_info.CopyFrom(file_pb2.FileInfo(
            id="newfile123",
            name="test.txt",
            extension="txt",
            size=100,
            mime_type="text/plain",
        ))
        mock_client._stub.UploadFile.return_value = mock_response

        # Upload file
        file_info = mock_client.upload_file(b"test content", "channel123", "test.txt")

        # Verify
        assert file_info.id == "newfile123"
        assert file_info.name == "test.txt"

    def test_get_file_link_success(self, mock_client):
        """Test get_file_link with successful response."""
        from mattermost_plugin.grpc import api_file_bot_pb2

        # Mock the response
        mock_response = api_file_bot_pb2.GetFileLinkResponse()
        mock_response.link = "https://example.com/files/file123"
        mock_client._stub.GetFileLink.return_value = mock_response

        # Get file link
        link = mock_client.get_file_link("file123")

        # Verify
        assert link == "https://example.com/files/file123"

    def test_copy_file_infos_success(self, mock_client):
        """Test copy_file_infos with successful response."""
        from mattermost_plugin.grpc import api_file_bot_pb2

        # Mock the response
        mock_response = api_file_bot_pb2.CopyFileInfosResponse()
        mock_response.file_ids.append("newfile1")
        mock_response.file_ids.append("newfile2")
        mock_client._stub.CopyFileInfos.return_value = mock_response

        # Copy file infos
        new_ids = mock_client.copy_file_infos("user123", ["file1", "file2"])

        # Verify
        assert new_ids == ["newfile1", "newfile2"]


class TestClientKVStoreMethods:
    """Tests for KV Store related client methods."""

    @pytest.fixture
    def mock_client(self):
        """Create a mocked client for testing."""
        from mattermost_plugin.client import PluginAPIClient

        client = PluginAPIClient(target="localhost:50051")
        client._stub = MagicMock()
        client._channel = MagicMock()
        return client

    def test_kv_set_success(self, mock_client):
        """Test kv_set with successful response."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVSetResponse()
        mock_client._stub.KVSet.return_value = mock_response

        # Set should not raise
        mock_client.kv_set("mykey", b"myvalue")

        # Verify the request was made correctly
        mock_client._stub.KVSet.assert_called_once()
        call_args = mock_client._stub.KVSet.call_args
        assert call_args[0][0].key == "mykey"
        assert call_args[0][0].value == b"myvalue"

    def test_kv_get_success(self, mock_client):
        """Test kv_get with successful response."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVGetResponse()
        mock_response.value = b"stored_value"
        mock_client._stub.KVGet.return_value = mock_response

        # Get value
        value = mock_client.kv_get("mykey")

        # Verify
        assert value == b"stored_value"

    def test_kv_get_not_found(self, mock_client):
        """Test kv_get when key does not exist."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response with empty value
        mock_response = api_kv_config_pb2.KVGetResponse()
        mock_response.value = b""
        mock_client._stub.KVGet.return_value = mock_response

        # Get value
        value = mock_client.kv_get("nonexistent")

        # Verify
        assert value is None

    def test_kv_delete_success(self, mock_client):
        """Test kv_delete with successful response."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVDeleteResponse()
        mock_client._stub.KVDelete.return_value = mock_response

        # Delete should not raise
        mock_client.kv_delete("mykey")

        # Verify
        mock_client._stub.KVDelete.assert_called_once()

    def test_kv_delete_all_success(self, mock_client):
        """Test kv_delete_all with successful response."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVDeleteAllResponse()
        mock_client._stub.KVDeleteAll.return_value = mock_response

        # Delete all should not raise
        mock_client.kv_delete_all()

        # Verify
        mock_client._stub.KVDeleteAll.assert_called_once()

    def test_kv_list_success(self, mock_client):
        """Test kv_list with successful response."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVListResponse()
        mock_response.keys.append("key1")
        mock_response.keys.append("key2")
        mock_response.keys.append("key3")
        mock_client._stub.KVList.return_value = mock_response

        # List keys
        keys = mock_client.kv_list()

        # Verify
        assert keys == ["key1", "key2", "key3"]

    def test_kv_set_with_expiry_success(self, mock_client):
        """Test kv_set_with_expiry with successful response."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVSetWithExpiryResponse()
        mock_client._stub.KVSetWithExpiry.return_value = mock_response

        # Set with expiry should not raise
        mock_client.kv_set_with_expiry("cache_key", b"data", 300)

        # Verify the request
        call_args = mock_client._stub.KVSetWithExpiry.call_args
        assert call_args[0][0].key == "cache_key"
        assert call_args[0][0].expire_in_seconds == 300

    def test_kv_compare_and_set_success(self, mock_client):
        """Test kv_compare_and_set with successful response."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVCompareAndSetResponse()
        mock_response.success = True
        mock_client._stub.KVCompareAndSet.return_value = mock_response

        # Compare and set
        result = mock_client.kv_compare_and_set("mykey", b"old", b"new")

        # Verify
        assert result is True

    def test_kv_compare_and_set_conflict(self, mock_client):
        """Test kv_compare_and_set when value doesn't match."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVCompareAndSetResponse()
        mock_response.success = False
        mock_client._stub.KVCompareAndSet.return_value = mock_response

        # Compare and set with conflict
        result = mock_client.kv_compare_and_set("mykey", b"wrong_old", b"new")

        # Verify
        assert result is False

    def test_kv_compare_and_delete_success(self, mock_client):
        """Test kv_compare_and_delete with successful response."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVCompareAndDeleteResponse()
        mock_response.success = True
        mock_client._stub.KVCompareAndDelete.return_value = mock_response

        # Compare and delete
        result = mock_client.kv_compare_and_delete("mykey", b"expected_value")

        # Verify
        assert result is True

    def test_kv_set_with_options_success(self, mock_client):
        """Test kv_set_with_options with successful response."""
        from mattermost_plugin._internal.wrappers import PluginKVSetOptions
        from mattermost_plugin.grpc import api_kv_config_pb2

        # Mock the response
        mock_response = api_kv_config_pb2.KVSetWithOptionsResponse()
        mock_response.success = True
        mock_client._stub.KVSetWithOptions.return_value = mock_response

        # Set with options
        options = PluginKVSetOptions(
            atomic=True,
            old_value=b"old",
            expire_in_seconds=3600,
        )
        result = mock_client.kv_set_with_options("mykey", b"new", options)

        # Verify
        assert result is True


class TestErrorHandling:
    """Tests for error handling across Post/File/KV domains."""

    @pytest.fixture
    def mock_client(self):
        """Create a mocked client for testing."""
        from mattermost_plugin.client import PluginAPIClient

        client = PluginAPIClient(target="localhost:50051")
        client._stub = MagicMock()
        client._channel = MagicMock()
        return client

    def test_grpc_unavailable_error(self, mock_client):
        """Test that gRPC UNAVAILABLE maps to UnavailableError."""
        from mattermost_plugin.exceptions import UnavailableError

        # Create a mock that behaves like a gRPC error
        class MockGrpcError(grpc.RpcError):
            def code(self):
                return grpc.StatusCode.UNAVAILABLE

            def details(self):
                return "Service unavailable"

        mock_client._stub.GetPost.side_effect = MockGrpcError()

        # Call the method and expect exception
        with pytest.raises(UnavailableError):
            mock_client.get_post("post123")

    def test_validation_error_on_create_post(self, mock_client):
        """Test that 400 status code maps to ValidationError."""
        from mattermost_plugin._internal.wrappers import Post
        from mattermost_plugin.grpc import api_channel_post_pb2, common_pb2
        from mattermost_plugin.exceptions import ValidationError

        # Mock the response with 400 error
        mock_response = api_channel_post_pb2.CreatePostResponse()
        mock_response.error.CopyFrom(common_pb2.AppError(
            id="model.post.is_valid.msg.app_error",
            message="Message is required",
            status_code=400,
        ))
        mock_client._stub.CreatePost.return_value = mock_response

        # Call the method and expect ValidationError
        with pytest.raises(ValidationError) as exc_info:
            mock_client.create_post(Post(id="", channel_id="ch1", message=""))

        assert exc_info.value.status_code == 400
