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

__all__ = [
    "UsersMixin",
    "TeamsMixin",
    "ChannelsMixin",
    "PostsMixin",
    "FilesMixin",
    "KVStoreMixin",
]
