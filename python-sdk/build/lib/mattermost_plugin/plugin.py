# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Plugin base class for Mattermost Python plugins.

This module provides the `Plugin` base class that plugin authors subclass
to create their plugins. It uses `__init_subclass__` to automatically
discover hook handlers decorated with `@hook`.

Usage:
    from mattermost_plugin import Plugin, hook, HookName

    class MyPlugin(Plugin):
        @hook(HookName.OnActivate)
        def on_activate(self) -> None:
            self.logger.info("Plugin activated!")
            version = self.api.get_server_version()
            self.logger.info(f"Server version: {version}")

        @hook(HookName.MessageWillBePosted)
        def filter_messages(self, context, post):
            if "spam" in post.message.lower():
                return None, "Spam detected"
            return post, ""
"""

from __future__ import annotations

import logging
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    TYPE_CHECKING,
)

from mattermost_plugin.hooks import (
    HookRegistrationError,
    HOOK_MARKER_ATTR,
    is_hook_handler,
    get_hook_name,
)

if TYPE_CHECKING:
    from mattermost_plugin.client import PluginAPIClient
    from mattermost_plugin.runtime_config import RuntimeConfig


class Plugin:
    """
    Base class for all Mattermost Python plugins.

    Plugin authors should subclass this class and use the `@hook` decorator
    to register methods as hook handlers. The base class automatically
    discovers hooks via `__init_subclass__` when the plugin class is defined.

    Attributes:
        api: The PluginAPIClient for making API calls to the Mattermost server.
        logger: A logging.Logger instance for this plugin.
        config: Runtime configuration for this plugin.

    Class Attributes:
        _hook_registry: Dict mapping canonical hook names to handler methods.
            Populated by __init_subclass__ when the class is defined.

    Example:
        class MyPlugin(Plugin):
            @hook(HookName.OnActivate)
            def on_activate(self) -> None:
                self.logger.info("Plugin activated!")

            @hook(HookName.MessageWillBePosted)
            def filter_messages(self, context, post):
                return post, ""  # Allow all messages
    """

    # Class-level hook registry - populated by __init_subclass__
    _hook_registry: Dict[str, Callable[..., Any]] = {}

    def __init_subclass__(cls, **kwargs: Any) -> None:
        """
        Called when Plugin is subclassed - discovers @hook decorated methods.

        This method scans the new subclass for methods decorated with @hook
        and builds a class-level registry mapping hook names to methods.

        Raises:
            HookRegistrationError: If duplicate hooks are registered.
        """
        super().__init_subclass__(**kwargs)

        # Create a new registry for this subclass (don't inherit parent's)
        cls._hook_registry = {}

        # Scan all attributes in the class hierarchy for hooks
        for attr_name in dir(cls):
            # Skip private/magic attributes
            if attr_name.startswith("_"):
                continue

            try:
                attr = getattr(cls, attr_name)
            except AttributeError:
                continue

            # Check if this is a hook handler
            if callable(attr) and is_hook_handler(attr):
                hook_name = get_hook_name(attr)
                if hook_name is None:
                    continue

                # Check for duplicate registration
                if hook_name in cls._hook_registry:
                    existing = cls._hook_registry[hook_name]
                    raise HookRegistrationError(
                        f"Duplicate hook registration for '{hook_name}': "
                        f"'{attr_name}' conflicts with '{existing.__name__}'"
                    )

                cls._hook_registry[hook_name] = attr
                logging.debug(
                    f"Registered hook: {cls.__name__}.{attr_name} -> {hook_name}"
                )

    def __init__(
        self,
        api: Optional["PluginAPIClient"] = None,
        config: Optional["RuntimeConfig"] = None,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        """
        Initialize the plugin instance.

        Args:
            api: The PluginAPIClient for making API calls. If None, API calls
                will raise RuntimeError.
            config: Runtime configuration. If None, a default config is used.
            logger: Logger instance. If None, creates one with the class name.
        """
        self._api = api
        self._config = config
        self._logger = logger or logging.getLogger(self.__class__.__name__)

    @property
    def api(self) -> "PluginAPIClient":
        """
        The PluginAPIClient for making API calls to the Mattermost server.

        Raises:
            RuntimeError: If the API client is not initialized.
        """
        if self._api is None:
            raise RuntimeError(
                "Plugin API client is not initialized. "
                "This usually means the plugin is not running in a proper context."
            )
        return self._api

    @property
    def logger(self) -> logging.Logger:
        """A logging.Logger instance for this plugin."""
        return self._logger

    @property
    def config(self) -> Optional["RuntimeConfig"]:
        """Runtime configuration for this plugin."""
        return self._config

    @classmethod
    def implemented_hooks(cls) -> List[str]:
        """
        Get the list of hooks implemented by this plugin.

        This method returns canonical hook names that can be sent in the
        `Implemented()` RPC response.

        Returns:
            Sorted list of canonical hook names implemented by this plugin.
        """
        return sorted(cls._hook_registry.keys())

    @classmethod
    def has_hook(cls, name: str) -> bool:
        """
        Check if this plugin implements a specific hook.

        Args:
            name: The canonical hook name (e.g., "OnActivate").

        Returns:
            True if the plugin implements this hook, False otherwise.
        """
        return name in cls._hook_registry

    def invoke_hook(self, name: str, *args: Any, **kwargs: Any) -> Any:
        """
        Invoke a hook handler if implemented.

        This method is called by the hook servicer to dispatch hook invocations
        to the appropriate handler method.

        Args:
            name: The canonical hook name (e.g., "OnActivate").
            *args: Positional arguments to pass to the handler.
            **kwargs: Keyword arguments to pass to the handler.

        Returns:
            The return value from the hook handler, or None if not implemented.

        Note:
            This method does NOT catch exceptions from the handler. The caller
            (hook runner/servicer) is responsible for exception handling.
        """
        if name not in self._hook_registry:
            return None

        handler = self._hook_registry[name]
        return handler(self, *args, **kwargs)

    def get_hook_handler(self, name: str) -> Optional[Callable[..., Any]]:
        """
        Get the hook handler method for a specific hook.

        Args:
            name: The canonical hook name.

        Returns:
            The bound method if the hook is implemented, None otherwise.
        """
        if name not in self._hook_registry:
            return None

        handler = self._hook_registry[name]
        # Return bound method
        return handler.__get__(self, type(self))
