# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Pythonic wrapper types for Mattermost Plugin API entities.

This module provides dataclass-based wrappers that convert between the raw
protobuf messages and Pythonic types. These wrappers are the public API
surface for SDK users - they never need to interact with protobuf directly.

Naming Convention:
    - `from_proto(proto)` - classmethod to create wrapper from protobuf
    - `to_proto()` - method to convert wrapper back to protobuf

All wrapper types are immutable (frozen dataclasses) to prevent accidental
modification and enable hashing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from mattermost_plugin.grpc import user_pb2, team_pb2, channel_pb2, api_user_team_pb2, api_channel_post_pb2


# =============================================================================
# ENUMS
# =============================================================================


class TeamType(str, Enum):
    """Type of team visibility."""

    OPEN = "O"
    INVITE = "I"


class ChannelType(str, Enum):
    """Type of channel."""

    OPEN = "O"
    PRIVATE = "P"
    DIRECT = "D"
    GROUP = "G"


# =============================================================================
# USER TYPES
# =============================================================================


@dataclass(frozen=True)
class User:
    """
    Represents a Mattermost user.

    This is a Pythonic wrapper around the protobuf User message that provides
    type safety and a clean API surface.

    Attributes:
        id: Unique identifier for the user.
        create_at: Unix timestamp (milliseconds) when user was created.
        update_at: Unix timestamp (milliseconds) when user was last updated.
        delete_at: Unix timestamp (milliseconds) when user was deleted (0 if not deleted).
        username: Unique username for the user.
        email: User's email address.
        email_verified: Whether the email has been verified.
        nickname: User's display nickname.
        first_name: User's first name.
        last_name: User's last name.
        position: User's job position/title.
        roles: Space-separated list of roles.
        locale: User's preferred locale.
        timezone: User's timezone settings.
        is_bot: Whether this user is a bot account.
        props: User properties.
        notify_props: Notification preferences.
    """

    id: str
    username: str = ""
    email: str = ""
    create_at: int = 0
    update_at: int = 0
    delete_at: int = 0
    email_verified: bool = False
    nickname: str = ""
    first_name: str = ""
    last_name: str = ""
    position: str = ""
    roles: str = ""
    locale: str = ""
    timezone: Dict[str, str] = field(default_factory=dict)
    is_bot: bool = False
    bot_description: str = ""
    auth_data: Optional[str] = None
    auth_service: str = ""
    props: Dict[str, str] = field(default_factory=dict)
    notify_props: Dict[str, str] = field(default_factory=dict)
    last_password_update: int = 0
    last_picture_update: int = 0
    failed_attempts: int = 0
    mfa_active: bool = False
    remote_id: Optional[str] = None
    last_activity_at: int = 0
    bot_last_icon_update: int = 0
    terms_of_service_id: str = ""
    terms_of_service_create_at: int = 0
    disable_welcome_email: bool = False
    last_login: int = 0

    @classmethod
    def from_proto(cls, proto: "user_pb2.User") -> "User":
        """Create a User from a protobuf message."""
        return cls(
            id=proto.id,
            username=proto.username,
            email=proto.email,
            create_at=proto.create_at,
            update_at=proto.update_at,
            delete_at=proto.delete_at,
            email_verified=proto.email_verified,
            nickname=proto.nickname,
            first_name=proto.first_name,
            last_name=proto.last_name,
            position=proto.position,
            roles=proto.roles,
            locale=proto.locale,
            timezone=dict(proto.timezone),
            is_bot=proto.is_bot,
            bot_description=proto.bot_description,
            auth_data=proto.auth_data if proto.HasField("auth_data") else None,
            auth_service=proto.auth_service,
            props=dict(proto.props),
            notify_props=dict(proto.notify_props),
            last_password_update=proto.last_password_update,
            last_picture_update=proto.last_picture_update,
            failed_attempts=proto.failed_attempts,
            mfa_active=proto.mfa_active,
            remote_id=proto.remote_id if proto.HasField("remote_id") else None,
            last_activity_at=proto.last_activity_at,
            bot_last_icon_update=proto.bot_last_icon_update,
            terms_of_service_id=proto.terms_of_service_id,
            terms_of_service_create_at=proto.terms_of_service_create_at,
            disable_welcome_email=proto.disable_welcome_email,
            last_login=proto.last_login,
        )

    def to_proto(self) -> "user_pb2.User":
        """Convert to a protobuf message."""
        from mattermost_plugin.grpc import user_pb2

        proto = user_pb2.User(
            id=self.id,
            username=self.username,
            email=self.email,
            create_at=self.create_at,
            update_at=self.update_at,
            delete_at=self.delete_at,
            email_verified=self.email_verified,
            nickname=self.nickname,
            first_name=self.first_name,
            last_name=self.last_name,
            position=self.position,
            roles=self.roles,
            locale=self.locale,
            is_bot=self.is_bot,
            bot_description=self.bot_description,
            auth_service=self.auth_service,
            last_password_update=self.last_password_update,
            last_picture_update=self.last_picture_update,
            failed_attempts=self.failed_attempts,
            mfa_active=self.mfa_active,
            last_activity_at=self.last_activity_at,
            bot_last_icon_update=self.bot_last_icon_update,
            terms_of_service_id=self.terms_of_service_id,
            terms_of_service_create_at=self.terms_of_service_create_at,
            disable_welcome_email=self.disable_welcome_email,
            last_login=self.last_login,
        )

        # Set optional fields
        if self.auth_data is not None:
            proto.auth_data = self.auth_data
        if self.remote_id is not None:
            proto.remote_id = self.remote_id

        # Set map fields
        proto.timezone.update(self.timezone)
        proto.props.update(self.props)
        proto.notify_props.update(self.notify_props)

        return proto


