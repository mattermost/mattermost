# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Bot API methods mixin for PluginAPIClient.

This module provides all bot-related API methods including:
- Bot CRUD operations
- Bot activation/deactivation
- EnsureBotUser for plugin bots
"""

from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import Bot, BotPatch, BotGetOptions
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class BotsMixin:
    """Mixin providing bot-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Bot CRUD
    # =========================================================================

    def create_bot(self, bot: Bot) -> Bot:
        """
        Create a new bot.

        Args:
            bot: Bot object with username and display_name set.

        Returns:
            The created Bot.

        Raises:
            ValidationError: If bot data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.CreateBotRequest(bot=bot.to_proto())

        try:
            response = stub.CreateBot(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Bot.from_proto(response.bot)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_bot(self, bot_user_id: str, *, include_deleted: bool = False) -> Bot:
        """
        Get a bot by user ID.

        Args:
            bot_user_id: User ID of the bot.
            include_deleted: Whether to include deleted bots.

        Returns:
            The Bot object.

        Raises:
            NotFoundError: If bot does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.GetBotRequest(
            bot_user_id=bot_user_id,
            include_deleted=include_deleted,
        )

        try:
            response = stub.GetBot(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Bot.from_proto(response.bot)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_bots(self, options: Optional[BotGetOptions] = None) -> List[Bot]:
        """
        Get a list of bots.

        Args:
            options: Options for filtering bots.

        Returns:
            List of Bot objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.GetBotsRequest()
        if options:
            request.options.CopyFrom(options.to_proto())

        try:
            response = stub.GetBots(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Bot.from_proto(b) for b in response.bots]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def patch_bot(self, bot_user_id: str, patch: BotPatch) -> Bot:
        """
        Update a bot with partial data.

        Args:
            bot_user_id: User ID of the bot.
            patch: Patch data with fields to update.

        Returns:
            The updated Bot.

        Raises:
            NotFoundError: If bot does not exist.
            ValidationError: If patch data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.PatchBotRequest(
            bot_user_id=bot_user_id,
            bot_patch=patch.to_proto(),
        )

        try:
            response = stub.PatchBot(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Bot.from_proto(response.bot)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_bot_active(self, bot_user_id: str, active: bool) -> Bot:
        """
        Update a bot's active status.

        Args:
            bot_user_id: User ID of the bot.
            active: Whether the bot should be active.

        Returns:
            The updated Bot.

        Raises:
            NotFoundError: If bot does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.UpdateBotActiveRequest(
            bot_user_id=bot_user_id,
            active=active,
        )

        try:
            response = stub.UpdateBotActive(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Bot.from_proto(response.bot)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def permanent_delete_bot(self, bot_user_id: str) -> None:
        """
        Permanently delete a bot.

        Args:
            bot_user_id: User ID of the bot.

        Raises:
            NotFoundError: If bot does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.PermanentDeleteBotRequest(bot_user_id=bot_user_id)

        try:
            response = stub.PermanentDeleteBot(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def ensure_bot_user(self, bot: Bot) -> str:
        """
        Ensure a bot user exists, creating it if necessary.

        This is the recommended way for plugins to create their bot account.
        It will create the bot if it doesn't exist, or return the existing
        bot's user ID if it does.

        Args:
            bot: Bot object with desired username and display_name.

        Returns:
            The user ID of the bot (existing or newly created).

        Raises:
            ValidationError: If bot data is invalid.
            PluginAPIError: If the API call fails.

        Example:
            >>> bot = Bot(username="mybot", display_name="My Bot")
            >>> bot_user_id = client.ensure_bot_user(bot)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.EnsureBotUserRequest(bot=bot.to_proto())

        try:
            response = stub.EnsureBotUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.bot_user_id

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
