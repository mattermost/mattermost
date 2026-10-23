// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type BotEventType string

const (
	BotEventTypePostDM          BotEventType = "post_dm"
	BotEventTypePostGM          BotEventType = "post_gm"
	BotEventTypePostMention     BotEventType = "post_mention"
	BotEventTypePostThreadReply BotEventType = "post_thread_reply"
	BotEventTypeReactionAdded   BotEventType = "reaction_added"
	BotEventTypeReactionRemoved BotEventType = "reaction_removed"
)

type BotEventSubscriptionMode string

const (
	BotEventSubscriptionModePush BotEventSubscriptionMode = "push"
	BotEventSubscriptionModePull BotEventSubscriptionMode = "pull"
)

const (
	BotEventDisabledReasonDeliveryFailures = "delivery_failures"
	BotEventDisabledReasonManual           = "manual"
	BotEventDisabledReasonMaxLength        = 64

	BotEventMaxEventAge          = 7 * 24 * time.Hour
	BotEventSettleWindowMillis   = 1000
	BotEventsDefaultLimit        = 100
	BotEventsMaxLimit            = 500
	BotEventsMaxWait             = 60 * time.Second
	BotEventSecretLength         = 64
	BotEventCallbackURLMaxLength = 2048
)

type BotEventSubscription struct {
	BotUserId           string                   `json:"bot_user_id"`
	Mode                BotEventSubscriptionMode `json:"mode"`
	CallbackURL         string                   `json:"callback_url"`
	Secret              string                   `json:"secret,omitempty"`
	IgnoreBotAuthors    bool                     `json:"ignore_bot_authors"`
	Enabled             bool                     `json:"enabled"`
	DisabledReason      string                   `json:"disabled_reason"`
	ConsecutiveFailures int                      `json:"consecutive_failures"`
	LastDeliveredAt     int64                    `json:"last_delivered_at"`
	CreateAt            int64                    `json:"create_at"`
	UpdateAt            int64                    `json:"update_at"`
	BacklogSize         *int64                   `json:"backlog_size,omitempty" db:"-"`

	AckCursorCreateAt int64  `json:"-"`
	AckCursorId       string `json:"-"`
	FirstFailureAt    int64  `json:"-"`
	NextAttemptAt     int64  `json:"-"`
	LeaseNode         string `json:"-"`
	LeaseExpiresAt    int64  `json:"-"`
}

func (s *BotEventSubscription) PreSave() {
	now := GetMillis()
	if s.CreateAt == 0 {
		s.CreateAt = now
	}
	if s.UpdateAt == 0 {
		s.UpdateAt = now
	}
}

func (s *BotEventSubscription) PreUpdate() {
	s.UpdateAt = GetMillis()
}

func (s *BotEventSubscription) IsValid() *AppError {
	const where = "BotEventSubscription.IsValid"

	if !IsValidId(s.BotUserId) {
		return NewAppError(where, "model.bot_event_subscription.is_valid.bot_user_id.app_error", nil, "", http.StatusBadRequest)
	}

	switch s.Mode {
	case BotEventSubscriptionModePush:
		if !IsValidHTTPURL(s.CallbackURL) || len(s.CallbackURL) > BotEventCallbackURLMaxLength {
			return NewAppError(where, "model.bot_event_subscription.is_valid.callback_url.app_error", nil, "bot_user_id="+s.BotUserId, http.StatusBadRequest)
		}
	case BotEventSubscriptionModePull:
		if s.CallbackURL != "" {
			return NewAppError(where, "model.bot_event_subscription.is_valid.callback_url_pull.app_error", nil, "bot_user_id="+s.BotUserId, http.StatusBadRequest)
		}
	default:
		return NewAppError(where, "model.bot_event_subscription.is_valid.mode.app_error", nil, "bot_user_id="+s.BotUserId, http.StatusBadRequest)
	}

	if len(s.Secret) != BotEventSecretLength {
		return NewAppError(where, "model.bot_event_subscription.is_valid.secret.app_error", nil, "bot_user_id="+s.BotUserId, http.StatusBadRequest)
	}

	if len(s.DisabledReason) > BotEventDisabledReasonMaxLength {
		return NewAppError(where, "model.bot_event_subscription.is_valid.disabled_reason.app_error", nil, "bot_user_id="+s.BotUserId, http.StatusBadRequest)
	}

	if s.CreateAt == 0 {
		return NewAppError(where, "model.bot_event_subscription.is_valid.create_at.app_error", nil, "bot_user_id="+s.BotUserId, http.StatusBadRequest)
	}

	if s.UpdateAt == 0 {
		return NewAppError(where, "model.bot_event_subscription.is_valid.update_at.app_error", nil, "bot_user_id="+s.BotUserId, http.StatusBadRequest)
	}

	return nil
}