@dataclass(frozen=True)
class UserStatus:
    """
    Represents a user's online status.

    Attributes:
        user_id: The ID of the user.
        status: Status string (online, away, dnd, offline).
        manual: Whether status was manually set.
        last_activity_at: Unix timestamp of last activity.
        dnd_end_time: Unix timestamp when DND ends (0 if not in DND).
    """

    user_id: str
    status: str
    manual: bool = False
    last_activity_at: int = 0
    dnd_end_time: int = 0

    @classmethod
    def from_proto(cls, proto: "api_user_team_pb2.Status") -> "UserStatus":
        """Create a UserStatus from a protobuf message."""
        return cls(
            user_id=proto.user_id,
            status=proto.status,
            manual=proto.manual,
            last_activity_at=proto.last_activity_at,
            dnd_end_time=proto.dnd_end_time,
        )


@dataclass(frozen=True)
class CustomStatus:
    """
    Represents a user's custom status.

    Attributes:
        emoji: The emoji for the custom status.
        text: The text for the custom status.
        duration: Duration preset (e.g., "thirty_minutes", "one_hour").
        expires_at: Unix timestamp when status expires.
    """

    emoji: str = ""
    text: str = ""
    duration: str = ""
    expires_at: int = 0

    @classmethod
    def from_proto(cls, proto: "api_user_team_pb2.CustomStatus") -> "CustomStatus":
        """Create a CustomStatus from a protobuf message."""
        return cls(
            emoji=proto.emoji,
            text=proto.text,
            duration=proto.duration,
            expires_at=proto.expires_at,
        )

    def to_proto(self) -> "api_user_team_pb2.CustomStatus":
        """Convert to a protobuf message."""
        from mattermost_plugin.grpc import api_user_team_pb2

        return api_user_team_pb2.CustomStatus(
            emoji=self.emoji,
            text=self.text,
            duration=self.duration,
            expires_at=self.expires_at,
        )


