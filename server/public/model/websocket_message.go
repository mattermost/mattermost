// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strconv"
)

type WebsocketEventType string
type WebsocketEventTypeArray []WebsocketEventType

func (arr WebsocketEventTypeArray) ToStringArray() StringArray {
	stringArray := make([]string, len(arr))
	for i, item := range arr {
		stringArray[i] = string(item)
	}
	return stringArray
}

const (
	Typing                                            WebsocketEventType = "typing"
	Posted                                            WebsocketEventType = "posted"
	PostEdited                                        WebsocketEventType = "post_edited"
	PostDeleted                                       WebsocketEventType = "post_deleted"
	PostUnread                                        WebsocketEventType = "post_unread"
	ChannelConverted                                  WebsocketEventType = "channel_converted"
	ChannelCreated                                    WebsocketEventType = "channel_created"
	ChannelDeleted                      			  WebsocketEventType = "channel_deleted"
	ChannelRestored                     			  WebsocketEventType = "channel_restored"
	ChannelUpdated                      			  WebsocketEventType = "channel_updated"
	MemberUpdated                					  WebsocketEventType = "channel_member_updated"
	SchemeUpdated                					  WebsocketEventType = "channel_scheme_updated"
	DirectAdded                         			  WebsocketEventType = "direct_added"
	GroupAdded                          			  WebsocketEventType = "group_added"
	NewUser                             			  WebsocketEventType = "new_user"
	AddedToTeam                         			  WebsocketEventType = "added_to_team"
	LeaveTeam                           			  WebsocketEventType = "leave_team"
	UpdateTeam                          			  WebsocketEventType = "update_team"
	DeleteTeam                          			  WebsocketEventType = "delete_team"
	WebsocketEventRestoreTeam                         WebsocketEventType = "restore_team"
	WebsocketEventUpdateTeamScheme                    WebsocketEventType = "update_team_scheme"
	WebsocketEventUserAdded                           WebsocketEventType = "user_added"
	WebsocketEventUserUpdated                         WebsocketEventType = "user_updated"
	WebsocketEventUserRoleUpdated                     WebsocketEventType = "user_role_updated"
	WebsocketEventMemberroleUpdated                   WebsocketEventType = "memberrole_updated"
	WebsocketEventUserRemoved                         WebsocketEventType = "user_removed"
	WebsocketEventPreferenceChanged                   WebsocketEventType = "preference_changed"
	WebsocketEventPreferencesChanged                  WebsocketEventType = "preferences_changed"
	WebsocketEventPreferencesDeleted                  WebsocketEventType = "preferences_deleted"
	WebsocketEventEphemeralMessage                    WebsocketEventType = "ephemeral_message"
	WebsocketEventStatusChange                        WebsocketEventType = "status_change"
	WebsocketEventHello                               WebsocketEventType = "hello"
	WebsocketAuthenticationChallenge                  WebsocketEventType = "authentication_challenge"
	WebsocketEventReactionAdded                       WebsocketEventType = "reaction_added"
	WebsocketEventReactionRemoved                     WebsocketEventType = "reaction_removed"
	WebsocketEventResponse                            WebsocketEventType = "response"
	WebsocketEventEmojiAdded                          WebsocketEventType = "emoji_added"
	WebsocketEventChannelViewed                       WebsocketEventType = "channel_viewed"
	WebsocketEventMultipleChannelsViewed              WebsocketEventType = "multiple_channels_viewed"
	WebsocketEventPluginStatusesChanged               WebsocketEventType = "plugin_statuses_changed"
	WebsocketEventPluginEnabled                       WebsocketEventType = "plugin_enabled"
	WebsocketEventPluginDisabled                      WebsocketEventType = "plugin_disabled"
	WebsocketEventRoleUpdated                         WebsocketEventType = "role_updated"
	WebsocketEventLicenseChanged                      WebsocketEventType = "license_changed"
	WebsocketEventConfigChanged                       WebsocketEventType = "config_changed"
	WebsocketEventOpenDialog                          WebsocketEventType = "open_dialog"
	WebsocketEventGuestsDeactivated                   WebsocketEventType = "guests_deactivated"
	WebsocketEventUserActivationStatusChange          WebsocketEventType = "user_activation_status_change"
	WebsocketEventReceivedGroup                       WebsocketEventType = "received_group"
	WebsocketEventReceivedGroupAssociatedToTeam       WebsocketEventType = "received_group_associated_to_team"
	WebsocketEventReceivedGroupNotAssociatedToTeam    WebsocketEventType = "received_group_not_associated_to_team"
	WebsocketEventReceivedGroupAssociatedToChannel    WebsocketEventType = "received_group_associated_to_channel"
	WebsocketEventReceivedGroupNotAssociatedToChannel WebsocketEventType = "received_group_not_associated_to_channel"
	WebsocketEventGroupMemberDelete                   WebsocketEventType = "group_member_deleted"
	WebsocketEventGroupMemberAdd                      WebsocketEventType = "group_member_add"
	WebsocketEventSidebarCategoryCreated              WebsocketEventType = "sidebar_category_created"
	WebsocketEventSidebarCategoryUpdated              WebsocketEventType = "sidebar_category_updated"
	WebsocketEventSidebarCategoryDeleted              WebsocketEventType = "sidebar_category_deleted"
	WebsocketEventSidebarCategoryOrderUpdated         WebsocketEventType = "sidebar_category_order_updated"
	WebsocketWarnMetricStatusReceived                 WebsocketEventType = "warn_metric_status_received"
	WebsocketWarnMetricStatusRemoved                  WebsocketEventType = "warn_metric_status_removed"
	WebsocketEventCloudPaymentStatusUpdated           WebsocketEventType = "cloud_payment_status_updated"
	WebsocketEventCloudSubscriptionChanged            WebsocketEventType = "cloud_subscription_changed"
	WebsocketEventThreadUpdated                       WebsocketEventType = "thread_updated"
	WebsocketEventThreadFollowChanged                 WebsocketEventType = "thread_follow_changed"
	WebsocketEventThreadReadChanged                   WebsocketEventType = "thread_read_changed"
	WebsocketFirstAdminVisitMarketplaceStatusReceived WebsocketEventType = "first_admin_visit_marketplace_status_received"
	WebsocketEventDraftCreated                        WebsocketEventType = "draft_created"
	WebsocketEventDraftUpdated                        WebsocketEventType = "draft_updated"
	WebsocketEventDraftDeleted                        WebsocketEventType = "draft_deleted"
	WebsocketEventAcknowledgementAdded                WebsocketEventType = "post_acknowledgement_added"
	WebsocketEventAcknowledgementRemoved              WebsocketEventType = "post_acknowledgement_removed"
	WebsocketEventPersistentNotificationTriggered     WebsocketEventType = "persistent_notification_triggered"
	WebsocketEventHostedCustomerSignupProgressUpdated WebsocketEventType = "hosted_customer_signup_progress_updated"
)

type WebSocketMessage interface {
	ToJSON() ([]byte, error)
	IsValid() bool
	EventType() WebsocketEventType
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
	Event     WebsocketEventType  `json:"event"`
	Data      map[string]any      `json:"data"`
	Broadcast *WebsocketBroadcast `json:"broadcast"`
	Sequence  int64               `json:"seq"`
}

type WebSocketEvent struct {
	event           WebsocketEventType
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

func NewWebSocketEvent(event WebsocketEventType, teamId, channelId, userId string, omitUsers map[string]bool, omitConnectionId string) *WebSocketEvent {
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

func (ev *WebSocketEvent) SetEvent(event WebsocketEventType) *WebSocketEvent {
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

func (ev *WebSocketEvent) EventType() WebsocketEventType {
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

func (m *WebSocketResponse) EventType() WebsocketEventType {
	return WebsocketEventResponse
}

func (m *WebSocketResponse) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

func WebSocketResponseFromJSON(data io.Reader) (*WebSocketResponse, error) {
	var o *WebSocketResponse
	return o, json.NewDecoder(data).Decode(&o)
}