// Sanitize clears the secret, which is only ever returned on create and regenerate.
func (s *BotEventSubscription) Sanitize() {
	s.Secret = ""
}

func (s *BotEventSubscription) AckCursor() BotEventCursor {
	return BotEventCursor{CreateAt: s.AckCursorCreateAt, Id: s.AckCursorId}
}

// ShouldProduce reports whether new events are written to the outbox. Events keep
// accumulating while delivery is failing so that nothing is lost once it recovers.
func (s *BotEventSubscription) ShouldProduce() bool {
	return s.Enabled || s.DisabledReason == BotEventDisabledReasonDeliveryFailures
}

func (s *BotEventSubscription) Patch(p *BotEventSubscriptionPatch) {
	if p.Mode != nil {
		s.Mode = *p.Mode
	}
	if p.CallbackURL != nil {
		s.CallbackURL = *p.CallbackURL
	} else if s.Mode == BotEventSubscriptionModePull {
		s.CallbackURL = ""
	}
	if p.IgnoreBotAuthors != nil {
		s.IgnoreBotAuthors = *p.IgnoreBotAuthors
	}
}

func (s *BotEventSubscription) Auditable() map[string]any {
	return map[string]any{
		"bot_user_id":          s.BotUserId,
		"mode":                 s.Mode,
		"callback_url":         s.CallbackURL,
		"has_secret":           s.Secret != "",
		"ignore_bot_authors":   s.IgnoreBotAuthors,
		"enabled":              s.Enabled,
		"disabled_reason":      s.DisabledReason,
		"consecutive_failures": s.ConsecutiveFailures,
		"last_delivered_at":    s.LastDeliveredAt,
		"create_at":            s.CreateAt,
		"update_at":            s.UpdateAt,
	}
}

type BotEventSubscriptionPatch struct {
	Mode             *BotEventSubscriptionMode `json:"mode"`
	CallbackURL      *string                   `json:"callback_url"`
	IgnoreBotAuthors *bool                     `json:"ignore_bot_authors"`
}

func (p *BotEventSubscriptionPatch) Auditable() map[string]any {
	return map[string]any{
		"mode":               p.Mode,
		"callback_url":       p.CallbackURL,
		"ignore_bot_authors": p.IgnoreBotAuthors,
	}
}