@dataclass(frozen=True)
class UserAuth:
    """
    Represents a user's authentication information.

    Attributes:
        auth_data: The authentication data (e.g., LDAP ID).
        auth_service: The authentication service name.
    """

    auth_data: Optional[str] = None
    auth_service: str = ""

    @classmethod
    def from_proto(cls, proto: "api_user_team_pb2.UserAuth") -> "UserAuth":
        """Create a UserAuth from a protobuf message."""
        return cls(
            auth_data=proto.auth_data if proto.HasField("auth_data") else None,
            auth_service=proto.auth_service,
        )

    def to_proto(self) -> "api_user_team_pb2.UserAuth":
        """Convert to a protobuf message."""
        from mattermost_plugin.grpc import api_user_team_pb2

        proto = api_user_team_pb2.UserAuth(
            auth_service=self.auth_service,
        )
        if self.auth_data is not None:
            proto.auth_data = self.auth_data
        return proto


@dataclass(frozen=True)
class Session:
    """
    Represents a user session.

    Attributes:
        id: Unique session identifier.
        token: Session token.
        create_at: Unix timestamp when session was created.
        expires_at: Unix timestamp when session expires.
        last_activity_at: Unix timestamp of last activity.
        user_id: ID of the user who owns this session.
        device_id: Device ID if applicable.
        roles: Space-separated list of roles.
        is_oauth: Whether this is an OAuth session.
        props: Session properties.
    """

    id: str
    token: str = ""
    create_at: int = 0
    expires_at: int = 0
    last_activity_at: int = 0
    user_id: str = ""
    device_id: str = ""
    roles: str = ""
    is_oauth: bool = False
    expired_notify: bool = False
    props: Dict[str, str] = field(default_factory=dict)
    local: bool = False

    @classmethod
    def from_proto(cls, proto: "api_user_team_pb2.Session") -> "Session":
        """Create a Session from a protobuf message."""
        return cls(
            id=proto.id,
            token=proto.token,
            create_at=proto.create_at,
            expires_at=proto.expires_at,
            last_activity_at=proto.last_activity_at,
            user_id=proto.user_id,
            device_id=proto.device_id,
            roles=proto.roles,
            is_oauth=proto.is_oauth,
            expired_notify=proto.expired_notify,
            props=dict(proto.props),
            local=proto.local,
        )

    def to_proto(self) -> "api_user_team_pb2.Session":
        """Convert to a protobuf message."""
        from mattermost_plugin.grpc import api_user_team_pb2

        proto = api_user_team_pb2.Session(
            id=self.id,
            token=self.token,
            create_at=self.create_at,
            expires_at=self.expires_at,
            last_activity_at=self.last_activity_at,
            user_id=self.user_id,
            device_id=self.device_id,
            roles=self.roles,
            is_oauth=self.is_oauth,
            expired_notify=self.expired_notify,
            local=self.local,
        )
        proto.props.update(self.props)
        return proto


@dataclass(frozen=True)
class UserAccessToken:
    """
    Represents a user access token.

    Attributes:
        id: Unique token identifier.
        token: The actual token string.
        user_id: ID of the user who owns this token.
        description: Description of the token.
        is_active: Whether the token is active.
    """

    id: str
    token: str = ""
    user_id: str = ""
    description: str = ""
    is_active: bool = True

    @classmethod
    def from_proto(cls, proto: "api_user_team_pb2.UserAccessToken") -> "UserAccessToken":
        """Create a UserAccessToken from a protobuf message."""
        return cls(
            id=proto.id,
            token=proto.token,
            user_id=proto.user_id,
            description=proto.description,
            is_active=proto.is_active,
        )

    def to_proto(self) -> "api_user_team_pb2.UserAccessToken":
        """Convert to a protobuf message."""
        from mattermost_plugin.grpc import api_user_team_pb2

        return api_user_team_pb2.UserAccessToken(
            id=self.id,
            token=self.token,
            user_id=self.user_id,
            description=self.description,
            is_active=self.is_active,
        )


