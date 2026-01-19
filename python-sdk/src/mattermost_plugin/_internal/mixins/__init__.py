# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Client mixin modules for domain-specific API methods.

These mixins are composed into the main PluginAPIClient to provide
a clean separation of concerns while maintaining a unified client
interface.
"""

from mattermost_plugin._internal.mixins.users import UsersMixin
from mattermost_plugin._internal.mixins.teams import TeamsMixin
from mattermost_plugin._internal.mixins.channels import ChannelsMixin
from mattermost_plugin._internal.mixins.posts import PostsMixin
from mattermost_plugin._internal.mixins.files import FilesMixin
from mattermost_plugin._internal.mixins.kvstore import KVStoreMixin
from mattermost_plugin._internal.mixins.bots import BotsMixin
from mattermost_plugin._internal.mixins.commands import CommandsMixin
from mattermost_plugin._internal.mixins.config import ConfigMixin
from mattermost_plugin._internal.mixins.preferences import PreferencesMixin
from mattermost_plugin._internal.mixins.oauth import OAuthMixin
from mattermost_plugin._internal.mixins.groups import GroupsMixin
from mattermost_plugin._internal.mixins.properties import PropertiesMixin
from mattermost_plugin._internal.mixins.remaining import RemainingMixin

__all__ = [
    "UsersMixin",
    "TeamsMixin",
    "ChannelsMixin",
    "PostsMixin",
    "FilesMixin",
    "KVStoreMixin",
    "BotsMixin",
    "CommandsMixin",
    "ConfigMixin",
    "PreferencesMixin",
    "OAuthMixin",
    "GroupsMixin",
    "PropertiesMixin",
    "RemainingMixin",
]
