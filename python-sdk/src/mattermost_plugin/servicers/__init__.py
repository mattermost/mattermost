# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
gRPC servicer implementations for Mattermost Python plugins.

This module provides the servicer implementations that handle hook invocations
from the Mattermost server.
"""

from mattermost_plugin.servicers.hooks_servicer import PluginHooksServicerImpl

__all__ = ["PluginHooksServicerImpl"]
