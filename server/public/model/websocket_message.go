// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strconv"
)

const (
	// A Typing event is sent whenever a user is typing in a channel or thread. It's sent to all users with permission
	// to read that channel or thread.
	WebsocketEventTyping = "typing"

	// A Posted event is sent whenever a post is created. It's sent to all users with permission to read that post.
	WebsocketEventPosted = "posted"
	// A PostEdited event is sent whenever a post is updated. It's sent to all users with permission to read that post.
	WebsocketEventPostEdited = "post_edited"
	// A PostDeleted event is sent whenever a post is deleted. It's sent to all users with permission to read that post.
	WebsocketEventPostDeleted = "post_deleted"
	// A PostUnread event is sent when a post is marked as unread by a user. It's sent to only that user.
	WebsocketEventPostUnread = "post_unread"

	// A ChannelConverted event is sent whenever a channel is converted from a public to a private channel or vice
	// versa. It's sent to all users with permission to read that channel.
	WebsocketEventChannelConverted = "channel_converted"
	// A ChannelCreated event is sent whenever a channel is created. It's sent to the user who created the channel.
	WebsocketEventChannelCreated = "channel_created"
	// A ChanelDeleted event is sent whenever a channel is archived or permanently deleted. It's sent to all members of
	// that channel.
	WebsocketEventChannelDeleted = "channel_deleted"
	// A ChannelRestored event is sent whenever a channel is unarchived. It's sent to all members of that channel.
	WebsocketEventChannelRestored = "channel_restored"
	// A ChannelUpdated event is sent whenever most fields of a [channel] are updated. It's sent to all members of that
	// channel.
	WebsocketEventChannelUpdated = "channel_updated"

	// A ChannelMemberUpdated event is sent whenever any fields of a user's [ChannelMember] is modified such as if
	// their channel-specific notification settings change or that channel is muted. It's sent to only that user.
	WebsocketEventChannelMemberUpdated = "channel_member_updated"

	// A ChannelSchemeUpdated event is sent whenever the permissions for a channel are modified. It's sent to
	// members of that channel.
	WebsocketEventChannelSchemeUpdated = "channel_scheme_updated"

	// A DirectAdded event is sent whenever a direct channel between two users is created. This typically happens when
	// one of those users opens the DM channel for the first time. It's sent to both members of the new channel.
	WebsocketEventDirectAdded = "direct_added"
	// A GroupAdded event is sent whenever a group channel between a group of users is created. It's sent to all
	// members of the new channel.
	WebsocketEventGroupAdded = "group_added"

	// A NewUser event is sent whenever a new user is created. It's sent to all users.
	WebsocketEventNewUser = "new_user"

	// An AddedToTeam event is sent when a user joins or is added to a team. It's sent to the user who joined or was
	// added.
	WebsocketEventAddedToTeam = "added_to_team"
	// A LeaveTeam event is sent whenever a user leaves or is removed from a team. It's sent to the user who left or
	// was removed and to every member of that team.
	WebsocketEventLeaveTeam = "leave_team"

	// An UpdateTeam event is sent whenever most fields of a [Team] are updated. It's sent to all members of that team.
	WebsocketEventUpdateTeam = "update_team"
	// A DeleteTeam event is sent whenever a team is soft or permanently deleted. It's sent to all members of that
	// team.
	WebsocketEventDeleteTeam = "delete_team"
	// A RestoreTeam event is sent whenever a soft deleted team is restored. It's sent to all members of that team.
	WebsocketEventRestoreTeam = "restore_team"

	// A TeamSchemeUpdated event is sent whenever the permissions for a team are modified. It's sent to all members of
	// that team.
	WebsocketEventUpdateTeamScheme = "update_team_scheme"

	// A UserAdded event is sent whenever a user joins or is added to a channel. It's sent to all members of that
	// channel.
	WebsocketEventUserAdded = "user_added"

	// A UserUpdated event is sent whenever most fields of a [User] are updated. It's sent to all users.
	WebsocketEventUserUpdated = "user_updated"

	// A UserRoleUpdated event is sent whenever a user's system-wide roles ([User.Roles]) are modified. It's sent only
	// to that user.
	WebsocketEventUserRoleUpdated = "user_role_updated"

	// A MemberRoleUpdated event is sent whenever a user's team-specific roles ([TeamMember.Roles]) are modified. It's
	// sent only to that user.
	WebsocketEventMemberroleUpdated = "memberrole_updated"

	// A UserRemoved event is sent whenever a user leaves or is removed from a channel. It's sent to all members of
	// that channel.
	WebsocketEventUserRemoved = "user_removed"

	// A PreferenceChanged event is sent whenever a [Preference] is added or modified for a user. Currently only used by
	// the `/collapse` and `/expand` slash commands. It's sent only to that user.
	WebsocketEventPreferenceChanged = "preference_changed"
	// A PreferencesChanged event is sent whenever one or more [Preference]s are added or modified for a user. It's
	// sent only to that user.
	WebsocketEventPreferencesChanged = "preferences_changed"
	// A PreferencesDeleted event is sent whenever one or more [Preferences]s are deleted for a user. It's sent only to
	// that user.
	WebsocketEventPreferencesDeleted = "preferences_deleted"

	// An EphemeralMessage event is sent whenever the server wants a client to show the user a temporary message as if
	// it were a post. For example, this can happen in response to a slash command or for post reminders. It's sent
	// only to that user.
	WebsocketEventEphemeralMessage = "ephemeral_message"

	// A StatusChange event is sent to a user whenever their status changes. It's sent only to that user.
	WebsocketEventStatusChange = "status_change"

	// A Hello event is sent whenever a client reconnects to the server after having missed one or more messages. It's
	// only sent to the affected client.
	WebsocketEventHello = "hello"

	// A ReactionAdded event is sent whenever an emoji reaction is added to a post. It's sent to all users with
	// permission to read that post.
	WebsocketEventReactionAdded = "reaction_added"
	// A ReactionRemoved event is sent whenever an emoji reaction is removed from a post. It's sent to all users with
	// permission to read that post.
	WebsocketEventReactionRemoved = "reaction_removed"

	// A Response event is used by [WebSocketClient] for responses to messages sent to the server. It is not sent to
	// clients normally.
	WebsocketEventResponse = "response"

	// An EmojiAdded event is sent whenever a custom emoji is created. It's sent to all users.
	WebsocketEventEmojiAdded = "emoji_added"

	// Deprecated: WebsocketEventChannelViewed has been replaced by WebsocketEventMultipleChannelsViewed as of
	// Mattermost 9.0.
	WebsocketEventChannelViewed = "channel_viewed"
	// A MultipleChannelsViewed event is sent whenever a user reads one or more channels, marking them entirely as read.
	// It's sent only to that user.
	WebsocketEventMultipleChannelsViewed = "multiple_channels_viewed"

	// A PluginStatusesChanged event is sent whenever a plugin is installed or uninstalled. It's sent only to system
	// administrators.
	WebsocketEventPluginStatusesChanged = "plugin_statuses_changed"
	// A PluginEnabled event is sent whenever a plugin is enabled. It's sent to all users.
	WebsocketEventPluginEnabled = "plugin_enabled"
	// A PluginDisabled event is sent whenever a plugin is disabled. It's sent to all users.
	WebsocketEventPluginDisabled = "plugin_disabled"

	// A RoleUpdated event is sent whenever the permissions of a role is updated. It's sent to all users.
	WebsocketEventRoleUpdated = "role_updated"

	// A LicenseChanged event is sent whenever the server's license is changed. It's sent to all users.
	WebsocketEventLicenseChanged = "license_changed"
	// A ConfigChanged event is sent whenever the server's config is changed. It's sent to all users.
	WebsocketEventConfigChanged = "config_changed"

	// An OpenDialog event is sent whenever an integration wants a client to show a user an interactive dialog. For
	// example, this can happen in response to an integration action. It's sent only to that user.
	WebsocketEventOpenDialog = "open_dialog"

	// A GuestsDeactivated event is sent whenever guest accounts are disabled on the server. It's sent to all users.
	WebsocketEventGuestsDeactivated = "guests_deactivated"

	// A UserActivationStatusChange event is sent whenever a user's account is activated or deactivated. It's sent to
	// all users.
	WebsocketEventUserActivationStatusChange = "user_activation_status_change"

	// A ReceivedGroup event is sent whenever a user group ([Group]) is created, modified, or deleted. It's sent to all
	// users.
	WebsocketEventReceivedGroup = "received_group"
	// A ReceivedGroupAssociatedToTeam event is sent whenever an LDAP group is associated to a team. It's sent to all
	// members of that team.
	WebsocketEventReceivedGroupAssociatedToTeam = "received_group_associated_to_team"
	// A ReceivedGroupAssociatedToTeam event is sent whenever an LDAP group is unassociated to a team. It's sent to all
	// members of that team.
	WebsocketEventReceivedGroupNotAssociatedToTeam = "received_group_not_associated_to_team"
	// A ReceivedGroupAssociatedToChannel event is sent whenever an LDAP group is associated to a channel. It's sent
	// to all members of that channel.
	WebsocketEventReceivedGroupAssociatedToChannel = "received_group_associated_to_channel"
	// A ReceivedGroupAssociatedToChannel event is sent whenever an LDAP group is unassociated to a channel. It's sent
	// to all members of that channel.
	WebsocketEventReceivedGroupNotAssociatedToChannel = "received_group_not_associated_to_channel"
	// A GroupMemberDelete event is sent whenever one or more users are removed from a user group. It's sent to each of
	// those users.
	WebsocketEventGroupMemberDelete = "group_member_deleted"
	// A GroupMemberAdd event is sent whenever one or more users are added to a user group. It's sent to each of those
	// users.
	WebsocketEventGroupMemberAdd = "group_member_add"

	// A SidebarCategoryCreated event is sent whenever a new channel sidebar category is created. It's sent only to the
	// affected user.
	WebsocketEventSidebarCategoryCreated = "sidebar_category_created"
	// A SidebarCategoryCreated event is sent whenever a channel sidebar category is is modified or has a channel
	// added to or removed from it. It's sent only to the affected user.
	WebsocketEventSidebarCategoryUpdated = "sidebar_category_updated"
	// A SidebarCategoryDeleted event is sent whenever a channel sidebar category is deleted. It's sent only to the
	// affected user.
	WebsocketEventSidebarCategoryDeleted = "sidebar_category_deleted"
	// A SidebarCategoryOrderUpdated event is sent whenever a user reorders the categories in their channel sidebar.
	// It's only sent to that user.
	WebsocketEventSidebarCategoryOrderUpdated = "sidebar_category_order_updated"

	// WebsocketWarnMetricStatusReceived events are not used.
	WebsocketWarnMetricStatusReceived = "warn_metric_status_received"
	// A WarnMetricStatusRemoved event is sent whenever a system admin acknowledges and removes a warning announcement
	// in the web app. It's sent to all users.
	WebsocketEventWarnMetricStatusRemoved = "warn_metric_status_removed"
	// Deprecated: Use WebsocketEventWarnMetricStatusRemoved instead.
	WebsocketWarnMetricStatusRemoved = WebsocketEventWarnMetricStatusRemoved

	// A CloudPaymentStatusUpdated event is sent on a Mattermost Cloud server when a payment is made. It's sent to all
	// users.
	WebsocketEventCloudPaymentStatusUpdated = "cloud_payment_status_updated"
	// A CloudSubscriptionChanged event is sent on a Mattermost Cloud server whenever the license is changed. It's sent
	// to all users.
	WebsocketEventCloudSubscriptionChanged = "cloud_subscription_changed"

	// A ThreadUpdated event is sent whenever to a user whenever a followed thread is updated such as if a user replies
	// to it. It's sent to only that user.
	WebsocketEventThreadUpdated = "thread_updated"
	// A ThreadFollowChanged event is sent to a user whenever they manually follow or unfollow a thread. It's sent only
	// to that user.
	WebsocketEventThreadFollowChanged = "thread_follow_changed"
	// A ThreadReadChanged event is sent to a user when one of the following happens:
	//  - If they read a thread or mark a thread as unread, a ThreadReadChanged event is sent with a thread ID and
	//    related metadata in the body.
	//  - If they mark a channel as read, all threads in that channel are marked as read, and a ThreadReadChanged event
	//    with the channel ID in its [WebsocketBroadcast] is sent.
	//  - If they mark all threads on a team as read, all threads in that team are marked as read, and a
	//    ThreadReadChanged event with the team ID in its [WebsocketBroadcast] is sent.
	//
	//  These are sent only to that user.
	WebsocketEventThreadReadChanged = "thread_read_changed"

	// A FirstAdminVisitMarketplaceStatusReceived event is sent the first time an admin visits the App Marketplace in
	// the web app. It's sent to all users.
	WebsocketEventFirstAdminVisitMarketplaceStatusReceived = "first_admin_visit_marketplace_status_received"
	// Deprecated: Use WebsocketEventFirstAdminVisitMarketplaceStatusReceived
	WebsocketFirstAdminVisitMarketplaceStatusReceived = WebsocketEventFirstAdminVisitMarketplaceStatusReceived

	// A DraftCreated event is sent whenever a user creates or modifies a server-synced post draft. It's sent only to
	// that user.
	WebsocketEventDraftCreated = "draft_created"
	// DraftUpdated events are not used.
	WebsocketEventDraftUpdated = "draft_updated"
	// A DraftDeleted event is sent whenever a user deletes a server-synced post draft. It's sent only to that user.
	WebsocketEventDraftDeleted = "draft_deleted"

	// An AcknowledgementAdded event is sent whenever a user acknowledges a post. It's sent to all members of that
	// channel.
	WebsocketEventAcknowledgementAdded = "post_acknowledgement_added"
	// An AcknowledgementRemoved event is sent whenever a user removes acknowledgement from a post. It's sent to all
	// members of that channel.
	WebsocketEventAcknowledgementRemoved = "post_acknowledgement_removed"
	// A PersistentNotificationTriggered event is sent whenever a user should receive a recurring notification for a
	// priority message. It's sent only to that user.
	WebsocketEventPersistentNotificationTriggered = "persistent_notification_triggered"

	// A HostedCustomerSignupProgressUpdated event is sent when a self-hosted Mattermost user is purchasing a license
	// from within the web app. It's sent only to that user.
	WebsocketEventHostedCustomerSignupProgressUpdated = "hosted_customer_signup_progress_updated"

	WebsocketAuthenticationChallenge = "authentication_challenge"
)

