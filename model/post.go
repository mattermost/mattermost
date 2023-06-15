// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/mattermost/mattermost-server/v6/shared/markdown"
)

const (
	PostSystemMessagePrefix        = "system_"
	PostTypeDefault                = ""
	PostTypeSlackAttachment        = "slack_attachment"
	PostTypeSystemGeneric          = "system_generic"
	PostTypeJoinLeave              = "system_join_leave" // Deprecated, use PostJoinChannel or PostLeaveChannel instead
	PostTypeJoinChannel            = "system_join_channel"
	PostTypeGuestJoinChannel       = "system_guest_join_channel"
	PostTypeLeaveChannel           = "system_leave_channel"
	PostTypeJoinTeam               = "system_join_team"
	PostTypeLeaveTeam              = "system_leave_team"
	PostTypeAutoResponder          = "system_auto_responder"
	PostTypeAddRemove              = "system_add_remove" // Deprecated, use PostAddToChannel or PostRemoveFromChannel instead
	PostTypeAddToChannel           = "system_add_to_channel"
	PostTypeAddGuestToChannel      = "system_add_guest_to_chan"
	PostTypeRemoveFromChannel      = "system_remove_from_channel"
	PostTypeMoveChannel            = "system_move_channel"
	PostTypeAddToTeam              = "system_add_to_team"
	PostTypeRemoveFromTeam         = "system_remove_from_team"
	PostTypeHeaderChange           = "system_header_change"
	PostTypeDisplaynameChange      = "system_displayname_change"
	PostTypeConvertChannel         = "system_convert_channel"
	PostTypePurposeChange          = "system_purpose_change"
	PostTypeChannelDeleted         = "system_channel_deleted"
	PostTypeChannelRestored        = "system_channel_restored"
	PostTypeEphemeral              = "system_ephemeral"
	PostTypeChangeChannelPrivacy   = "system_change_chan_privacy"
	PostTypeWelcomePost            = "system_welcome_post"
	PostTypeAddBotTeamsChannels    = "add_bot_teams_channels"
	PostTypeSystemWarnMetricStatus = "warn_metric_status"
	PostTypeMe                     = "me"
	PostCustomTypePrefix           = "custom_"
	PostTypeReminder               = "reminder"

	PostFileidsMaxRunes   = 300
	PostFilenamesMaxRunes = 4000
	PostHashtagsMaxRunes  = 1000
	PostMessageMaxRunesV1 = 4000
	PostMessageMaxBytesV2 = 65535                     // Maximum size of a TEXT column in MySQL
	PostMessageMaxRunesV2 = PostMessageMaxBytesV2 / 4 // Assume a worst-case representation
	PostPropsMaxRunes     = 800000
	PostPropsMaxUserRunes = PostPropsMaxRunes - 40000 // Leave some room for system / pre-save modifications

	PropsAddChannelMember = "add_channel_member"

	PostPropsAddedUserId       = "addedUserId"
	PostPropsDeleteBy          = "deleteBy"
	PostPropsOverrideIconURL   = "override_icon_url"
	PostPropsOverrideIconEmoji = "override_icon_emoji"

	PostPropsMentionHighlightDisabled = "mentionHighlightDisabled"
	PostPropsGroupHighlightDisabled   = "disable_group_highlight"

	PostPropsPreviewedPost = "previewed_post"

	PostPriorityUrgent               = "urgent"
	PostPropsRequestedAck            = "requested_ack"
	PostPropsPersistentNotifications = "persistent_notifications"
)

const (
	ModifierMessages string = "messages"
	ModifierFiles    string = "files"
)

