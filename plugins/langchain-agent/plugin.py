# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
LangChain Agent - Mattermost Plugin

This plugin demonstrates LangChain integration with two AI bots:
- OpenAI Agent: Uses OpenAI's GPT models via LangChain
- Anthropic Agent: Uses Anthropic's Claude models via LangChain

The plugin creates both bots on activation and routes DM messages
to the appropriate handler based on which bot is in the conversation.
"""

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin._internal.wrappers import Bot, Post, ChannelType
from mattermost_plugin.exceptions import NotFoundError

# Bot usernames (plugin-scoped)
OPENAI_BOT_USERNAME = "langchain-openai-agent"
ANTHROPIC_BOT_USERNAME = "langchain-anthropic-agent"


class LangChainAgentPlugin(Plugin):
    """
    LangChain Agent plugin providing AI assistants via DM.

    This plugin creates two bots on activation:
    - OpenAI Agent for GPT-based conversations
    - Anthropic Agent for Claude-based conversations

    Users can DM either bot to interact with the respective LLM.
    """

    def __init__(self) -> None:
        """Initialize plugin instance attributes."""
        super().__init__()
        self.openai_bot_id: str | None = None
        self.anthropic_bot_id: str | None = None

    @hook(HookName.OnActivate)
    def on_activate(self) -> None:
        """
        Called when the plugin is activated.

        Creates the OpenAI and Anthropic bot accounts using ensure_bot_user,
        which will create them if they don't exist or return existing IDs.
        """
        self.logger.info("LangChain Agent plugin activating...")

        # Create OpenAI bot
        try:
            openai_bot = Bot(
                username=OPENAI_BOT_USERNAME,
                display_name="OpenAI Agent",
                description="LangChain-powered AI agent using OpenAI",
            )
            self.openai_bot_id = self.api.ensure_bot_user(openai_bot)
            self.logger.info(
                f"OpenAI bot ready: {OPENAI_BOT_USERNAME} (ID: {self.openai_bot_id})"
            )
        except Exception as e:
            self.logger.error(f"Failed to create OpenAI bot: {e}")
            self.openai_bot_id = None

        # Create Anthropic bot
        try:
            anthropic_bot = Bot(
                username=ANTHROPIC_BOT_USERNAME,
                display_name="Anthropic Agent",
                description="LangChain-powered AI agent using Anthropic Claude",
            )
            self.anthropic_bot_id = self.api.ensure_bot_user(anthropic_bot)
            self.logger.info(
                f"Anthropic bot ready: {ANTHROPIC_BOT_USERNAME} (ID: {self.anthropic_bot_id})"
            )
        except Exception as e:
            self.logger.error(f"Failed to create Anthropic bot: {e}")
            self.anthropic_bot_id = None

        self.logger.info("LangChain Agent plugin activated!")

    @hook(HookName.OnDeactivate)
    def on_deactivate(self) -> None:
        """
        Called when the plugin is deactivated.

        Bot accounts persist across plugin restarts - no cleanup needed.
        """
        self.logger.info("LangChain Agent plugin deactivated.")

    @hook(HookName.MessageHasBeenPosted)
    def on_message_posted(self, context, post: Post) -> None:
        """
        Called after a message has been posted.

        Routes DM messages to the appropriate bot handler based on
        which bot is a member of the DM channel.

        Args:
            context: The plugin context containing request metadata.
            post: The Post object that was just posted.
        """
        # Early exit if bots not created
        if self.openai_bot_id is None or self.anthropic_bot_id is None:
            self.logger.debug("Bots not initialized, skipping message routing")
            return

        # Don't respond to messages from either bot (avoid loops)
        if post.user_id == self.openai_bot_id or post.user_id == self.anthropic_bot_id:
            self.logger.debug("Ignoring message from bot")
            return

        # Get the channel to check if it's a DM
        try:
            channel = self.api.get_channel(post.channel_id)
        except Exception as e:
            self.logger.error(f"Failed to get channel {post.channel_id}: {e}")
            return

        # Only process DM channels
        if channel.type != ChannelType.DIRECT.value:
            self.logger.debug(f"Ignoring non-DM message in channel type: {channel.type}")
            return

        # Check which bot is in this DM channel and route accordingly
        # Try OpenAI bot first
        try:
            self.api.get_channel_member(post.channel_id, self.openai_bot_id)
            # OpenAI bot is in this channel - route to OpenAI handler
            self.logger.debug(f"Routing message to OpenAI handler")
            self._handle_openai_message(post)
            return
        except NotFoundError:
            # OpenAI bot is not in this channel
            pass
        except Exception as e:
            self.logger.error(f"Error checking OpenAI bot membership: {e}")

        # Try Anthropic bot
        try:
            self.api.get_channel_member(post.channel_id, self.anthropic_bot_id)
            # Anthropic bot is in this channel - route to Anthropic handler
            self.logger.debug(f"Routing message to Anthropic handler")
            self._handle_anthropic_message(post)
            return
        except NotFoundError:
            # Anthropic bot is not in this channel
            pass
        except Exception as e:
            self.logger.error(f"Error checking Anthropic bot membership: {e}")

        # Neither bot is in this DM - not our conversation
        self.logger.debug("Neither bot is in this DM, ignoring")

    def _handle_openai_message(self, post: Post) -> None:
        """
        Handle a message directed to the OpenAI bot.

        This is a placeholder that sends a simple acknowledgment.
        Will be replaced with actual LangChain integration in Phase 15.

        Args:
            post: The Post object containing the user's message.
        """
        self.logger.info(f"OpenAI Agent received message: {post.message[:50]}...")

        # Create placeholder response
        try:
            response = Post(
                id="",
                channel_id=post.channel_id,
                message=f"[OpenAI Agent] Received: {post.message[:50]}...",
            )
            self.api.create_post(response)
            self.logger.debug("OpenAI Agent sent placeholder response")
        except Exception as e:
            self.logger.error(f"Failed to send OpenAI response: {e}")

    def _handle_anthropic_message(self, post: Post) -> None:
        """
        Handle a message directed to the Anthropic bot.

        This is a placeholder that sends a simple acknowledgment.
        Will be replaced with actual LangChain integration in Phase 15.

        Args:
            post: The Post object containing the user's message.
        """
        self.logger.info(f"Anthropic Agent received message: {post.message[:50]}...")

        # Create placeholder response
        try:
            response = Post(
                id="",
                channel_id=post.channel_id,
                message=f"[Anthropic Agent] Received: {post.message[:50]}...",
            )
            self.api.create_post(response)
            self.logger.debug("Anthropic Agent sent placeholder response")
        except Exception as e:
            self.logger.error(f"Failed to send Anthropic response: {e}")


# Entry point for running the plugin
if __name__ == "__main__":
    from mattermost_plugin.server import run_plugin

    run_plugin(LangChainAgentPlugin)