type WebSocketMessage interface {
	ToJSON() ([]byte, error)
	IsValid() bool
	EventType() string
}

type WebsocketBroadcast struct {
	OmitUsers             map[string]bool `json:"omit_users"`                        // broadcast is omitted for users listed here
	UserId                string          `json:"user_id"`                           // broadcast only occurs for this user
	ChannelId             string          `json:"channel_id"`                        // broadcast only occurs for users in this channel
	TeamId                string          `json:"team_id"`                           // broadcast only occurs for users in this team
	ConnectionId          string          `json:"connection_id"`                     // broadcast only occurs for this connection
	OmitConnectionId      string          `json:"omit_connection_id"`                // broadcast is omitted for this connection
	ContainsSanitizedData bool            `json:"contains_sanitized_data,omitempty"` // broadcast only occurs for non-sysadmins
	ContainsSensitiveData bool            `json:"contains_sensitive_data,omitempty"` // broadcast only occurs for sysadmins
	// ReliableClusterSend indicates whether or not the message should
	// be sent through the cluster using the reliable, TCP backed channel.
	ReliableClusterSend bool `json:"-"`
}

func (wb *WebsocketBroadcast) copy() *WebsocketBroadcast {
	if wb == nil {
		return nil
	}

	var c WebsocketBroadcast
	if wb.OmitUsers != nil {
		c.OmitUsers = make(map[string]bool, len(wb.OmitUsers))
		for k, v := range wb.OmitUsers {
			c.OmitUsers[k] = v
		}
	}
	c.UserId = wb.UserId
	c.ChannelId = wb.ChannelId
	c.TeamId = wb.TeamId
	c.OmitConnectionId = wb.OmitConnectionId
	c.ContainsSanitizedData = wb.ContainsSanitizedData
	c.ContainsSensitiveData = wb.ContainsSensitiveData

	return &c
}

