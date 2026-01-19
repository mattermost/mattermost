# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Hello Python - Example Mattermost Plugin

This example plugin demonstrates the core features of the Python Plugin SDK:
- Plugin lifecycle hooks (OnActivate, OnDeactivate)
- Message filtering (MessageWillBePosted)
- Slash commands (ExecuteCommand)
- Using the API client and logger
"""

from mattermost_plugin import Plugin, hook, HookName


class HelloPythonPlugin(Plugin):
    """
    Example plugin demonstrating the Mattermost Python SDK.

    This plugin shows how to:
    - Handle plugin lifecycle events
    - Filter messages before they are posted
    - Implement custom slash commands
    """

    @hook(HookName.OnActivate)
    def on_activate(self) -> None:
        """
        Called when the plugin is activated.

        Use this hook to initialize plugin state, register commands,
        or perform any setup tasks.
        """
        self.logger.info("Hello Python plugin activated!")

        # Example: Get server version using the API client
        try:
            version = self.api.get_server_version()
            self.logger.info(f"Connected to Mattermost server version: {version}")
        except Exception as e:
            self.logger.warning(f"Could not get server version: {e}")

    @hook(HookName.OnDeactivate)
    def on_deactivate(self) -> None:
        """
        Called when the plugin is deactivated.

        Use this hook to clean up resources, save state,
        or perform any teardown tasks.
        """
        self.logger.info("Hello Python plugin deactivated!")

    @hook(HookName.MessageWillBePosted)
    def filter_message(self, context, post):
        """
        Called before a message is posted to a channel.

        This hook allows you to inspect, modify, or reject messages
        before they are stored and broadcast.

        Args:
            context: The plugin context containing request metadata.
            post: The Post object about to be posted.

        Returns:
            tuple: (post, rejection_reason)
                - Return (post, "") to allow the post (optionally modified)
                - Return (None, "reason") to reject the post
        """
        # Example: Log all messages (be careful with this in production!)
        self.logger.debug(f"Message from user {post.user_id}: {post.message[:50]}...")

        # Example: Simple word filter (demonstration only)
        blocked_words = ["badword"]  # Configure your own word list
        message_lower = post.message.lower()

        for word in blocked_words:
            if word in message_lower:
                self.logger.info(f"Blocked message containing '{word}'")
                return None, f"Message blocked: contains prohibited content"

        # Allow the message to be posted
        return post, ""

    @hook(HookName.ExecuteCommand)
    def execute_command(self, context, args):
        """
        Handle slash commands registered by this plugin.

        Args:
            context: The plugin context containing request metadata.
            args: The command arguments including command name, user, channel, etc.

        Returns:
            CommandResponse: The response to send back to the user.
        """
        # Extract command information
        command = args.command if hasattr(args, "command") else "/hello"
        user_id = args.user_id if hasattr(args, "user_id") else "unknown"

        self.logger.info(f"Received command '{command}' from user {user_id}")

        # Handle /hello command
        if command == "/hello" or command.startswith("/hello"):
            # Create a friendly response
            response_text = (
                "Hello from Python! :wave:\n\n"
                "This is an example response from the Hello Python plugin.\n\n"
                "**Available commands:**\n"
                "- `/hello` - Show this greeting\n"
                "- `/hello world` - Say hello to the world\n"
            )

            # Check for subcommand
            trigger_word = getattr(args, "trigger_id", "")
            if "world" in (getattr(args, "text", "") or "").lower():
                response_text = "Hello, World! :earth_americas:"

            # Return a command response
            # Note: The actual response structure depends on the SDK's command response type
            return {
                "response_type": "ephemeral",  # Only visible to the user who ran the command
                "text": response_text,
            }

        # Unknown command
        return {
            "response_type": "ephemeral",
            "text": f"Unknown command: {command}",
        }


# Entry point for running the plugin
if __name__ == "__main__":
    from mattermost_plugin.server import run_plugin

    run_plugin(HelloPythonPlugin)
