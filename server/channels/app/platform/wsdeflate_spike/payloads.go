// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package wsdeflate_spike is a standalone harness that measures wire-size
// savings from WebSocket permessage-deflate (gorilla/websocket no-context-takeover)
// on realistic Mattermost WebSocket event payloads.
package wsdeflate_spike

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// PayloadKind identifies a representative Mattermost WebSocket event class.
type PayloadKind string

const (
	KindTyping                 PayloadKind = "typing"
	KindStatusChange           PayloadKind = "status_change"
	KindReactionAdded          PayloadKind = "reaction_added"
	KindPostedShort            PayloadKind = "posted_short"
	KindPostedLong             PayloadKind = "posted_long"
	KindPostedAttachments      PayloadKind = "posted_attachments"
	KindUserUpdated            PayloadKind = "user_updated"
	KindMultipleChannelsViewed PayloadKind = "multiple_channels_viewed"
)

// AllKinds is the measurement matrix order.
var AllKinds = []PayloadKind{
	KindTyping,
	KindStatusChange,
	KindReactionAdded,
	KindPostedShort,
	KindPostedLong,
	KindPostedAttachments,
	KindUserUpdated,
	KindMultipleChannelsViewed,
}

// fixedIDs keeps structure stable across a single generated event while still
// allowing per-iteration variation via varyIndex.
type fixedIDs struct {
	teamID    string
	channelID string
	userID    string
	userID2   string
	postID    string
	fileID    string
	emojiID   string
}

func newFixedIDs() fixedIDs {
	// Fresh IDs each call so consecutive same-kind payloads differ
	// (avoids identical-message compression artifacts).
	return fixedIDs{
		teamID:    model.NewId(),
		channelID: model.NewId(),
		userID:    model.NewId(),
		userID2:   model.NewId(),
		postID:    model.NewId(),
		fileID:    model.NewId(),
		emojiID:   model.NewId(),
	}
}

// GenerateEvent builds a realistic WebSocket event for kind, varied by index.
func GenerateEvent(kind PayloadKind, varyIndex int) *model.WebSocketEvent {
	ids := newFixedIDs()
	now := model.GetMillis() + int64(varyIndex)

	switch kind {
	case KindTyping:
		return makeTyping(ids, varyIndex)
	case KindStatusChange:
		return makeStatusChange(ids, varyIndex)
	case KindReactionAdded:
		return makeReactionAdded(ids, now, varyIndex)
	case KindPostedShort:
		return makePosted(ids, now, shortMessage(varyIndex), nil, varyIndex)
	case KindPostedLong:
		return makePosted(ids, now, longMessage(varyIndex), nil, varyIndex)
	case KindPostedAttachments:
		return makePosted(ids, now, attachmentMessage(varyIndex), makePostMetadata(ids, now, varyIndex), varyIndex)
	case KindUserUpdated:
		return makeUserUpdated(ids, now, varyIndex)
	case KindMultipleChannelsViewed:
		return makeMultipleChannelsViewed(ids, now, varyIndex)
	default:
		panic(fmt.Sprintf("unknown payload kind %q", kind))
	}
}

// MarshalEventJSON returns the wire JSON bytes (ToJSON with sequence), matching
// what writePump sends after SetSequence.
func MarshalEventJSON(ev *model.WebSocketEvent, seq int64) ([]byte, error) {
	return ev.SetSequence(seq).ToJSON()
}

// GeneratePayloadJSON is a convenience for GenerateEvent + MarshalEventJSON.
func GeneratePayloadJSON(kind PayloadKind, varyIndex int, seq int64) ([]byte, error) {
	return MarshalEventJSON(GenerateEvent(kind, varyIndex), seq)
}

func makeTyping(ids fixedIDs, varyIndex int) *model.WebSocketEvent {
	omit := map[string]bool{ids.userID: true}
	ev := model.NewWebSocketEvent(model.WebsocketEventTyping, "", ids.channelID, "", omit, "")
	ev.Add("user_id", ids.userID)
	// parent_id is empty for channel-level typing; occasionally a thread root.
	parentID := ""
	if varyIndex%3 == 0 {
		parentID = ids.postID
	}
	ev.Add("parent_id", parentID)
	return ev
}

func makeStatusChange(ids fixedIDs, varyIndex int) *model.WebSocketEvent {
	statuses := []string{model.StatusOnline, model.StatusAway, model.StatusDnd, model.StatusOffline}
	ev := model.NewWebSocketEvent(model.WebsocketEventStatusChange, "", "", ids.userID, nil, "")
	ev.Add("status", statuses[varyIndex%len(statuses)])
	ev.Add("user_id", ids.userID)
	return ev
}