# =============================================================================
# TEAM TYPES
# =============================================================================


def _proto_team_type_to_str(proto_type: int) -> str:
    """Convert protobuf TeamType enum to string."""
    from mattermost_plugin.grpc import team_pb2

    if proto_type == team_pb2.TEAM_TYPE_OPEN:
        return "O"
    elif proto_type == team_pb2.TEAM_TYPE_INVITE:
        return "I"
    return "O"  # Default to open


def _str_team_type_to_proto(type_str: str) -> int:
    """Convert string team type to protobuf enum."""
    from mattermost_plugin.grpc import team_pb2

    if type_str == "I":
        return team_pb2.TEAM_TYPE_INVITE
    return team_pb2.TEAM_TYPE_OPEN


@dataclass(frozen=True)
class Team:
    """
    Represents a Mattermost team.

    Attributes:
        id: Unique identifier for the team.
        create_at: Unix timestamp (milliseconds) when team was created.
        update_at: Unix timestamp (milliseconds) when team was last updated.
        delete_at: Unix timestamp (milliseconds) when team was deleted (0 if not deleted).
        display_name: Display name of the team.
        name: URL-safe name of the team.
        description: Team description.
        email: Team email address.
        type: Team type (O=open, I=invite only).
        company_name: Company name.
        allowed_domains: Comma-separated list of allowed email domains.
        invite_id: Invite ID for the team.
        allow_open_invite: Whether open invites are allowed.
        scheme_id: ID of the permissions scheme.
        group_constrained: Whether team is group-constrained.
        policy_id: Data retention policy ID.
    """

    id: str
    display_name: str = ""
    name: str = ""
    create_at: int = 0
    update_at: int = 0
    delete_at: int = 0
    description: str = ""
    email: str = ""
    type: str = "O"
    company_name: str = ""
    allowed_domains: str = ""
    invite_id: str = ""
    allow_open_invite: bool = False
    last_team_icon_update: int = 0
    scheme_id: Optional[str] = None
    group_constrained: Optional[bool] = None
    policy_id: Optional[str] = None
    cloud_limits_archived: bool = False

    @classmethod
    def from_proto(cls, proto: "team_pb2.Team") -> "Team":
        """Create a Team from a protobuf message."""
        return cls(
            id=proto.id,
            display_name=proto.display_name,
            name=proto.name,
            create_at=proto.create_at,
            update_at=proto.update_at,
            delete_at=proto.delete_at,
            description=proto.description,
            email=proto.email,
            type=_proto_team_type_to_str(proto.type),
            company_name=proto.company_name,
            allowed_domains=proto.allowed_domains,
            invite_id=proto.invite_id,
            allow_open_invite=proto.allow_open_invite,
            last_team_icon_update=proto.last_team_icon_update,
            scheme_id=proto.scheme_id if proto.HasField("scheme_id") else None,
            group_constrained=proto.group_constrained if proto.HasField("group_constrained") else None,
            policy_id=proto.policy_id if proto.HasField("policy_id") else None,
            cloud_limits_archived=proto.cloud_limits_archived,
        )

    def to_proto(self) -> "team_pb2.Team":
        """Convert to a protobuf message."""
        from mattermost_plugin.grpc import team_pb2

        proto = team_pb2.Team(
            id=self.id,
            display_name=self.display_name,
            name=self.name,
            create_at=self.create_at,
            update_at=self.update_at,
            delete_at=self.delete_at,
            description=self.description,
            email=self.email,
            type=_str_team_type_to_proto(self.type),
            company_name=self.company_name,
            allowed_domains=self.allowed_domains,
            invite_id=self.invite_id,
            allow_open_invite=self.allow_open_invite,
            last_team_icon_update=self.last_team_icon_update,
            cloud_limits_archived=self.cloud_limits_archived,
        )

        if self.scheme_id is not None:
            proto.scheme_id = self.scheme_id
        if self.group_constrained is not None:
            proto.group_constrained = self.group_constrained
        if self.policy_id is not None:
            proto.policy_id = self.policy_id

        return proto


