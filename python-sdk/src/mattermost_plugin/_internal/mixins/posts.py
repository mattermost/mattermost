# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Post API methods mixin for PluginAPIClient.

This module provides all post-related API methods including:
- Post CRUD operations
- Ephemeral posts
- Reactions
- Post queries (thread, channel, since, before, after)
"""

from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import Post, PostList, Reaction
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class PostsMixin:
    """Mixin providing post-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Post CRUD
    # =========================================================================

    def create_post(self, post: Post) -> Post:
        """
        Create a new post.

        Args:
            post: Post object with channel_id and message set.
                  The ID field should be empty as it will be assigned.

        Returns:
            The created Post with assigned ID and timestamps.

        Raises:
            ValidationError: If post data is invalid.
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.

        Example:
            >>> post = Post(id="", channel_id="channel123", message="Hello!")
            >>> created = client.create_post(post)
            >>> print(created.id)  # Assigned ID
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.CreatePostRequest(post=post.to_proto())

        try:
            response = stub.CreatePost(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Post.from_proto(response.post)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_post(self, post_id: str) -> Post:
        """
        Get a post by ID.

        Args:
            post_id: ID of the post to retrieve.

        Returns:
            The Post object.

        Raises:
            NotFoundError: If post does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetPostRequest(post_id=post_id)

        try:
            response = stub.GetPost(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Post.from_proto(response.post)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_post(self, post: Post) -> Post:
        """
        Update an existing post.

        Args:
            post: Post object with ID and updated fields.

        Returns:
            The updated Post.

        Raises:
            NotFoundError: If post does not exist.
            ValidationError: If post data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.UpdatePostRequest(post=post.to_proto())

        try:
            response = stub.UpdatePost(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Post.from_proto(response.post)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_post(self, post_id: str) -> None:
        """
        Delete a post.

        Args:
            post_id: ID of the post to delete.

        Raises:
            NotFoundError: If post does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.DeletePostRequest(post_id=post_id)

        try:
            response = stub.DeletePost(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Ephemeral Posts
    # =========================================================================

    def send_ephemeral_post(self, user_id: str, post: Post) -> Post:
        """
        Send an ephemeral post visible only to a specific user.

        Ephemeral posts are temporary and not stored in the database.
        They appear only to the specified user and disappear on refresh.

        Args:
            user_id: ID of the user who will see the post.
            post: Post object with channel_id and message set.

        Returns:
            The created ephemeral Post.

        Raises:
            NotFoundError: If user or channel does not exist.
            PluginAPIError: If the API call fails.

        Example:
            >>> post = Post(id="", channel_id="channel123", message="Only you can see this!")
            >>> client.send_ephemeral_post("user123", post)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.SendEphemeralPostRequest(
            user_id=user_id,
            post=post.to_proto(),
        )

        try:
            response = stub.SendEphemeralPost(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Post.from_proto(response.post)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_ephemeral_post(self, user_id: str, post: Post) -> Post:
        """
        Update an ephemeral post.

        Args:
            user_id: ID of the user who can see the post.
            post: Post object with updated message/properties.

        Returns:
            The updated ephemeral Post.

        Raises:
            NotFoundError: If user or post does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.UpdateEphemeralPostRequest(
            user_id=user_id,
            post=post.to_proto(),
        )

        try:
            response = stub.UpdateEphemeralPost(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Post.from_proto(response.post)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_ephemeral_post(self, user_id: str, post_id: str) -> None:
        """
        Delete an ephemeral post.

        Args:
            user_id: ID of the user who can see the post.
            post_id: ID of the ephemeral post to delete.

        Raises:
            NotFoundError: If user or post does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.DeleteEphemeralPostRequest(
            user_id=user_id,
            post_id=post_id,
        )

        try:
            response = stub.DeleteEphemeralPost(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Post Queries
    # =========================================================================

    def get_post_thread(self, post_id: str) -> PostList:
        """
        Get a post thread (root post and all replies).

        Args:
            post_id: ID of any post in the thread (root or reply).

        Returns:
            PostList containing all posts in the thread.

        Raises:
            NotFoundError: If post does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetPostThreadRequest(post_id=post_id)

        try:
            response = stub.GetPostThread(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return PostList.from_proto(response.post_list)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_posts_since(self, channel_id: str, time: int) -> PostList:
        """
        Get posts in a channel since a given time.

        Args:
            channel_id: ID of the channel.
            time: Unix timestamp in milliseconds.

        Returns:
            PostList containing posts since the given time.

        Raises:
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetPostsSinceRequest(
            channel_id=channel_id,
            time=time,
        )

        try:
            response = stub.GetPostsSince(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return PostList.from_proto(response.post_list)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_posts_after(
        self,
        channel_id: str,
        post_id: str,
        *,
        page: int = 0,
        per_page: int = 60,
    ) -> PostList:
        """
        Get posts after a specific post in a channel.

        Args:
            channel_id: ID of the channel.
            post_id: ID of the post to get posts after.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            PostList containing posts after the given post.

        Raises:
            NotFoundError: If channel or post does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetPostsAfterRequest(
            channel_id=channel_id,
            post_id=post_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetPostsAfter(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return PostList.from_proto(response.post_list)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_posts_before(
        self,
        channel_id: str,
        post_id: str,
        *,
        page: int = 0,
        per_page: int = 60,
    ) -> PostList:
        """
        Get posts before a specific post in a channel.

        Args:
            channel_id: ID of the channel.
            post_id: ID of the post to get posts before.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            PostList containing posts before the given post.

        Raises:
            NotFoundError: If channel or post does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetPostsBeforeRequest(
            channel_id=channel_id,
            post_id=post_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetPostsBefore(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return PostList.from_proto(response.post_list)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Reactions
    # =========================================================================

    def add_reaction(self, reaction: Reaction) -> Reaction:
        """
        Add a reaction to a post.

        Args:
            reaction: Reaction object with user_id, post_id, and emoji_name set.

        Returns:
            The created Reaction.

        Raises:
            NotFoundError: If post does not exist.
            ValidationError: If reaction data is invalid.
            PluginAPIError: If the API call fails.

        Example:
            >>> reaction = Reaction(user_id="user123", post_id="post123", emoji_name="thumbsup")
            >>> client.add_reaction(reaction)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.AddReactionRequest(reaction=reaction.to_proto())

        try:
            response = stub.AddReaction(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Reaction.from_proto(response.reaction)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def remove_reaction(self, reaction: Reaction) -> None:
        """
        Remove a reaction from a post.

        Args:
            reaction: Reaction object identifying the reaction to remove.
                      Must have user_id, post_id, and emoji_name set.

        Raises:
            NotFoundError: If reaction does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.RemoveReactionRequest(reaction=reaction.to_proto())

        try:
            response = stub.RemoveReaction(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_reactions(self, post_id: str) -> List[Reaction]:
        """
        Get all reactions on a post.

        Args:
            post_id: ID of the post.

        Returns:
            List of Reaction objects.

        Raises:
            NotFoundError: If post does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetReactionsRequest(post_id=post_id)

        try:
            response = stub.GetReactions(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Reaction.from_proto(r) for r in response.reactions]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