type precomputedWebSocketEventJSON struct {
	Event     json.RawMessage
	Data      json.RawMessage
	Broadcast json.RawMessage
}

func (p *precomputedWebSocketEventJSON) copy() *precomputedWebSocketEventJSON {
	if p == nil {
		return nil
	}

	var c precomputedWebSocketEventJSON

	if p.Event != nil {
		c.Event = make([]byte, len(p.Event))
		copy(c.Event, p.Event)
	}

	if p.Data != nil {
		c.Data = make([]byte, len(p.Data))
		copy(c.Data, p.Data)
	}

	if p.Broadcast != nil {
		c.Broadcast = make([]byte, len(p.Broadcast))
		copy(c.Broadcast, p.Broadcast)
	}

	return &c
}

// webSocketEventJSON mirrors WebSocketEvent to make some of its unexported fields serializable
type webSocketEventJSON struct {
	Event     string              `json:"event"`
	Data      map[string]any      `json:"data"`
	Broadcast *WebsocketBroadcast `json:"broadcast"`
	Sequence  int64               `json:"seq"`
}

type WebSocketEvent struct {
	event           string
	data            map[string]any
	broadcast       *WebsocketBroadcast
	sequence        int64
	precomputedJSON *precomputedWebSocketEventJSON
}

// PrecomputeJSON precomputes and stores the serialized JSON for all fields other than Sequence.
// This makes ToJSON much more efficient when sending the same event to multiple connections.
func (ev *WebSocketEvent) PrecomputeJSON() *WebSocketEvent {
	evCopy := ev.Copy()
	event, _ := json.Marshal(evCopy.event)
	data, _ := json.Marshal(evCopy.data)
	broadcast, _ := json.Marshal(evCopy.broadcast)
	evCopy.precomputedJSON = &precomputedWebSocketEventJSON{
		Event:     json.RawMessage(event),
		Data:      json.RawMessage(data),
		Broadcast: json.RawMessage(broadcast),
	}
	return evCopy
}