@dataclass(frozen=True)
class TeamMember:
    """
    Represents a team membership.

    Attributes:
        team_id: ID of the team.
        user_id: ID of the user.
        roles: Space-separated list of roles.
        delete_at: Unix timestamp when membership was deleted (0 if not deleted).
        scheme_guest: Whether user is a guest through scheme.
        scheme_user: Whether user is a member through scheme.
        scheme_admin: Whether user is an admin through scheme.
        create_at: Unix timestamp when membership was created.
    """

    team_id: str
    user_id: str
    roles: str = ""
    delete_at: int = 0
    scheme_guest: bool = False
    scheme_user: bool = False
    scheme_admin: bool = False
    create_at: int = 0

    @classmethod
    def from_proto(cls, proto: "team_pb2.TeamMember") -> "TeamMember":
        """Create a TeamMember from a protobuf message."""
        return cls(
            team_id=proto.team_id,
            user_id=proto.user_id,
            roles=proto.roles,
            delete_at=proto.delete_at,
            scheme_guest=proto.scheme_guest,
            scheme_user=proto.scheme_user,
            scheme_admin=proto.scheme_admin,
            create_at=proto.create_at,
        )


@dataclass(frozen=True)
class TeamMemberWithError:
    """
    Represents a team membership result with potential error.

    Used for graceful batch operations where some may fail.

    Attributes:
        user_id: ID of the user.
        member: The team member if successful, None otherwise.
        error: Error message if failed, None otherwise.
    """

    user_id: str
    member: Optional[TeamMember] = None
    error: Optional[str] = None

    @classmethod
    def from_proto(cls, proto: "api_user_team_pb2.TeamMemberWithError") -> "TeamMemberWithError":
        """Create a TeamMemberWithError from a protobuf message."""
        member = None
        if proto.HasField("member"):
            member = TeamMember.from_proto(proto.member)

        error = None
        if proto.HasField("error") and proto.error.id:
            error = proto.error.message

        return cls(
            user_id=proto.user_id,
            member=member,
            error=error,
        )


@dataclass(frozen=True)
class TeamUnread:
    """
    Represents unread counts for a team.

    Attributes:
        team_id: ID of the team.
        msg_count: Total unread message count.
        mention_count: Mention count.
        mention_count_root: Root post mention count.
        msg_count_root: Root post message count.
        thread_count: Unread thread count.
        thread_mention_count: Thread mention count.
    """

    team_id: str
    msg_count: int = 0
    mention_count: int = 0
    mention_count_root: int = 0
    msg_count_root: int = 0
    thread_count: int = 0
    thread_mention_count: int = 0

    @classmethod
    def from_proto(cls, proto: "team_pb2.TeamUnread") -> "TeamUnread":
        """Create a TeamUnread from a protobuf message."""
        return cls(
            team_id=proto.team_id,
            msg_count=proto.msg_count,
            mention_count=proto.mention_count,
            mention_count_root=proto.mention_count_root,
            msg_count_root=proto.msg_count_root,
            thread_count=proto.thread_count,
            thread_mention_count=proto.thread_mention_count,
        )


@dataclass(frozen=True)
class TeamStats:
    """
    Represents team statistics.

    Attributes:
        team_id: ID of the team.
        total_member_count: Total number of members.
        active_member_count: Number of active members.
    """

    team_id: str
    total_member_count: int = 0
    active_member_count: int = 0

    @classmethod
    def from_proto(cls, proto: "api_user_team_pb2.TeamStats") -> "TeamStats":
        """Create a TeamStats from a protobuf message."""
        return cls(
            team_id=proto.team_id,
            total_member_count=proto.total_member_count,
            active_member_count=proto.active_member_count,
        )