type Post struct {
	Id         string `json:"id"`
	CreateAt   int64  `json:"create_at"`
	UpdateAt   int64  `json:"update_at"`
	EditAt     int64  `json:"edit_at"`
	DeleteAt   int64  `json:"delete_at"`
	IsPinned   bool   `json:"is_pinned"`
	UserId     string `json:"user_id"`
	ChannelId  string `json:"channel_id"`
	RootId     string `json:"root_id"`
	OriginalId string `json:"original_id"`

	Message string `json:"message"`
	// MessageSource will contain the message as submitted by the user if Message has been modified
	// by Mattermost for presentation (e.g if an image proxy is being used). It should be used to
	// populate edit boxes if present.
	MessageSource string `json:"message_source,omitempty"`

	Type          string          `json:"type"`
	propsMu       sync.RWMutex    `db:"-"`       // Unexported mutex used to guard Post.Props.
	Props         StringInterface `json:"props"` // Deprecated: use GetProps()
	Hashtags      string          `json:"hashtags"`
	Filenames     StringArray     `json:"-"` // Deprecated, do not use this field any more
	FileIds       StringArray     `json:"file_ids,omitempty"`
	PendingPostId string          `json:"pending_post_id"`
	HasReactions  bool            `json:"has_reactions,omitempty"`
	RemoteId      *string         `json:"remote_id,omitempty"`

	// Transient data populated before sending a post to the client
	ReplyCount   int64         `json:"reply_count"`
	LastReplyAt  int64         `json:"last_reply_at"`
	Participants []*User       `json:"participants"`
	IsFollowing  *bool         `json:"is_following,omitempty"` // for root posts in collapsed thread mode indicates if the current user is following this thread
	Metadata     *PostMetadata `json:"metadata,omitempty"`
}

func (o *Post) Auditable() map[string]interface{} {
	var metaData map[string]any
	if o.Metadata != nil {
		metaData = o.Metadata.Auditable()
	}

	return map[string]interface{}{
		"id":              o.Id,
		"create_at":       o.CreateAt,
		"update_at":       o.UpdateAt,
		"edit_at":         o.EditAt,
		"delete_at":       o.DeleteAt,
		"is_pinned":       o.IsPinned,
		"user_id":         o.UserId,
		"channel_id":      o.ChannelId,
		"root_id":         o.RootId,
		"original_id":     o.OriginalId,
		"type":            o.Type,
		"props":           o.GetProps(),
		"file_ids":        o.FileIds,
		"pending_post_id": o.PendingPostId,
		"remote_id":       o.RemoteId,
		"reply_count":     o.ReplyCount,
		"last_reply_at":   o.LastReplyAt,
		"is_following":    o.IsFollowing,
		"metadata":        metaData,
	}
}

type PostEphemeral struct {
	UserID string `json:"user_id"`
	Post   *Post  `json:"post"`
}

type PostPatch struct {
	IsPinned     *bool            `json:"is_pinned"`
	Message      *string          `json:"message"`
	Props        *StringInterface `json:"props"`
	FileIds      *StringArray     `json:"file_ids"`
	HasReactions *bool            `json:"has_reactions"`
}

type PostReminder struct {
	TargetTime int64 `json:"target_time"`
	// These fields are only used internally for interacting with DB.
	PostId string `json:",omitempty"`
	UserId string `json:",omitempty"`
}

type PostPriority struct {
	Priority                *string `json:"priority"`
	RequestedAck            *bool   `json:"requested_ack"`
	PersistentNotifications *bool   `json:"persistent_notifications"`
	// These fields are only used internally for interacting with DB.
	PostId    string `json:",omitempty"`
	ChannelId string `json:",omitempty"`
}

type SearchParameter struct {
	Terms                  *string `json:"terms"`
	IsOrSearch             *bool   `json:"is_or_search"`
	TimeZoneOffset         *int    `json:"time_zone_offset"`
	Page                   *int    `json:"page"`
	PerPage                *int    `json:"per_page"`
	IncludeDeletedChannels *bool   `json:"include_deleted_channels"`
	Modifier               *string `json:"modifier"` // whether it's messages or file
}

type AnalyticsPostCountsOptions struct {
	TeamId        string
	BotsOnly      bool
	YesterdayOnly bool
}

func (o *PostPatch) WithRewrittenImageURLs(f func(string) string) *PostPatch {
	copy := *o
	if copy.Message != nil {
		*copy.Message = RewriteImageURLs(*o.Message, f)
	}
	return &copy
}

func (o *PostPatch) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"is_pinned":     o.IsPinned,
		"props":         o.Props,
		"file_ids":      o.FileIds,
		"has_reactions": o.HasReactions,
	}
}

type PostForExport struct {
	Post
	TeamName    string
	ChannelName string
	Username    string
	ReplyCount  int
}

