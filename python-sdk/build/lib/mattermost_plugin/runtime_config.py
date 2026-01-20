# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Runtime configuration loader for Mattermost Python plugins.

This module reads configuration from environment variables passed by the
Go supervisor when starting the Python plugin process.

Environment Variables:
    MATTERMOST_PLUGIN_ID: The unique identifier for this plugin.
    MATTERMOST_PLUGIN_API_TARGET: gRPC target for the Plugin API server.
    MATTERMOST_PLUGIN_PATH: Path to the plugin directory.
    MATTERMOST_PLUGIN_HOOK_TIMEOUT: Hook execution timeout in seconds (optional).
    MATTERMOST_PLUGIN_LOG_LEVEL: Log level (DEBUG, INFO, WARNING, ERROR) (optional).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Optional

# Default values
DEFAULT_API_TARGET = "127.0.0.1:50051"
DEFAULT_HOOK_TIMEOUT = 30.0
DEFAULT_LOG_LEVEL = "INFO"

# Environment variable names
ENV_PLUGIN_ID = "MATTERMOST_PLUGIN_ID"
ENV_API_TARGET = "MATTERMOST_PLUGIN_API_TARGET"
ENV_PLUGIN_PATH = "MATTERMOST_PLUGIN_PATH"
ENV_HOOK_TIMEOUT = "MATTERMOST_PLUGIN_HOOK_TIMEOUT"
ENV_LOG_LEVEL = "MATTERMOST_PLUGIN_LOG_LEVEL"


@dataclass
class RuntimeConfig:
    """
    Runtime configuration for a Mattermost Python plugin.

    This class holds configuration values read from environment variables
    or provided during initialization.

    Attributes:
        plugin_id: The unique identifier for this plugin.
        api_target: gRPC target address for the Plugin API server.
        plugin_path: Path to the plugin directory.
        hook_timeout: Maximum time in seconds for hook execution.
        log_level: Logging level string (DEBUG, INFO, WARNING, ERROR).
    """

    plugin_id: str = ""
    api_target: str = DEFAULT_API_TARGET
    plugin_path: str = ""
    hook_timeout: float = DEFAULT_HOOK_TIMEOUT
    log_level: str = DEFAULT_LOG_LEVEL

    def configure_logging(self) -> None:
        """
        Configure Python logging based on this config.

        Sets up the root logger with the configured log level and
        a simple format suitable for plugin output.
        """
        level = getattr(logging, self.log_level.upper(), logging.INFO)

        # Configure basic logging to stderr (stdout is reserved for handshake)
        logging.basicConfig(
            level=level,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    @classmethod
    def from_env(cls) -> "RuntimeConfig":
        """
        Load runtime configuration from environment variables.

        Returns:
            RuntimeConfig instance populated from environment variables.
        """
        # Read plugin ID (required for proper operation, but allow empty for testing)
        plugin_id = os.environ.get(ENV_PLUGIN_ID, "")

        # Read API target
        api_target = os.environ.get(ENV_API_TARGET, DEFAULT_API_TARGET)

        # Read plugin path
        plugin_path = os.environ.get(ENV_PLUGIN_PATH, "")

        # Read hook timeout
        timeout_str = os.environ.get(ENV_HOOK_TIMEOUT, "")
        try:
            hook_timeout = float(timeout_str) if timeout_str else DEFAULT_HOOK_TIMEOUT
        except ValueError:
            logging.warning(
                f"Invalid {ENV_HOOK_TIMEOUT} value '{timeout_str}', "
                f"using default {DEFAULT_HOOK_TIMEOUT}"
            )
            hook_timeout = DEFAULT_HOOK_TIMEOUT

        # Read log level
        log_level = os.environ.get(ENV_LOG_LEVEL, DEFAULT_LOG_LEVEL)

        return cls(
            plugin_id=plugin_id,
            api_target=api_target,
            plugin_path=plugin_path,
            hook_timeout=hook_timeout,
            log_level=log_level,
        )


def load_runtime_config() -> RuntimeConfig:
    """
    Load and return runtime configuration from environment.

    This is a convenience function that creates a RuntimeConfig
    from environment variables.

    Returns:
        RuntimeConfig instance.
    """
    return RuntimeConfig.from_env()