func (ev *WebSocketEvent) Add(key string, value any) {
	ev.data[key] = value
}

func NewWebSocketEvent(event, teamId, channelId, userId string, omitUsers map[string]bool, omitConnectionId string) *WebSocketEvent {
	return &WebSocketEvent{
		event: event,
		data:  make(map[string]any),
		broadcast: &WebsocketBroadcast{
			TeamId:           teamId,
			ChannelId:        channelId,
			UserId:           userId,
			OmitUsers:        omitUsers,
			OmitConnectionId: omitConnectionId},
	}
}

func (ev *WebSocketEvent) Copy() *WebSocketEvent {
	evCopy := &WebSocketEvent{
		event:           ev.event,
		data:            ev.data,
		broadcast:       ev.broadcast,
		sequence:        ev.sequence,
		precomputedJSON: ev.precomputedJSON,
	}
	return evCopy
}

func (ev *WebSocketEvent) DeepCopy() *WebSocketEvent {
	var dataCopy map[string]any
	if ev.data != nil {
		dataCopy = make(map[string]any, len(ev.data))
		for k, v := range ev.data {
			dataCopy[k] = v
		}
	}

	evCopy := &WebSocketEvent{
		event:           ev.event,
		data:            dataCopy,
		broadcast:       ev.broadcast.copy(),
		sequence:        ev.sequence,
		precomputedJSON: ev.precomputedJSON.copy(),
	}
	return evCopy
}

