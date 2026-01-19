# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Command API methods mixin for PluginAPIClient.

This module provides all slash command-related API methods including:
- Command registration and unregistration
- Command CRUD operations
- Command execution
- Command listing by type
"""

from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import Command, CommandArgs, CommandResponse
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class CommandsMixin:
    """Mixin providing command-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Command Registration
    # =========================================================================

    def register_command(self, command: Command) -> None:
        """
        Register a slash command for a plugin.

        Args:
            command: Command object with trigger and other settings.

        Raises:
            ValidationError: If command data is invalid.
            PluginAPIError: If the API call fails.

        Example:
            >>> cmd = Command(trigger="hello", auto_complete=True)
            >>> client.register_command(cmd)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.RegisterCommandRequest(command=command.to_proto())

        try:
            response = stub.RegisterCommand(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def unregister_command(self, team_id: str, trigger: str) -> None:
        """
        Unregister a slash command.

        Args:
            team_id: ID of the team (empty string for global commands).
            trigger: The trigger word of the command.

        Raises:
            NotFoundError: If command does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UnregisterCommandRequest(
            team_id=team_id,
            trigger=trigger,
        )

        try:
            response = stub.UnregisterCommand(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Command Execution
    # =========================================================================

    def execute_slash_command(self, args: CommandArgs) -> CommandResponse:
        """
        Execute a slash command.

        Args:
            args: Command arguments including command string and context.

        Returns:
            The command response.

        Raises:
            ValidationError: If command arguments are invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.ExecuteSlashCommandRequest(
            command_args=args.to_proto()
        )

        try:
            response = stub.ExecuteSlashCommand(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return CommandResponse.from_proto(response.response)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Command CRUD
    # =========================================================================

    def create_command(self, command: Command) -> Command:
        """
        Create a custom slash command.

        Args:
            command: Command object with settings.

        Returns:
            The created Command with assigned ID.

        Raises:
            ValidationError: If command data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.CreateCommandRequest(cmd=command.to_proto())

        try:
            response = stub.CreateCommand(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Command.from_proto(response.command)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_command(self, command_id: str) -> Command:
        """
        Get a command by ID.

        Args:
            command_id: ID of the command.

        Returns:
            The Command object.

        Raises:
            NotFoundError: If command does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetCommandRequest(command_id=command_id)

        try:
            response = stub.GetCommand(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Command.from_proto(response.command)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_command(self, command_id: str, command: Command) -> Command:
        """
        Update a command.

        Args:
            command_id: ID of the command to update.
            command: Updated command data.

        Returns:
            The updated Command.

        Raises:
            NotFoundError: If command does not exist.
            ValidationError: If command data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdateCommandRequest(
            command_id=command_id,
            updated_cmd=command.to_proto(),
        )

        try:
            response = stub.UpdateCommand(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Command.from_proto(response.command)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_command(self, command_id: str) -> None:
        """
        Delete a command.

        Args:
            command_id: ID of the command to delete.

        Raises:
            NotFoundError: If command does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeleteCommandRequest(command_id=command_id)

        try:
            response = stub.DeleteCommand(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Command Listing
    # =========================================================================

    def list_commands(self, team_id: str) -> List[Command]:
        """
        List all commands for a team.

        Args:
            team_id: ID of the team.

        Returns:
            List of Command objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.ListCommandsRequest(team_id=team_id)

        try:
            response = stub.ListCommands(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Command.from_proto(c) for c in response.commands]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def list_custom_commands(self, team_id: str) -> List[Command]:
        """
        List custom commands for a team.

        Args:
            team_id: ID of the team.

        Returns:
            List of custom Command objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.ListCustomCommandsRequest(team_id=team_id)

        try:
            response = stub.ListCustomCommands(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Command.from_proto(c) for c in response.commands]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def list_plugin_commands(self, team_id: str) -> List[Command]:
        """
        List plugin commands for a team.

        Args:
            team_id: ID of the team.

        Returns:
            List of plugin Command objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.ListPluginCommandsRequest(team_id=team_id)

        try:
            response = stub.ListPluginCommands(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Command.from_proto(c) for c in response.commands]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def list_built_in_commands(self) -> List[Command]:
        """
        List built-in commands.

        Returns:
            List of built-in Command objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.ListBuiltInCommandsRequest()

        try:
            response = stub.ListBuiltInCommands(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Command.from_proto(c) for c in response.commands]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