type DirectPostForExport struct {
	Post
	User           string
	ChannelMembers *[]string
}

type ReplyForExport struct {
	Post
	Username string
}

type PostForIndexing struct {
	Post
	TeamId         string `json:"team_id"`
	ParentCreateAt *int64 `json:"parent_create_at"`
}

type FileForIndexing struct {
	FileInfo
	ChannelId string `json:"channel_id"`
	Content   string `json:"content"`
}

// ShallowCopy is an utility function to shallow copy a Post to the given
// destination without touching the internal RWMutex.
func (o *Post) ShallowCopy(dst *Post) error {
	if dst == nil {
		return errors.New("dst cannot be nil")
	}
	o.propsMu.RLock()
	defer o.propsMu.RUnlock()
	dst.propsMu.Lock()
	defer dst.propsMu.Unlock()
	dst.Id = o.Id
	dst.CreateAt = o.CreateAt
	dst.UpdateAt = o.UpdateAt
	dst.EditAt = o.EditAt
	dst.DeleteAt = o.DeleteAt
	dst.IsPinned = o.IsPinned
	dst.UserId = o.UserId
	dst.ChannelId = o.ChannelId
	dst.RootId = o.RootId
	dst.OriginalId = o.OriginalId
	dst.Message = o.Message
	dst.MessageSource = o.MessageSource
	dst.Type = o.Type
	dst.Props = o.Props
	dst.Hashtags = o.Hashtags
	dst.Filenames = o.Filenames
	dst.FileIds = o.FileIds
	dst.PendingPostId = o.PendingPostId
	dst.HasReactions = o.HasReactions
	dst.ReplyCount = o.ReplyCount
	dst.Participants = o.Participants
	dst.LastReplyAt = o.LastReplyAt
	dst.Metadata = o.Metadata
	if o.IsFollowing != nil {
		dst.IsFollowing = NewBool(*o.IsFollowing)
	}
	dst.RemoteId = o.RemoteId
	return nil
}

// Clone shallowly copies the post and returns the copy.
func (o *Post) Clone() *Post {
	copy := &Post{}
	o.ShallowCopy(copy)
	return copy
}

func (o *Post) ToJSON() (string, error) {
	copy := o.Clone()
	copy.StripActionIntegrations()
	b, err := json.Marshal(copy)
	return string(b), err
}

func (o *Post) EncodeJSON(w io.Writer) error {
	o.StripActionIntegrations()
	return json.NewEncoder(w).Encode(o)
}

type GetPostsSinceOptions struct {
	UserId                   string
	ChannelId                string
	Time                     int64
	SkipFetchThreads         bool
	CollapsedThreads         bool
	CollapsedThreadsExtended bool
	SortAscending            bool
}

type GetPostsSinceForSyncCursor struct {
	LastPostUpdateAt int64
	LastPostId       string
}

type GetPostsSinceForSyncOptions struct {
	ChannelId       string
	ExcludeRemoteId string
	IncludeDeleted  bool
}

type GetPostsOptions struct {
	UserId                   string
	ChannelId                string
	PostId                   string
	Page                     int
	PerPage                  int
	SkipFetchThreads         bool
	CollapsedThreads         bool
	CollapsedThreadsExtended bool
	FromPost                 string // PostId after which to send the items
	FromCreateAt             int64  // CreateAt after which to send the items
	Direction                string // Only accepts up|down. Indicates the order in which to send the items.
	IncludeDeleted           bool
	IncludePostPriority      bool
}

type PostCountOptions struct {
	// Only include posts on a specific team. "" for any team.
	TeamId             string
	MustHaveFile       bool
	MustHaveHashtag    bool
	ExcludeDeleted     bool
	ExcludeSystemPosts bool
	UsersPostsOnly     bool
	// AllowFromCache looks up cache only when ExcludeDeleted and UsersPostsOnly are true and rest are falsy.
	AllowFromCache bool
	SincePostID    string
	SinceUpdateAt  int64
}

func (o *Post) Etag() string {
	return Etag(o.Id, o.UpdateAt)
}