func (ev *WebSocketEvent) GetData() map[string]any {
	return ev.data
}

func (ev *WebSocketEvent) GetBroadcast() *WebsocketBroadcast {
	return ev.broadcast
}

func (ev *WebSocketEvent) GetSequence() int64 {
	return ev.sequence
}

func (ev *WebSocketEvent) SetEvent(event string) *WebSocketEvent {
	evCopy := ev.Copy()
	evCopy.event = event
	return evCopy
}

func (ev *WebSocketEvent) SetData(data map[string]any) *WebSocketEvent {
	evCopy := ev.Copy()
	evCopy.data = data
	return evCopy
}

func (ev *WebSocketEvent) SetBroadcast(broadcast *WebsocketBroadcast) *WebSocketEvent {
	evCopy := ev.Copy()
	evCopy.broadcast = broadcast
	return evCopy
}

func (ev *WebSocketEvent) SetSequence(seq int64) *WebSocketEvent {
	evCopy := ev.Copy()
	evCopy.sequence = seq
	return evCopy
}

func (ev *WebSocketEvent) IsValid() bool {
	return ev.event != ""
}

func (ev *WebSocketEvent) EventType() string {
	return ev.event
}

func (ev *WebSocketEvent) ToJSON() ([]byte, error) {
	if ev.precomputedJSON != nil {
		return ev.precomputedJSONBuf(), nil
	}
	return json.Marshal(webSocketEventJSON{
		ev.event,
		ev.data,
		ev.broadcast,
		ev.sequence,
	})
}

