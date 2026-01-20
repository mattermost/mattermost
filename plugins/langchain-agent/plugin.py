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


# Entry point for running the plugin
if __name__ == "__main__":
    from mattermost_plugin.server import run_plugin

    run_plugin(LangChainAgentPlugin)