# =============================================================================
# CHANNEL TYPES
# =============================================================================


def _proto_channel_type_to_str(proto_type: int) -> str:
    """Convert protobuf ChannelType enum to string."""
    from mattermost_plugin.grpc import channel_pb2

    if proto_type == channel_pb2.CHANNEL_TYPE_OPEN:
        return "O"
    elif proto_type == channel_pb2.CHANNEL_TYPE_PRIVATE:
        return "P"
    elif proto_type == channel_pb2.CHANNEL_TYPE_DIRECT:
        return "D"
    elif proto_type == channel_pb2.CHANNEL_TYPE_GROUP:
        return "G"
    return "O"  # Default to open


def _str_channel_type_to_proto(type_str: str) -> int:
    """Convert string channel type to protobuf enum."""
    from mattermost_plugin.grpc import channel_pb2

    if type_str == "P":
        return channel_pb2.CHANNEL_TYPE_PRIVATE
    elif type_str == "D":
        return channel_pb2.CHANNEL_TYPE_DIRECT
    elif type_str == "G":
        return channel_pb2.CHANNEL_TYPE_GROUP
    return channel_pb2.CHANNEL_TYPE_OPEN


@dataclass(frozen=True)
class Channel:
    """
    Represents a Mattermost channel.

    Attributes:
        id: Unique identifier for the channel.
        create_at: Unix timestamp (milliseconds) when channel was created.
        update_at: Unix timestamp (milliseconds) when channel was last updated.
        delete_at: Unix timestamp (milliseconds) when channel was deleted (0 if not deleted).
        team_id: ID of the team this channel belongs to.
        type: Channel type (O=open, P=private, D=direct, G=group).
        display_name: Display name of the channel.
        name: URL-safe name of the channel.
        header: Channel header text.
        purpose: Channel purpose text.
        last_post_at: Unix timestamp of last post.
        total_msg_count: Total message count.
        creator_id: ID of the user who created the channel.
        scheme_id: ID of the permissions scheme.
        group_constrained: Whether channel is group-constrained.
    """

    id: str
    team_id: str = ""
    display_name: str = ""
    name: str = ""
    create_at: int = 0
    update_at: int = 0
    delete_at: int = 0
    type: str = "O"
    header: str = ""
    purpose: str = ""
    last_post_at: int = 0
    total_msg_count: int = 0
    extra_update_at: int = 0
    creator_id: str = ""
    scheme_id: Optional[str] = None
    props: Dict[str, object] = field(default_factory=dict)
    group_constrained: Optional[bool] = None
    auto_translation: bool = False
    shared: Optional[bool] = None
    total_msg_count_root: int = 0
    policy_id: Optional[str] = None
    last_root_post_at: int = 0
    policy_enforced: bool = False
    policy_is_active: bool = False
    default_category_name: str = ""

    @classmethod
    def from_proto(cls, proto: "channel_pb2.Channel") -> "Channel":
        """Create a Channel from a protobuf message."""
        from google.protobuf.json_format import MessageToDict

        props = {}
        if proto.HasField("props"):
            props = MessageToDict(proto.props)

        return cls(
            id=proto.id,
            team_id=proto.team_id,
            display_name=proto.display_name,
            name=proto.name,
            create_at=proto.create_at,
            update_at=proto.update_at,
            delete_at=proto.delete_at,
            type=_proto_channel_type_to_str(proto.type),
            header=proto.header,
            purpose=proto.purpose,
            last_post_at=proto.last_post_at,
            total_msg_count=proto.total_msg_count,
            extra_update_at=proto.extra_update_at,
            creator_id=proto.creator_id,
            scheme_id=proto.scheme_id if proto.HasField("scheme_id") else None,
            props=props,
            group_constrained=proto.group_constrained if proto.HasField("group_constrained") else None,
            auto_translation=proto.auto_translation,
            shared=proto.shared if proto.HasField("shared") else None,
            total_msg_count_root=proto.total_msg_count_root,
            policy_id=proto.policy_id if proto.HasField("policy_id") else None,
            last_root_post_at=proto.last_root_post_at,
            policy_enforced=proto.policy_enforced,
            policy_is_active=proto.policy_is_active,
            default_category_name=proto.default_category_name,
        )

    def to_proto(self) -> "channel_pb2.Channel":
        """Convert to a protobuf message."""
        from google.protobuf.json_format import ParseDict
        from google.protobuf.struct_pb2 import Struct

        from mattermost_plugin.grpc import channel_pb2

        proto = channel_pb2.Channel(
            id=self.id,
            team_id=self.team_id,
            display_name=self.display_name,
            name=self.name,
            create_at=self.create_at,
            update_at=self.update_at,
            delete_at=self.delete_at,
            type=_str_channel_type_to_proto(self.type),
            header=self.header,
            purpose=self.purpose,
            last_post_at=self.last_post_at,
            total_msg_count=self.total_msg_count,
            extra_update_at=self.extra_update_at,
            creator_id=self.creator_id,
            auto_translation=self.auto_translation,
            total_msg_count_root=self.total_msg_count_root,
            last_root_post_at=self.last_root_post_at,
            policy_enforced=self.policy_enforced,
            policy_is_active=self.policy_is_active,
            default_category_name=self.default_category_name,
        )

        if self.scheme_id is not None:
            proto.scheme_id = self.scheme_id
        if self.group_constrained is not None:
            proto.group_constrained = self.group_constrained
        if self.shared is not None:
            proto.shared = self.shared
        if self.policy_id is not None:
            proto.policy_id = self.policy_id

        if self.props:
            props_struct = Struct()
            ParseDict(self.props, props_struct)
            proto.props.CopyFrom(props_struct)

        return proto