// IsValidForCreate checks that the patch has what a new subscription needs. The
// built subscription still has to pass IsValid.
func (p *BotEventSubscriptionPatch) IsValidForCreate() *AppError {
	if p.Mode == nil {
		return NewAppError("BotEventSubscriptionPatch.IsValidForCreate", "model.bot_event_subscription.is_valid.mode_required.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// BotEventCursor is a position in a bot's event stream, ordered by (CreateAt, Id).
type BotEventCursor struct {
	CreateAt int64
	Id       string
}

func (c BotEventCursor) Less(o BotEventCursor) bool {
	if c.CreateAt != o.CreateAt {
		return c.CreateAt < o.CreateAt
	}
	return c.Id < o.Id
}

func (c BotEventCursor) Encode() string {
	return base64.RawURLEncoding.EncodeToString(fmt.Appendf(nil, "%d:%s", c.CreateAt, c.Id))
}

func DecodeBotEventCursor(s string) (BotEventCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return BotEventCursor{}, fmt.Errorf("invalid bot event cursor encoding: %w", err)
	}

	createAtStr, id, ok := strings.Cut(string(raw), ":")
	if !ok || strings.Contains(id, ":") {
		return BotEventCursor{}, fmt.Errorf("invalid bot event cursor format")
	}

	createAt, err := strconv.ParseInt(createAtStr, 10, 64)
	if err != nil || createAt < 0 {
		return BotEventCursor{}, fmt.Errorf("invalid bot event cursor timestamp")
	}

	if id != "" && !IsValidId(id) {
		return BotEventCursor{}, fmt.Errorf("invalid bot event cursor id")
	}

	return BotEventCursor{CreateAt: createAt, Id: id}, nil
}

// BotEvent is a stored outbox row. Payload is the JSON of BotEventData.
type BotEvent struct {
	Id        string
	BotUserId string
	Type      BotEventType
	CreateAt  int64 // 0 on Save = assigned by the database clock
	Payload   json.RawMessage
}

func (e *BotEvent) Cursor() BotEventCursor {
	return BotEventCursor{CreateAt: e.CreateAt, Id: e.Id}
}

type BotEventData struct {
	Team     *BotEventTeam     `json:"team"` // null for DM/GM
	Channel  *BotEventChannel  `json:"channel"`
	Sender   *BotEventUser     `json:"sender"`
	Post     *BotEventPost     `json:"post,omitempty"`
	Reaction *BotEventReaction `json:"reaction,omitempty"`
}

type BotEventTeam struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type BotEventChannel struct {
	Id          string      `json:"id"`
	Type        ChannelType `json:"type"`
	Name        string      `json:"name"`
	DisplayName string      `json:"display_name"`
}

type BotEventUser struct {
	Id       string `json:"id"`
	Username string `json:"username"`
	IsBot    bool   `json:"is_bot"`
}

type BotEventPost struct {
	Id        string          `json:"id"`
	RootId    string          `json:"root_id"`
	UserId    string          `json:"user_id"`
	ChannelId string          `json:"channel_id,omitempty"`
	Message   string          `json:"message,omitempty"`
	Type      string          `json:"type,omitempty"`
	Props     StringInterface `json:"props,omitempty"`
	FileIds   StringArray     `json:"file_ids,omitempty"`
	CreateAt  int64           `json:"create_at,omitempty"`
}

type BotEventReaction struct {
	EmojiName string `json:"emoji_name"`
	UserId    string `json:"user_id"`
	PostId    string `json:"post_id"`
	CreateAt  int64  `json:"create_at"`
}

// BotEventEnvelope is the receiver-facing event, for pull and, later, as the push body.
type BotEventEnvelope struct {
	EventId   string       `json:"event_id"`
	Type      BotEventType `json:"type"`
	CreatedAt int64        `json:"created_at"`
	BotUserId string       `json:"bot_user_id"`
	BotEventData
}

type BotEventList struct {
	Events     []*BotEventEnvelope `json:"events"` // never nil, so it encodes as []
	NextCursor string              `json:"next_cursor"`
}

type BotEventsOptions struct {
	Cursor *BotEventCursor // nil = start from the ack cursor; nothing is acknowledged
	Limit  int
	Wait   time.Duration
}

// NewBotEventPost builds the post summary sent to bots. It does not modify p.
func NewBotEventPost(p *Post) *BotEventPost {
	c := p.ForPlugin()
	c.SanitizeNonIdentityProps()
	return &BotEventPost{
		Id:        c.Id,
		RootId:    c.RootId,
		UserId:    c.UserId,
		ChannelId: c.ChannelId,
		Message:   c.Message,
		Type:      c.Type,
		Props:     c.Props,
		FileIds:   c.FileIds,
		CreateAt:  c.CreateAt,
	}
}

func (e *BotEvent) ToEnvelope() (*BotEventEnvelope, error) {
	var data BotEventData
	if err := json.Unmarshal(e.Payload, &data); err != nil {
		return nil, fmt.Errorf("failed to decode bot event payload: %w", err)
	}
	return &BotEventEnvelope{
		EventId:      e.Id,
		Type:         e.Type,
		CreatedAt:    e.CreateAt,
		BotUserId:    e.BotUserId,
		BotEventData: data,
	}, nil
}

type BotPatchWithEventSubscription struct {
	BotPatch
	EventSubscription *BotEventSubscriptionPatch `json:"event_subscription,omitempty"`
}

type BotWithEventSubscription struct {
	Bot               *Bot
	EventSubscription *BotEventSubscription
}

// MarshalJSON flattens the bot and adds event_subscription. Embedding *Bot instead
// would promote Bot.MarshalJSON and silently drop the subscription.
func (b *BotWithEventSubscription) MarshalJSON() ([]byte, error) {
	fields := map[string]json.RawMessage{}
	if b.Bot != nil {
		raw, err := json.Marshal(b.Bot)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &fields); err != nil {
			return nil, err
		}
	}
	if b.EventSubscription != nil {
		raw, err := json.Marshal(b.EventSubscription)
		if err != nil {
			return nil, err
		}
		fields["event_subscription"] = raw
	}
	return json.Marshal(fields)
}