func makeReactionAdded(ids fixedIDs, now int64, varyIndex int) *model.WebSocketEvent {
	emojis := []string{"thumbsup", "heart", "tada", "eyes", "rocket"}
	reaction := &model.Reaction{
		UserId:    ids.userID,
		PostId:    ids.postID,
		EmojiName: emojis[varyIndex%len(emojis)],
		CreateAt:  now,
		UpdateAt:  now,
		ChannelId: ids.channelID,
	}
	reactionJSON, err := json.Marshal(reaction)
	if err != nil {
		panic(err)
	}
	// Mirrors app.sendReactionEvent: reaction is embedded as a JSON string.
	ev := model.NewWebSocketEvent(model.WebsocketEventReactionAdded, "", ids.channelID, "", nil, "")
	ev.Add("reaction", string(reactionJSON))
	return ev
}

func makePosted(ids fixedIDs, now int64, message string, metadata *model.PostMetadata, varyIndex int) *model.WebSocketEvent {
	post := &model.Post{
		Id:        ids.postID,
		CreateAt:  now,
		UpdateAt:  now,
		UserId:    ids.userID,
		ChannelId: ids.channelID,
		Message:   message,
		Type:      model.PostTypeDefault,
		Hashtags:  "#standup #engineering",
		Props:     model.StringInterface{},
		Metadata:  metadata,
	}
	if metadata != nil && len(metadata.Files) > 0 {
		post.FileIds = model.StringArray{ids.fileID}
	}

	postJSON, err := post.ToJSON()
	if err != nil {
		panic(err)
	}

	// Mirrors notification.go websocket posted construction + publishWebsocketEventForPost.
	// post is embedded as a JSON string (same as publishWebsocketEventForPost).
	ev := model.NewWebSocketEvent(model.WebsocketEventPosted, "", ids.channelID, "", nil, "")
	ev.Add("post", postJSON)
	ev.Add("channel_display_name", "Engineering")
	ev.Add("channel_name", "engineering")
	ev.Add("channel_type", string(model.ChannelTypeOpen))
	ev.Add("sender_name", fmt.Sprintf("jane.doe%d", varyIndex%10))
	ev.Add("set_online", true)
	ev.Add("team_id", ids.teamID)
	// Per-recipient mentions hook result as seen on the wire for a mentioned user.
	mentions, _ := json.Marshal(model.StringArray{ids.userID2})
	ev.Add("mentions", string(mentions))
	if metadata != nil && len(metadata.Files) > 0 {
		ev.Add("otherFile", "true")
		ev.Add("image", "true")
	}
	return ev
}

func makePostMetadata(ids fixedIDs, now int64, varyIndex int) *model.PostMetadata {
	remoteID := ""
	file := &model.FileInfo{
		Id:              ids.fileID,
		CreatorId:       ids.userID,
		PostId:          ids.postID,
		ChannelId:       ids.channelID,
		CreateAt:        now,
		UpdateAt:        now,
		Name:            fmt.Sprintf("architecture-diagram-%d.png", varyIndex%7),
		Extension:       "png",
		Size:            248_576 + int64(varyIndex%1000),
		MimeType:        "image/png",
		Width:           1600,
		Height:          900,
		HasPreviewImage: true,
		RemoteId:        &remoteID,
	}

	emoji := &model.Emoji{
		Id:        ids.emojiID,
		CreateAt:  now - 1_000_000,
		UpdateAt:  now - 1_000_000,
		CreatorId: ids.userID,
		Name:      fmt.Sprintf("party_blob_%d", varyIndex%5),
	}

	attachment := &model.MessageAttachment{
		Id:         int64(varyIndex + 1),
		Fallback:   "Deploy finished for api-gateway",
		Color:      "#00A3E0",
		Pretext:    "CI notification",
		AuthorName: "BuildBot",
		AuthorLink: "https://ci.example.com/bots/buildbot",
		Title:      fmt.Sprintf("Build #%d succeeded", 1200+varyIndex),
		TitleLink:  fmt.Sprintf("https://ci.example.com/builds/%d", 1200+varyIndex),
		Text:       "All integration tests passed. Artifact uploaded to the release bucket.",
		Fields: []*model.MessageAttachmentField{
			{Title: "Service", Value: "api-gateway", Short: true},
			{Title: "Duration", Value: "4m 12s", Short: true},
			{Title: "Commit", Value: fmt.Sprintf("abc%ddef", varyIndex%97), Short: false},
		},
		Footer: "Mattermost CI",
	}

	return &model.PostMetadata{
		Embeds: []*model.PostEmbed{
			{Type: model.PostEmbedMessageAttachment, Data: attachment},
		},
		Emojis: []*model.Emoji{emoji},
		Files:  []*model.FileInfo{file},
		Images: map[string]*model.PostImage{
			"https://cdn.example.com/charts/latency.png": {Width: 640, Height: 320},
		},
		Reactions: []*model.Reaction{
			{
				UserId:    ids.userID2,
				PostId:    ids.postID,
				EmojiName: "tada",
				CreateAt:  now - 500,
				UpdateAt:  now - 500,
				ChannelId: ids.channelID,
			},
		},
	}
}