// Encode encodes the event to the given encoder.
func (ev *WebSocketEvent) Encode(enc *json.Encoder) error {
	if ev.precomputedJSON != nil {
		return enc.Encode(json.RawMessage(ev.precomputedJSONBuf()))
	}

	return enc.Encode(webSocketEventJSON{
		ev.event,
		ev.data,
		ev.broadcast,
		ev.sequence,
	})
}

// We write optimal code here sacrificing readability for
// performance.
func (ev *WebSocketEvent) precomputedJSONBuf() []byte {
	return []byte(`{"event": ` +
		string(ev.precomputedJSON.Event) +
		`, "data": ` +
		string(ev.precomputedJSON.Data) +
		`, "broadcast": ` +
		string(ev.precomputedJSON.Broadcast) +
		`, "seq": ` +
		strconv.Itoa(int(ev.sequence)) +
		`}`)
}

func WebSocketEventFromJSON(data io.Reader) (*WebSocketEvent, error) {
	var ev WebSocketEvent
	var o webSocketEventJSON
	if err := json.NewDecoder(data).Decode(&o); err != nil {
		return nil, err
	}
	ev.event = o.Event
	if u, ok := o.Data["user"]; ok {
		// We need to convert to and from JSON again
		// because the user is in the form of a map[string]any.
		buf, err := json.Marshal(u)
		if err != nil {
			return nil, err
		}

		var user User
		if err = json.Unmarshal(buf, &user); err != nil {
			return nil, err
		}
		o.Data["user"] = &user
	}
	ev.data = o.Data
	ev.broadcast = o.Broadcast
	ev.sequence = o.Sequence
	return &ev, nil
}

// WebSocketResponse represents a response received through the WebSocket
// for a request made to the server. This is available through the ResponseChannel
// channel in WebSocketClient.
type WebSocketResponse struct {
	Status   string         `json:"status"`              // The status of the response. For example: OK, FAIL.
	SeqReply int64          `json:"seq_reply,omitempty"` // A counter which is incremented for every response sent.
	Data     map[string]any `json:"data,omitempty"`      // The data contained in the response.
	Error    *AppError      `json:"error,omitempty"`     // A field that is set if any error has occurred.
}

func (m *WebSocketResponse) Add(key string, value any) {
	m.Data[key] = value
}

func NewWebSocketResponse(status string, seqReply int64, data map[string]any) *WebSocketResponse {
	return &WebSocketResponse{Status: status, SeqReply: seqReply, Data: data}
}

func NewWebSocketError(seqReply int64, err *AppError) *WebSocketResponse {
	return &WebSocketResponse{Status: StatusFail, SeqReply: seqReply, Error: err}
}

func (m *WebSocketResponse) IsValid() bool {
	return m.Status != ""
}

func (m *WebSocketResponse) EventType() string {
	return WebsocketEventResponse
}

func (m *WebSocketResponse) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

func WebSocketResponseFromJSON(data io.Reader) (*WebSocketResponse, error) {
	var o *WebSocketResponse
	return o, json.NewDecoder(data).Decode(&o)
}