@dataclass(frozen=True)
class ChannelMember:
    """
    Represents a channel membership.

    Attributes:
        channel_id: ID of the channel.
        user_id: ID of the user.
        roles: Space-separated list of roles.
        last_viewed_at: Unix timestamp when user last viewed channel.
        msg_count: Message count at last view.
        mention_count: Unread mention count.
        mention_count_root: Root post mention count.
        msg_count_root: Root post message count.
        notify_props: Notification preferences.
        last_update_at: Unix timestamp of last update.
        scheme_guest: Whether user is a guest through scheme.
        scheme_user: Whether user is a member through scheme.
        scheme_admin: Whether user is an admin through scheme.
        urgent_mention_count: Urgent mention count.
    """

    channel_id: str
    user_id: str
    roles: str = ""
    last_viewed_at: int = 0
    msg_count: int = 0
    mention_count: int = 0
    mention_count_root: int = 0
    msg_count_root: int = 0
    notify_props: Dict[str, str] = field(default_factory=dict)
    last_update_at: int = 0
    scheme_guest: bool = False
    scheme_user: bool = False
    scheme_admin: bool = False
    urgent_mention_count: int = 0

    @classmethod
    def from_proto(cls, proto: "api_channel_post_pb2.ChannelMember") -> "ChannelMember":
        """Create a ChannelMember from a protobuf message."""
        return cls(
            channel_id=proto.channel_id,
            user_id=proto.user_id,
            roles=proto.roles,
            last_viewed_at=proto.last_viewed_at,
            msg_count=proto.msg_count,
            mention_count=proto.mention_count,
            mention_count_root=proto.mention_count_root,
            msg_count_root=proto.msg_count_root,
            notify_props=dict(proto.notify_props),
            last_update_at=proto.last_update_at,
            scheme_guest=proto.scheme_guest,
            scheme_user=proto.scheme_user,
            scheme_admin=proto.scheme_admin,
            urgent_mention_count=proto.urgent_mention_count,
        )


