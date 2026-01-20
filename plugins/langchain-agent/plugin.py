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

import asyncio

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin._internal.wrappers import Bot, Post, ChannelType
from mattermost_plugin.exceptions import NotFoundError

from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

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
        self.openai_model: ChatOpenAI | None = None
        self.anthropic_model: ChatAnthropic | None = None
        self.mcp_client: MultiServerMCPClient | None = None

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

        # Initialize LangChain models
        try:
            self.openai_model = ChatOpenAI(model="gpt-4o", temperature=0.7)
            self.logger.info("OpenAI model initialized")
        except Exception as e:
            self.logger.warning(f"OpenAI model not available: {e}")
            self.openai_model = None

        try:
            self.anthropic_model = ChatAnthropic(
                model="claude-sonnet-4-5-20250929",
                temperature=0.7,
                max_tokens=5000,  # Increased to accommodate thinking + response
                thinking={"type": "enabled", "budget_tokens": 2000},
            )
            self.logger.info("Anthropic model initialized with extended thinking")
        except Exception as e:
            self.logger.warning(f"Anthropic model not available: {e}")
            self.anthropic_model = None

        # Initialize MCP client with configured servers
        mcp_config = self._get_mcp_server_config()
        if mcp_config:
            try:
                self.mcp_client = MultiServerMCPClient(mcp_config)
                self.logger.info(
                    f"MCP client initialized with {len(mcp_config)} server(s)"
                )
            except Exception as e:
                self.logger.warning(f"Failed to initialize MCP client: {e}")
                self.mcp_client = None
        else:
            self.logger.info("No MCP servers configured, running without tools")
            self.mcp_client = None

        self.logger.info("LangChain Agent plugin activated!")

    def _get_mcp_server_config(self) -> dict:
        """
        Get MCP server configuration.

        Returns dict of server configs. Each server needs:
        - For STDIO: transport="stdio", command="...", args=[...]
        - For HTTP: transport="http", url="..."

        Returns empty dict if no servers configured.
        """
        # TODO: In future, read from plugin settings
        # For now, return empty dict - no MCP servers configured by default
        return {}

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
            self.logger.debug(
                f"Ignoring non-DM message in channel type: {channel.type}"
            )
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
        """Handle a message directed to the OpenAI bot."""
        self.logger.info(f"OpenAI Agent processing message: {post.message[:50]}...")
        asyncio.run(
            self._handle_message_async(
                post,
                self.openai_model,
                self.openai_bot_id,
                "You are a helpful AI assistant powered by OpenAI. Be concise and helpful.",
            )
        )

    def _handle_anthropic_message(self, post: Post) -> None:
        """Handle a message directed to the Anthropic bot."""
        self.logger.info(f"Anthropic Agent processing message: {post.message[:50]}...")
        asyncio.run(
            self._handle_message_async(
                post,
                self.anthropic_model,
                self.anthropic_bot_id,
                "You are a thoughtful AI assistant powered by Anthropic Claude. Think through complex problems carefully before responding. Be concise and helpful.",
            )
        )

    def _build_conversation_history(
        self, post: Post, bot_id: str | None, system_prompt: str
    ) -> list:
        """
        Build LangChain message history from Mattermost thread.

        Args:
            post: The current post being processed.
            bot_id: The bot's user ID (to distinguish bot messages).
            system_prompt: The system prompt to prepend.

        Returns:
            List of LangChain messages (SystemMessage, HumanMessage, AIMessage).
        """
        messages = [SystemMessage(content=system_prompt)]

        # Determine if this is part of an existing thread
        if post.root_id:
            # Message is in existing thread - fetch full thread
            try:
                thread = self.api.get_post_thread(post.root_id)
                # Sort posts by order (chronological)
                for post_id in thread.order:
                    thread_post = thread.posts.get(post_id)
                    if thread_post is None:
                        continue
                    # Skip posts with empty messages
                    if not thread_post.message:
                        continue
                    # Convert to appropriate LangChain message type
                    if thread_post.user_id == bot_id:
                        messages.append(AIMessage(content=thread_post.message))
                    else:
                        messages.append(HumanMessage(content=thread_post.message))
            except Exception as e:
                self.logger.warning(f"Failed to fetch thread history: {e}")
                # Fall back to just the current message
                messages.append(HumanMessage(content=post.message))
        else:
            # New conversation - just use current message
            messages.append(HumanMessage(content=post.message))

        return messages

    async def _handle_message_async(
        self, post: Post, model, bot_id: str | None, system_prompt: str
    ) -> None:
        """Handle message with optional MCP tool support."""
        root_id = post.root_id if post.root_id else post.id

        if model is None:
            self._send_error_response(post.channel_id, "Model not configured.", root_id)
            return

        # Build conversation history
        messages = self._build_conversation_history(post, bot_id, system_prompt)

        # If MCP client available, use agent with tools
        if self.mcp_client is not None:
            try:
                tools = await self.mcp_client.get_tools()
                if tools:
                    # Create agent with tools
                    agent = create_react_agent(model, tools)
                    # Invoke agent with messages (recursion_limit prevents infinite loops)
                    response = await agent.ainvoke(
                        {"messages": messages}, config={"recursion_limit": 10}
                    )
                    # Extract final response
                    last_message = response["messages"][-1]
                    self._send_response(post.channel_id, last_message.content, root_id)
                    return
            except Exception as e:
                self.logger.warning(
                    f"MCP tools unavailable, falling back to basic chat: {e}"
                )

        # Fallback to basic model invocation (no tools)
        try:
            response = model.invoke(messages)
            self._send_response(post.channel_id, response.content, root_id)
        except Exception as e:
            self.logger.error(f"Model API error: {e}")
            self._send_error_response(post.channel_id, f"API error: {e}", root_id)

    def _send_response(self, channel_id: str, message: str, root_id: str = "") -> None:
        """Send a response message to the channel, optionally as a thread reply."""
        try:
            response = Post(
                id="", channel_id=channel_id, message=message, root_id=root_id
            )
            self.api.create_post(response)
        except Exception as e:
            self.logger.error(f"Failed to send response: {e}")

    def _send_error_response(
        self, channel_id: str, error: str, root_id: str = ""
    ) -> None:
        """Send an error message to the channel, optionally as a thread reply."""
        self._send_response(
            channel_id, f"Sorry, I encountered an error: {error}", root_id
        )


# Entry point for running the plugin
if __name__ == "__main__":
    from mattermost_plugin.server import run_plugin

    run_plugin(LangChainAgentPlugin)