func (o *Post) IsValid(maxPostSize int) *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("Post.IsValid", "model.post.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("Post.IsValid", "model.post.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Post.IsValid", "model.post.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("Post.IsValid", "model.post.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.ChannelId) {
		return NewAppError("Post.IsValid", "model.post.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !(IsValidId(o.RootId) || o.RootId == "") {
		return NewAppError("Post.IsValid", "model.post.is_valid.root_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !(len(o.OriginalId) == 26 || o.OriginalId == "") {
		return NewAppError("Post.IsValid", "model.post.is_valid.original_id.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Message) > maxPostSize {
		return NewAppError("Post.IsValid", "model.post.is_valid.msg.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Hashtags) > PostHashtagsMaxRunes {
		return NewAppError("Post.IsValid", "model.post.is_valid.hashtags.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	switch o.Type {
	case
		PostTypeDefault,
		PostTypeSystemGeneric,
		PostTypeJoinLeave,
		PostTypeAutoResponder,
		PostTypeAddRemove,
		PostTypeJoinChannel,
		PostTypeGuestJoinChannel,
		PostTypeLeaveChannel,
		PostTypeJoinTeam,
		PostTypeLeaveTeam,
		PostTypeAddToChannel,
		PostTypeAddGuestToChannel,
		PostTypeRemoveFromChannel,
		PostTypeMoveChannel,
		PostTypeAddToTeam,
		PostTypeRemoveFromTeam,
		PostTypeSlackAttachment,
		PostTypeHeaderChange,
		PostTypePurposeChange,
		PostTypeDisplaynameChange,
		PostTypeConvertChannel,
		PostTypeChannelDeleted,
		PostTypeChannelRestored,
		PostTypeChangeChannelPrivacy,
		PostTypeAddBotTeamsChannels,
		PostTypeSystemWarnMetricStatus,
		PostTypeWelcomePost,
		PostTypeReminder,
		PostTypeMe:
	default:
		if !strings.HasPrefix(o.Type, PostCustomTypePrefix) {
			return NewAppError("Post.IsValid", "model.post.is_valid.type.app_error", nil, "id="+o.Type, http.StatusBadRequest)
		}
	}

	if utf8.RuneCountInString(ArrayToJSON(o.Filenames)) > PostFilenamesMaxRunes {
		return NewAppError("Post.IsValid", "model.post.is_valid.filenames.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(ArrayToJSON(o.FileIds)) > PostFileidsMaxRunes {
		return NewAppError("Post.IsValid", "model.post.is_valid.file_ids.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(StringInterfaceToJSON(o.GetProps())) > PostPropsMaxRunes {
		return NewAppError("Post.IsValid", "model.post.is_valid.props.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	return nil
}

func (o *Post) SanitizeProps() {
	if o == nil {
		return
	}
	membersToSanitize := []string{
		PropsAddChannelMember,
	}

	for _, member := range membersToSanitize {
		if _, ok := o.GetProps()[member]; ok {
			o.DelProp(member)
		}
	}
	for _, p := range o.Participants {
		p.Sanitize(map[string]bool{})
	}
}

func (o *Post) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.OriginalId = ""

	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}

	o.UpdateAt = o.CreateAt
	o.PreCommit()
}

func (o *Post) PreCommit() {
	if o.GetProps() == nil {
		o.SetProps(make(map[string]any))
	}

	if o.Filenames == nil {
		o.Filenames = []string{}
	}

	if o.FileIds == nil {
		o.FileIds = []string{}
	}

	o.GenerateActionIds()

	// There's a rare bug where the client sends up duplicate FileIds so protect against that
	o.FileIds = RemoveDuplicateStrings(o.FileIds)
}

func (o *Post) MakeNonNil() {
	if o.GetProps() == nil {
		o.SetProps(make(map[string]any))
	}
}

func (o *Post) DelProp(key string) {
	o.propsMu.Lock()
	defer o.propsMu.Unlock()
	propsCopy := make(map[string]any, len(o.Props)-1)
	for k, v := range o.Props {
		propsCopy[k] = v
	}
	delete(propsCopy, key)
	o.Props = propsCopy
}

func (o *Post) AddProp(key string, value any) {
	o.propsMu.Lock()
	defer o.propsMu.Unlock()
	propsCopy := make(map[string]any, len(o.Props)+1)
	for k, v := range o.Props {
		propsCopy[k] = v
	}
	propsCopy[key] = value
	o.Props = propsCopy
}

func (o *Post) GetProps() StringInterface {
	o.propsMu.RLock()
	defer o.propsMu.RUnlock()
	return o.Props
}

func (o *Post) SetProps(props StringInterface) {
	o.propsMu.Lock()
	defer o.propsMu.Unlock()
	o.Props = props
}

func (o *Post) GetProp(key string) any {
	o.propsMu.RLock()
	defer o.propsMu.RUnlock()
	return o.Props[key]
}

func (o *Post) IsSystemMessage() bool {
	return len(o.Type) >= len(PostSystemMessagePrefix) && o.Type[:len(PostSystemMessagePrefix)] == PostSystemMessagePrefix
}

// IsRemote returns true if the post originated on a remote cluster.
func (o *Post) IsRemote() bool {
	return o.RemoteId != nil && *o.RemoteId != ""
}

// GetRemoteID safely returns the remoteID or empty string if not remote.
func (o *Post) GetRemoteID() string {
	if o.RemoteId != nil {
		return *o.RemoteId
	}
	return ""
}

func (o *Post) IsJoinLeaveMessage() bool {
	return o.Type == PostTypeJoinLeave ||
		o.Type == PostTypeAddRemove ||
		o.Type == PostTypeJoinChannel ||
		o.Type == PostTypeLeaveChannel ||
		o.Type == PostTypeJoinTeam ||
		o.Type == PostTypeLeaveTeam ||
		o.Type == PostTypeAddToChannel ||
		o.Type == PostTypeRemoveFromChannel ||
		o.Type == PostTypeAddToTeam ||
		o.Type == PostTypeRemoveFromTeam
}

func (o *Post) Patch(patch *PostPatch) {
	if patch.IsPinned != nil {
		o.IsPinned = *patch.IsPinned
	}

	if patch.Message != nil {
		o.Message = *patch.Message
	}

	if patch.Props != nil {
		newProps := *patch.Props
		o.SetProps(newProps)
	}

	if patch.FileIds != nil {
		o.FileIds = *patch.FileIds
	}

	if patch.HasReactions != nil {
		o.HasReactions = *patch.HasReactions
	}
}

func (o *Post) ChannelMentions() []string {
	return ChannelMentions(o.Message)
}

// DisableMentionHighlights disables a posts mention highlighting and returns the first channel mention that was present in the message.
func (o *Post) DisableMentionHighlights() string {
	mention, hasMentions := findAtChannelMention(o.Message)
	if hasMentions {
		o.AddProp(PostPropsMentionHighlightDisabled, true)
	}
	return mention
}

// DisableMentionHighlights disables mention highlighting for a post patch if required.
func (o *PostPatch) DisableMentionHighlights() {
	if o.Message == nil {
		return
	}
	if _, hasMentions := findAtChannelMention(*o.Message); hasMentions {
		if o.Props == nil {
			o.Props = &StringInterface{}
		}
		(*o.Props)[PostPropsMentionHighlightDisabled] = true
	}
}

func findAtChannelMention(message string) (mention string, found bool) {
	re := regexp.MustCompile(`(?i)\B@(channel|all|here)\b`)
	matched := re.FindStringSubmatch(message)
	if found = (len(matched) > 0); found {
		mention = strings.ToLower(matched[0])
	}
	return
}

func (o *Post) Attachments() []*SlackAttachment {
	if attachments, ok := o.GetProp("attachments").([]*SlackAttachment); ok {
		return attachments
	}
	var ret []*SlackAttachment
	if attachments, ok := o.GetProp("attachments").([]any); ok {
		for _, attachment := range attachments {
			if enc, err := json.Marshal(attachment); err == nil {
				var decoded SlackAttachment
				if json.Unmarshal(enc, &decoded) == nil {
					// Ignoring nil actions
					i := 0
					for _, action := range decoded.Actions {
						if action != nil {
							decoded.Actions[i] = action
							i++
						}
					}
					decoded.Actions = decoded.Actions[:i]

					// Ignoring nil fields
					i = 0
					for _, field := range decoded.Fields {
						if field != nil {
							decoded.Fields[i] = field
							i++
						}
					}
					decoded.Fields = decoded.Fields[:i]
					ret = append(ret, &decoded)
				}
			}
		}
	}
	return ret
}

func (o *Post) AttachmentsEqual(input *Post) bool {
	attachments := o.Attachments()
	inputAttachments := input.Attachments()

	if len(attachments) != len(inputAttachments) {
		return false
	}

	for i := range attachments {
		if !attachments[i].Equals(inputAttachments[i]) {
			return false
		}
	}

	return true
}

var markdownDestinationEscaper = strings.NewReplacer(
	`\`, `\\`,
	`<`, `\<`,
	`>`, `\>`,
	`(`, `\(`,
	`)`, `\)`,
)

// WithRewrittenImageURLs returns a new shallow copy of the post where the message has been
// rewritten via RewriteImageURLs.
func (o *Post) WithRewrittenImageURLs(f func(string) string) *Post {
	copy := o.Clone()
	copy.Message = RewriteImageURLs(o.Message, f)
	if copy.MessageSource == "" && copy.Message != o.Message {
		copy.MessageSource = o.Message
	}
	return copy
}

// RewriteImageURLs takes a message and returns a copy that has all of the image URLs replaced
// according to the function f. For each image URL, f will be invoked, and the resulting markdown
// will contain the URL returned by that invocation instead.
//
// Image URLs are destination URLs used in inline images or reference definitions that are used
// anywhere in the input markdown as an image.
func RewriteImageURLs(message string, f func(string) string) string {
	if !strings.Contains(message, "![") {
		return message
	}

	var ranges []markdown.Range

	markdown.Inspect(message, func(blockOrInline any) bool {
		switch v := blockOrInline.(type) {
		case *markdown.ReferenceImage:
			ranges = append(ranges, v.ReferenceDefinition.RawDestination)
		case *markdown.InlineImage:
			ranges = append(ranges, v.RawDestination)
		default:
			return true
		}
		return true
	})

	if ranges == nil {
		return message
	}

	sort.Slice(ranges, func(i, j int) bool {
		return ranges[i].Position < ranges[j].Position
	})

	copyRanges := make([]markdown.Range, 0, len(ranges))
	urls := make([]string, 0, len(ranges))
	resultLength := len(message)

	start := 0
	for i, r := range ranges {
		switch {
		case i == 0:
		case r.Position != ranges[i-1].Position:
			start = ranges[i-1].End
		default:
			continue
		}
		original := message[r.Position:r.End]
		replacement := markdownDestinationEscaper.Replace(f(markdown.Unescape(original)))
		resultLength += len(replacement) - len(original)
		copyRanges = append(copyRanges, markdown.Range{Position: start, End: r.Position})
		urls = append(urls, replacement)
	}

	result := make([]byte, resultLength)

	offset := 0
	for i, r := range copyRanges {
		offset += copy(result[offset:], message[r.Position:r.End])
		offset += copy(result[offset:], urls[i])
	}
	copy(result[offset:], message[ranges[len(ranges)-1].End:])

	return string(result)
}

func (o *Post) IsFromOAuthBot() bool {
	props := o.GetProps()
	return props["from_webhook"] == "true" && props["override_username"] != ""
}

func (o *Post) ToNilIfInvalid() *Post {
	if o.Id == "" {
		return nil
	}
	return o
}

func (o *Post) ForPlugin() *Post {
	p := o.Clone()
	p.Metadata = nil
	return p
}

func (o *Post) GetPreviewPost() *PreviewPost {
	for _, embed := range o.Metadata.Embeds {
		if embed.Type == PostEmbedPermalink {
			if previewPost, ok := embed.Data.(*PreviewPost); ok {
				return previewPost
			}
		}
	}
	return nil
}

func (o *Post) GetPreviewedPostProp() string {
	if val, ok := o.GetProp(PostPropsPreviewedPost).(string); ok {
		return val
	}
	return ""
}

func (o *Post) GetPriority() *PostPriority {
	if o.Metadata != nil && o.Metadata.Priority != nil {
		return o.Metadata.Priority
	}

	return nil
}

func (o *Post) IsUrgent() bool {
	postPriority := o.GetPriority()
	if postPriority == nil {
		return false
	}

	return *postPriority.Priority == PostPriorityUrgent
}