func makeUserUpdated(ids fixedIDs, now int64, varyIndex int) *model.WebSocketEvent {
	user := &model.User{
		Id:            ids.userID,
		CreateAt:      now - 86_400_000,
		UpdateAt:      now,
		Username:      fmt.Sprintf("jane.doe%d", varyIndex%10),
		Email:         fmt.Sprintf("jane.doe%d@example.com", varyIndex%10),
		EmailVerified: true,
		Nickname:      "JD",
		FirstName:     "Jane",
		LastName:      "Doe",
		Position:      "Staff Software Engineer",
		Roles:         model.SystemUserRoleId,
		Locale:        "en",
		Timezone: model.StringMap{
			"useAutomaticTimezone": "true",
			"automaticTimezone":    "America/Los_Angeles",
			"manualTimezone":       "",
		},
	}
	user.SetDefaultNotifications()
	user.SanitizeProfile(map[string]bool{
		"email":          true,
		"fullname":       true,
		"passwordupdate": false,
		"authservice":    true,
	}, false)

	ev := model.NewWebSocketEvent(model.WebsocketEventUserUpdated, "", "", "", nil, "")
	ev.Add("user", user)
	return ev
}

func makeMultipleChannelsViewed(ids fixedIDs, now int64, varyIndex int) *model.WebSocketEvent {
	// Real server publishes WebsocketEventMultipleChannelsViewed with channel_times.
	times := map[string]int64{
		ids.channelID: now,
		model.NewId(): now - int64(varyIndex*1000),
		model.NewId(): now - int64(varyIndex*2000),
	}
	ev := model.NewWebSocketEvent(model.WebsocketEventMultipleChannelsViewed, "", "", ids.userID, nil, "")
	ev.Add("channel_times", times)
	return ev
}

func shortMessage(varyIndex int) string {
	// ~50 characters of realistic chat text, with a small varying suffix.
	base := "Quick sync at 3pm works for me — see you then"
	return fmt.Sprintf("%s (%d)", base, varyIndex%100)
}

func attachmentMessage(varyIndex int) string {
	return fmt.Sprintf("Deploy notes for api-gateway build %d :tada: see attachment", 1200+varyIndex)
}

func longMessage(varyIndex int) string {
	// ~2000 chars of varied English/markdown — not repeated single characters.
	paragraphs := []string{
		"## Incident follow-up",
		"",
		"Yesterday's latency spike on the notifications path was traced to a hot shard in the",
		"status cache. After the deploy, p99 dropped from ~850ms back to the 120–160ms band.",
		"",
		"### What changed",
		"1. Split the status fan-out so offline transitions no longer block online writes.",
		"2. Added a short-circuit when the web hub channel iterator is enabled for large teams.",
		"3. Tightened the retry backoff on the push proxy client (was amplifying thundering herds).",
		"",
		"### Remaining work",
		"- [ ] Confirm CRT follower fan-out stays under the new budget during Monday standup peaks.",
		"- [ ] Double-check that ephemeral posts still omit permalink metadata on the wire.",
		"- [ ] Capture a before/after flamegraph for `writePump` under compression once the spike lands.",
		"",
		"Sample markdown table for the on-call handoff:",
		"",
		"| Service        | Owner     | Notes                                      |",
		"|----------------|-----------|--------------------------------------------|",
		"| api-gateway    | platform  | rolled forward; watch error budget         |",
		"| push-proxy     | mobile    | backoff tuned; no customer-visible impact  |",
		"| jobs           | server    | queue depth normal after rebalance         |",
		"",
		"If you see typing indicators stalling again, check hub occupancy before paging.",
		"Link to the runbook: https://docs.example.com/runbooks/websocket-backpressure",
		"",
		"cc @channel — please thumbs-up once you've skimmed the checklist. Thanks!",
	}
	body := strings.Join(paragraphs, "\n")
	// Pad with an extra varied sentence so length stays near ~2000 and differs per index.
	pad := fmt.Sprintf("\n\n_Revision %d captured at iteration %d for compression measurement._\n", varyIndex+1, varyIndex)
	for len(body)+len(pad) < 2000 {
		pad += fmt.Sprintf(" Additional context block %d discusses retry semantics and hub fairness under load.", varyIndex%17)
	}
	out := body + pad
	if len(out) > 2200 {
		out = out[:2200]
	}
	return out
}