@dataclass(frozen=True)
class ChannelStats:
    """
    Represents channel statistics.

    Attributes:
        channel_id: ID of the channel.
        member_count: Number of members.
        guest_count: Number of guests.
        pinnedpost_count: Number of pinned posts.
        files_count: Number of files.
    """

    channel_id: str
    member_count: int = 0
    guest_count: int = 0
    pinnedpost_count: int = 0
    files_count: int = 0

    @classmethod
    def from_proto(cls, proto: "api_channel_post_pb2.ChannelStats") -> "ChannelStats":
        """Create a ChannelStats from a protobuf message."""
        return cls(
            channel_id=proto.channel_id,
            member_count=proto.member_count,
            guest_count=proto.guest_count,
            pinnedpost_count=proto.pinnedpost_count,
            files_count=proto.files_count,
        )


@dataclass(frozen=True)
class SidebarCategoryWithChannels:
    """
    Represents a sidebar category with its channels.

    Attributes:
        id: Category ID.
        user_id: User ID who owns this category.
        team_id: Team ID this category belongs to.
        display_name: Display name of the category.
        type: Category type.
        sorting: Sorting preference.
        muted: Whether category is muted.
        collapsed: Whether category is collapsed.
        channel_ids: List of channel IDs in this category.
    """

    id: str = ""
    user_id: str = ""
    team_id: str = ""
    display_name: str = ""
    type: str = ""
    sorting: int = 0
    muted: bool = False
    collapsed: bool = False
    channel_ids: List[str] = field(default_factory=list)

    @classmethod
    def from_proto(cls, proto: "api_channel_post_pb2.SidebarCategoryWithChannels") -> "SidebarCategoryWithChannels":
        """Create a SidebarCategoryWithChannels from a protobuf message."""
        return cls(
            id=proto.id,
            user_id=proto.user_id,
            team_id=proto.team_id,
            display_name=proto.display_name,
            type=proto.type,
            sorting=proto.sorting,
            muted=proto.muted,
            collapsed=proto.collapsed,
            channel_ids=list(proto.channel_ids),
        )

    def to_proto(self) -> "api_channel_post_pb2.SidebarCategoryWithChannels":
        """Convert to a protobuf message."""
        from mattermost_plugin.grpc import api_channel_post_pb2

        return api_channel_post_pb2.SidebarCategoryWithChannels(
            id=self.id,
            user_id=self.user_id,
            team_id=self.team_id,
            display_name=self.display_name,
            type=self.type,
            sorting=self.sorting,
            muted=self.muted,
            collapsed=self.collapsed,
            channel_ids=self.channel_ids,
        )


@dataclass(frozen=True)
class OrderedSidebarCategories:
    """
    Represents ordered sidebar categories for a user in a team.

    Attributes:
        categories: List of sidebar categories with channels.
        order: Order of category IDs.
    """

    categories: List[SidebarCategoryWithChannels] = field(default_factory=list)
    order: List[str] = field(default_factory=list)

    @classmethod
    def from_proto(cls, proto: "api_channel_post_pb2.OrderedSidebarCategories") -> "OrderedSidebarCategories":
        """Create an OrderedSidebarCategories from a protobuf message."""
        return cls(
            categories=[SidebarCategoryWithChannels.from_proto(c) for c in proto.categories],
            order=list(proto.order),
        )


# =============================================================================
# VIEW RESTRICTIONS
# =============================================================================


@dataclass(frozen=True)
class ViewUsersRestrictions:
    """
    Represents restrictions on which users can be viewed.

    Attributes:
        teams: List of team IDs to restrict to.
        channels: List of channel IDs to restrict to.
    """

    teams: List[str] = field(default_factory=list)
    channels: List[str] = field(default_factory=list)

    def to_proto(self) -> "user_pb2.ViewUsersRestrictions":
        """Convert to a protobuf message."""
        from mattermost_plugin.grpc import user_pb2

        return user_pb2.ViewUsersRestrictions(
            teams=self.teams,
            channels=self.channels,
        )
