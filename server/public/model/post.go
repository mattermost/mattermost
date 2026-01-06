// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/shared/markdown"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type PostContextKey string

const (
	PostSystemMessagePrefix      = "system_"
	PostTypeDefault              = ""
	PostTypeSlackAttachment      = "slack_attachment"
	PostTypeSystemGeneric        = "system_generic"
	PostTypeJoinLeave            = "system_join_leave" // Deprecated, use PostJoinChannel or PostLeaveChannel instead
	PostTypeJoinChannel          = "system_join_channel"
	PostTypeGuestJoinChannel     = "system_guest_join_channel"
	PostTypeLeaveChannel         = "system_leave_channel"
	PostTypeJoinTeam             = "system_join_team"
	PostTypeLeaveTeam            = "system_leave_team"
	PostTypeAutoResponder        = "system_auto_responder"
	PostTypeAddRemove            = "system_add_remove" // Deprecated, use PostAddToChannel or PostRemoveFromChannel instead
	PostTypeAddToChannel         = "system_add_to_channel"
	PostTypeAddGuestToChannel    = "system_add_guest_to_chan"
	PostTypeRemoveFromChannel    = "system_remove_from_channel"
	PostTypeMoveChannel          = "system_move_channel"
	PostTypeAddToTeam            = "system_add_to_team"
	PostTypeRemoveFromTeam       = "system_remove_from_team"
	PostTypeHeaderChange         = "system_header_change"
	PostTypeDisplaynameChange    = "system_displayname_change"
	PostTypeConvertChannel       = "system_convert_channel"
	PostTypePurposeChange        = "system_purpose_change"
	PostTypeChannelDeleted       = "system_channel_deleted"
	PostTypeChannelRestored      = "system_channel_restored"
	PostTypeEphemeral            = "system_ephemeral"
	PostTypeChangeChannelPrivacy = "system_change_chan_privacy"
	PostTypeWrangler             = "system_wrangler"
	PostTypeGMConvertedToChannel = "system_gm_to_channel"
	PostTypeAddBotTeamsChannels  = "add_bot_teams_channels"
	PostTypeMe                   = "me"
	PostCustomTypePrefix         = "custom_"
	PostTypeReminder             = "reminder"
	PostTypeBurnOnRead           = "burn_on_read"

	PostFileidsMaxRunes   = 300
	PostFilenamesMaxRunes = 4000
	PostHashtagsMaxRunes  = 1000
	PostMessageMaxRunesV1 = 4000
	PostMessageMaxBytesV2 = 65535                     // Maximum size of a TEXT column in MySQL
	PostMessageMaxRunesV2 = PostMessageMaxBytesV2 / 4 // Assume a worst-case representation

	// Reporting API constants
	MaxReportingPerPage        = 1000 // Maximum number of posts that can be requested per page in reporting endpoints
	ReportingTimeFieldCreateAt = "create_at"
	ReportingTimeFieldUpdateAt = "update_at"
	ReportingSortDirectionAsc  = "asc"
	ReportingSortDirectionDesc = "desc"
	PostPropsMaxRunes          = 800000
	PostPropsMaxUserRunes      = PostPropsMaxRunes - 40000 // Leave some room for system / pre-save modifications

	PropsAddChannelMember = "add_channel_member"

	PostPropsAddedUserId              = "addedUserId"
	PostPropsDeleteBy                 = "deleteBy"
	PostPropsOverrideIconURL          = "override_icon_url"
	PostPropsOverrideIconEmoji        = "override_icon_emoji"
	PostPropsOverrideUsername         = "override_username"
	PostPropsFromWebhook              = "from_webhook"
	PostPropsFromBot                  = "from_bot"
	PostPropsFromOAuthApp             = "from_oauth_app"
	PostPropsWebhookDisplayName       = "webhook_display_name"
	PostPropsAttachments              = "attachments"
	PostPropsFromPlugin               = "from_plugin"
	PostPropsMentionHighlightDisabled = "mentionHighlightDisabled"
	PostPropsGroupHighlightDisabled   = "disable_group_highlight"
	PostPropsPreviewedPost            = "previewed_post"
	PostPropsForceNotification        = "force_notification"
	PostPropsChannelMentions          = "channel_mentions"
	PostPropsUnsafeLinks              = "unsafe_links"
	PostPropsAIGeneratedByUserID      = "ai_generated_by"
	PostPropsAIGeneratedByUsername    = "ai_generated_by_username"
	PostPropsExpireAt                 = "expire_at"
	PostPropsReadDurationSeconds      = "read_duration"

	PostPriorityUrgent = "urgent"

	DefaultExpirySeconds       = 60 * 60 * 24 * 7 // 7 days
	DefaultReadDurationSeconds = 10 * 60          // 10 minutes

	PostContextKeyIsScheduledPost PostContextKey = "isScheduledPost"
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
	FileIds       StringArray     `json:"file_ids"`
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

func (o *Post) Auditable() map[string]any {
	var metaData map[string]any
	if o.Metadata != nil {
		metaData = o.Metadata.Auditable()
	}

	return map[string]any{
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

func (o *Post) LogClone() any {
	return o.Auditable()
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

type PostPersistentNotifications struct {
	PostId     string
	CreateAt   int64
	LastSentAt int64
	DeleteAt   int64
	SentCount  int16
}

type GetPersistentNotificationsPostsParams struct {
	MaxTime      int64
	MaxSentCount int16
	PerPage      int
}

type MoveThreadParams struct {
	ChannelId string `json:"channel_id"`
}

type SearchParameter struct {
	Terms                  *string `json:"terms"`
	IsOrSearch             *bool   `json:"is_or_search"`
	TimeZoneOffset         *int    `json:"time_zone_offset"`
	Page                   *int    `json:"page"`
	PerPage                *int    `json:"per_page"`
	IncludeDeletedChannels *bool   `json:"include_deleted_channels"`
}

func (sp SearchParameter) Auditable() map[string]any {
	return map[string]any{
		"terms":                    sp.Terms,
		"is_or_search":             sp.IsOrSearch,
		"time_zone_offset":         sp.TimeZoneOffset,
		"page":                     sp.Page,
		"per_page":                 sp.PerPage,
		"include_deleted_channels": sp.IncludeDeletedChannels,
	}
}

func (sp SearchParameter) LogClone() any {
	return sp.Auditable()
}

type AnalyticsPostCountsOptions struct {
	TeamId        string
	BotsOnly      bool
	YesterdayOnly bool
}

func (o *PostPatch) WithRewrittenImageURLs(f func(string) string) *PostPatch {
	pCopy := *o //nolint:revive
	if pCopy.Message != nil {
		*pCopy.Message = RewriteImageURLs(*o.Message, f)
	}
	return &pCopy
}

func (o *PostPatch) Auditable() map[string]any {
	return map[string]any{
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
	FlaggedBy   StringArray
}

type DirectPostForExport struct {
	Post
	User           string
	ChannelMembers *[]string
	FlaggedBy      StringArray
}

type ReplyForExport struct {
	Post
	Username  string
	FlaggedBy StringArray
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

// ShouldIndex tells if a file should be indexed or not.
// index files which are-
// a. not deleted
// b. have an associated post ID, if no post ID, then,
// b.i. the file should belong to the channel's bookmarks, as indicated by the "CreatorId" field.
//
// Files not passing this criteria will be deleted from ES index.
// We're deleting those files from ES index instead of simply skipping them while fetching a batch of files
// because existing ES indexes might have these files already indexed, so we need to remove them from index.
func (file *FileForIndexing) ShouldIndex() bool {
	// NOTE - this function is used in server as well as Enterprise code.
	// Make sure to update public package dependency in both server and Enterprise code when
	// updating the logic here and to test both places.
	return file != nil && file.DeleteAt == 0 && (file.PostId != "" || file.CreatorId == BookmarkFileOwner)
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
		dst.IsFollowing = NewPointer(*o.IsFollowing)
	}
	dst.RemoteId = o.RemoteId
	return nil
}

// Clone shallowly copies the post and returns the copy.
func (o *Post) Clone() *Post {
	pCopy := &Post{} //nolint:revive
	o.ShallowCopy(pCopy)
	return pCopy
}

func (o *Post) ToJSON() (string, error) {
	pCopy := o.Clone() //nolint:revive
	pCopy.StripActionIntegrations()
	b, err := json.Marshal(pCopy)
	return string(b), err
}

func (o *Post) EncodeJSON(w io.Writer) error {
	o.StripActionIntegrations()
	return json.NewEncoder(w).Encode(o)
}

type CreatePostFlags struct {
	TriggerWebhooks   bool
	SetOnline         bool
	ForceNotification bool
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
	LastPostUpdateID string
	LastPostCreateAt int64
	LastPostCreateID string
}

func (c GetPostsSinceForSyncCursor) IsEmpty() bool {
	return c.LastPostCreateAt == 0 && c.LastPostCreateID == "" && c.LastPostUpdateAt == 0 && c.LastPostUpdateID == ""
}

type GetPostsSinceForSyncOptions struct {
	ChannelId                         string
	ExcludeRemoteId                   string
	IncludeDeleted                    bool
	SinceCreateAt                     bool // determines whether the cursor will be based on CreateAt or UpdateAt
	ExcludeChannelMetadataSystemPosts bool // if true, exclude channel metadata system posts (header, display name, purpose changes)
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
	FromUpdateAt             int64  // UpdateAt after which to send the items. This cannot be used with FromCreateAt.
	Direction                string // Only accepts up|down. Indicates the order in which to send the items.
	UpdatesOnly              bool   // This flag is used to make the API work with the updateAt value.
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

	// retrieves posts in the inclusive range: [SinceUpdateAt + LastPostId, UntilUpdateAt]
	SincePostID   string
	SinceUpdateAt int64
	UntilUpdateAt int64
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
		return NewAppError("Post.IsValid", "model.post.is_valid.message_length.app_error",
			map[string]any{"Length": utf8.RuneCountInString(o.Message), "MaxLength": maxPostSize}, "id="+o.Id, http.StatusBadRequest)
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
		PostTypeReminder,
		PostTypeMe,
		PostTypeWrangler,
		PostTypeGMConvertedToChannel,
		PostTypeBurnOnRead:
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
		PostPropsForceNotification,
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

// Remove any input data from the post object that is not user controlled
func (o *Post) SanitizeInput() {
	o.DeleteAt = 0
	o.RemoteId = NewPointer("")

	if o.Metadata != nil {
		o.Metadata.Embeds = nil
	}
}

func (o *Post) ContainsIntegrationsReservedProps() []string {
	return ContainsIntegrationsReservedProps(o.GetProps())
}

func (o *PostPatch) ContainsIntegrationsReservedProps() []string {
	if o == nil || o.Props == nil {
		return nil
	}
	return ContainsIntegrationsReservedProps(*o.Props)
}

func ContainsIntegrationsReservedProps(props StringInterface) []string {
	foundProps := []string{}

	if props != nil {
		reservedProps := []string{
			PostPropsFromWebhook,
			PostPropsOverrideUsername,
			PostPropsWebhookDisplayName,
			PostPropsOverrideIconURL,
			PostPropsOverrideIconEmoji,
		}

		for _, key := range reservedProps {
			if _, ok := props[key]; ok {
				foundProps = append(foundProps, key)
			}
		}
	}

	return foundProps
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
	maps.Copy(propsCopy, o.Props)
	delete(propsCopy, key)
	o.Props = propsCopy
}

func (o *Post) AddProp(key string, value any) {
	o.propsMu.Lock()
	defer o.propsMu.Unlock()
	propsCopy := make(map[string]any, len(o.Props)+1)
	maps.Copy(propsCopy, o.Props)
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

// ValidateProps checks all known props for validity.
// Currently, it logs warnings for invalid props rather than returning an error.
// In a future version, this will be updated to return errors for invalid props.
func (o *Post) ValidateProps(logger mlog.LoggerIFace) {
	if err := o.propsIsValid(); err != nil {
		logger.Warn(
			"Invalid post props. In a future version this will result in an error. Please update your integration to be compliant.",
			mlog.String("post_id", o.Id),
			mlog.Err(err),
		)
	}
}

func (o *Post) propsIsValid() error {
	var multiErr *multierror.Error

	props := o.GetProps()

	// Check basic props validity
	if props == nil {
		return nil
	}

	if props[PostPropsAddedUserId] != nil {
		if addedUserID, ok := props[PostPropsAddedUserId].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("added_user_id prop must be a string"))
		} else if !IsValidId(addedUserID) {
			multiErr = multierror.Append(multiErr, fmt.Errorf("added_user_id prop must be a valid user ID"))
		}
	}
	if props[PostPropsDeleteBy] != nil {
		if deleteByID, ok := props[PostPropsDeleteBy].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("delete_by prop must be a string"))
		} else if !IsValidId(deleteByID) {
			multiErr = multierror.Append(multiErr, fmt.Errorf("delete_by prop must be a valid user ID"))
		}
	}

	// Validate integration props
	if props[PostPropsOverrideIconURL] != nil {
		if iconURL, ok := props[PostPropsOverrideIconURL].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("override_icon_url prop must be a string"))
		} else if iconURL == "" || !IsValidHTTPURL(iconURL) {
			multiErr = multierror.Append(multiErr, fmt.Errorf("override_icon_url prop must be a valid URL"))
		}
	}
	if props[PostPropsOverrideIconEmoji] != nil {
		if _, ok := props[PostPropsOverrideIconEmoji].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("override_icon_emoji prop must be a string"))
		}
	}
	if props[PostPropsOverrideUsername] != nil {
		if _, ok := props[PostPropsOverrideUsername].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("override_username prop must be a string"))
		}
	}
	if props[PostPropsFromWebhook] != nil {
		if fromWebhook, ok := props[PostPropsFromWebhook].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("from_webhook prop must be a string"))
		} else if fromWebhook != "true" {
			multiErr = multierror.Append(multiErr, fmt.Errorf("from_webhook prop must be \"true\""))
		}
	}
	if props[PostPropsFromBot] != nil {
		if fromBot, ok := props[PostPropsFromBot].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("from_bot prop must be a string"))
		} else if fromBot != "true" {
			multiErr = multierror.Append(multiErr, fmt.Errorf("from_bot prop must be \"true\""))
		}
	}
	if props[PostPropsFromOAuthApp] != nil {
		if fromOAuthApp, ok := props[PostPropsFromOAuthApp].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("from_oauth_app prop must be a string"))
		} else if fromOAuthApp != "true" {
			multiErr = multierror.Append(multiErr, fmt.Errorf("from_oauth_app prop must be \"true\""))
		}
	}
	if props[PostPropsFromPlugin] != nil {
		if fromPlugin, ok := props[PostPropsFromPlugin].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("from_plugin prop must be a string"))
		} else if fromPlugin != "true" {
			multiErr = multierror.Append(multiErr, fmt.Errorf("from_plugin prop must be \"true\""))
		}
	}
	if props[PostPropsUnsafeLinks] != nil {
		if unsafeLinks, ok := props[PostPropsUnsafeLinks].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("unsafe_links prop must be a string"))
		} else if unsafeLinks != "true" {
			multiErr = multierror.Append(multiErr, fmt.Errorf("unsafe_links prop must be \"true\""))
		}
	}
	if props[PostPropsWebhookDisplayName] != nil {
		if _, ok := props[PostPropsWebhookDisplayName].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("webhook_display_name prop must be a string"))
		}
	}

	if props[PostPropsMentionHighlightDisabled] != nil {
		if _, ok := props[PostPropsMentionHighlightDisabled].(bool); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("mention_highlight_disabled prop must be a boolean"))
		}
	}
	if props[PostPropsGroupHighlightDisabled] != nil {
		if _, ok := props[PostPropsGroupHighlightDisabled].(bool); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("disable_group_highlight prop must be a boolean"))
		}
	}

	if props[PostPropsPreviewedPost] != nil {
		if previewedPostID, ok := props[PostPropsPreviewedPost].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("previewed_post prop must be a string"))
		} else if !IsValidId(previewedPostID) {
			multiErr = multierror.Append(multiErr, fmt.Errorf("previewed_post prop must be a valid post ID"))
		}
	}

	if props[PostPropsForceNotification] != nil {
		if _, ok := props[PostPropsForceNotification].(bool); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("force_notification prop must be a boolean"))
		}
	}

	if props[PostPropsAIGeneratedByUserID] != nil {
		if aiGenUserID, ok := props[PostPropsAIGeneratedByUserID].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("ai_generated_by prop must be a string"))
		} else if !IsValidId(aiGenUserID) {
			multiErr = multierror.Append(multiErr, fmt.Errorf("ai_generated_by prop must be a valid user ID"))
		}
	}

	if props[PostPropsAIGeneratedByUsername] != nil {
		if _, ok := props[PostPropsAIGeneratedByUsername].(string); !ok {
			multiErr = multierror.Append(multiErr, fmt.Errorf("ai_generated_by_username prop must be a string"))
		}
	}

	for i, a := range o.Attachments() {
		if err := a.IsValid(); err != nil {
			multiErr = multierror.Append(multiErr, multierror.Prefix(err, fmt.Sprintf("message attachtment at index %d is invalid:", i)))
		}
	}

	return multiErr.ErrorOrNil()
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
	if attachments, ok := o.GetProp(PostPropsAttachments).([]*SlackAttachment); ok {
		return attachments
	}
	var ret []*SlackAttachment
	if attachments, ok := o.GetProp(PostPropsAttachments).([]any); ok {
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
	pCopy := o.Clone()
	pCopy.Message = RewriteImageURLs(o.Message, f)
	if pCopy.MessageSource == "" && pCopy.Message != o.Message {
		pCopy.MessageSource = o.Message
	}
	return pCopy
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
	return props[PostPropsFromWebhook] == "true" && props[PostPropsOverrideUsername] != ""
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
	if p.Type == fmt.Sprintf("%sup_notification", PostCustomTypePrefix) {
		p.DelProp("requested_features")
	}
	return p
}

func (o *Post) GetPreviewPost() *PreviewPost {
	if o.Metadata == nil {
		return nil
	}
	for _, embed := range o.Metadata.Embeds {
		if embed != nil && embed.Type == PostEmbedPermalink {
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
	if o.Metadata == nil {
		return nil
	}
	return o.Metadata.Priority
}

func (o *Post) GetPersistentNotification() *bool {
	priority := o.GetPriority()
	if priority == nil {
		return nil
	}
	return priority.PersistentNotifications
}

func (o *Post) GetRequestedAck() *bool {
	priority := o.GetPriority()
	if priority == nil {
		return nil
	}
	return priority.RequestedAck
}

func (o *Post) IsUrgent() bool {
	postPriority := o.GetPriority()
	if postPriority == nil {
		return false
	}

	if postPriority.Priority == nil {
		return false
	}

	return *postPriority.Priority == PostPriorityUrgent
}

func (o *Post) CleanPost() *Post {
	o.Id = ""
	o.CreateAt = 0
	o.UpdateAt = 0
	o.EditAt = 0
	return o
}

type UpdatePostOptions struct {
	SafeUpdate    bool
	IsRestorePost bool
}

func DefaultUpdatePostOptions() *UpdatePostOptions {
	return &UpdatePostOptions{
		SafeUpdate:    false,
		IsRestorePost: false,
	}
}

type PreparePostForClientOpts struct {
	IsNewPost       bool
	IsEditPost      bool
	IncludePriority bool
	RetainContent   bool
	IncludeDeleted  bool
}

// ReportPostOptions contains options for querying posts for reporting/compliance purposes
type ReportPostOptions struct {
	ChannelId          string `json:"channel_id"`
	StartTime          int64  `json:"start_time,omitempty"`           // Optional: Start time for query range (unix timestamp in milliseconds)
	TimeField          string `json:"time_field,omitempty"`           // "create_at" or "update_at" (default: "create_at")
	SortDirection      string `json:"sort_direction,omitempty"`       // "asc" or "desc" (default: "asc")
	PerPage            int    `json:"per_page,omitempty"`             // Number of posts per page (default: 100, max: MaxReportingPerPage)
	IncludeDeleted     bool   `json:"include_deleted,omitempty"`      // Include deleted posts
	ExcludeSystemPosts bool   `json:"exclude_system_posts,omitempty"` // Exclude all system posts (any type starting with "system_")
	IncludeMetadata    bool   `json:"include_metadata,omitempty"`     // Include file info, reactions, etc.
}
type RewriteAction string

const (
	RewriteActionCustom         RewriteAction = "custom"
	RewriteActionShorten        RewriteAction = "shorten"
	RewriteActionElaborate      RewriteAction = "elaborate"
	RewriteActionImproveWriting RewriteAction = "improve_writing"
	RewriteActionFixSpelling    RewriteAction = "fix_spelling"
	RewriteActionSimplify       RewriteAction = "simplify"
	RewriteActionSummarize      RewriteAction = "summarize"
)

type RewriteRequest struct {
	AgentID      string        `json:"agent_id"`
	Message      string        `json:"message"`
	Action       RewriteAction `json:"action"`
	CustomPrompt string        `json:"custom_prompt,omitempty"`
}

type RewriteResponse struct {
	RewrittenText string `json:"rewritten_text"`
}

const RewriteSystemPrompt = `You are a JSON API that rewrites text. Your response must be valid JSON only. 
Return this exact format: {"rewritten_text":"content"}. 
Do not use markdown, code blocks, or any formatting. Start with { and end with }.`

// ReportPostOptionsCursor contains cursor information for pagination.
// The cursor is an opaque base64-encoded string that encodes all pagination state.
// Clients should treat this as an opaque token and pass it back unchanged.
//
// Internal format (before base64 encoding):
//
//	v1: "version:channel_id:time_field:include_deleted:exclude_system_posts:sort_direction:timestamp:post_id"
//
// Field order (general to specific):
// - version: Allows format evolution
// - channel_id: Which channel to query (filter)
// - time_field: Which timestamp column to use for ordering (filter/config)
// - include_deleted: Whether to include deleted posts (filter)
// - exclude_system_posts: Whether to exclude channel metadata system posts (filter)
// - sort_direction: Query direction ASC vs DESC (filter/config)
// - timestamp: The cursor position in time (pagination state)
// - post_id: Tie-breaker for posts with identical timestamps (pagination state)
//
// Version history:
// - v1: Initial format with all query-affecting parameters ordered general→specific, base64-encoded for opacity
// ReportPostOptionsCursor contains the pagination cursor for posts reporting.
//
// The cursor is opaque and self-contained:
// - It's base64-encoded and contains all query parameters (channel_id, time_field, sort_direction, etc.)
// - When a cursor is provided, query parameters in the request body are IGNORED
// - The cursor's embedded parameters take precedence over request body parameters
// - This allows clients to keep sending the same parameters on every page without errors
// - For the first page, omit the cursor field or set it to ""
type ReportPostOptionsCursor struct {
	Cursor string `json:"cursor,omitempty"` // Optional: Opaque base64-encoded cursor string (omit or use "" for first request)
}

// ReportPostListResponse contains the response for cursor-based post reporting queries
type ReportPostListResponse struct {
	Posts      []*Post                  `json:"posts"`
	NextCursor *ReportPostOptionsCursor `json:"next_cursor,omitempty"` // nil if no more pages
}

// ReportPostQueryParams contains the fully resolved query parameters for the store layer.
// This struct is used internally after cursor decoding and parameter resolution.
// The store layer receives these concrete parameters and executes the query.
type ReportPostQueryParams struct {
	ChannelId          string // Required: Channel to query
	CursorTime         int64  // Pagination cursor time position
	CursorId           string // Pagination cursor ID for tie-breaking
	TimeField          string // Resolved: "create_at" or "update_at"
	SortDirection      string // Resolved: "asc" or "desc"
	IncludeDeleted     bool   // Resolved: include deleted posts
	ExcludeSystemPosts bool   // Resolved: exclude system posts
	PerPage            int    // Number of posts per page (already validated)
}

// Validate validates the ReportPostQueryParams fields.
// This should be called after parameter resolution (from cursor or options) and before passing to the store layer.
// Note: PerPage is handled separately in the API layer (capped at 100-1000 range).
func (q *ReportPostQueryParams) Validate() *AppError {
	// Validate ChannelId
	if !IsValidId(q.ChannelId) {
		return NewAppError("ReportPostQueryParams.Validate", "model.post.query_params.invalid_channel_id", nil, "channel_id must be a valid 26-character ID", 400)
	}

	// Validate TimeField
	if q.TimeField != ReportingTimeFieldCreateAt && q.TimeField != ReportingTimeFieldUpdateAt {
		return NewAppError("ReportPostQueryParams.Validate", "model.post.query_params.invalid_time_field", nil, fmt.Sprintf("time_field must be %q or %q", ReportingTimeFieldCreateAt, ReportingTimeFieldUpdateAt), 400)
	}

	// Validate SortDirection
	if q.SortDirection != ReportingSortDirectionAsc && q.SortDirection != ReportingSortDirectionDesc {
		return NewAppError("ReportPostQueryParams.Validate", "model.post.query_params.invalid_sort_direction", nil, fmt.Sprintf("sort_direction must be %q or %q", ReportingSortDirectionAsc, ReportingSortDirectionDesc), 400)
	}

	// Validate CursorId - can be empty (first page) or must be a valid ID format (subsequent pages)
	if q.CursorId != "" && !IsValidId(q.CursorId) {
		return NewAppError("ReportPostQueryParams.Validate", "model.post.query_params.invalid_cursor_id", nil, "cursor_id must be a valid 26-character ID", 400)
	}

	// CursorTime is validated by the fact it's an int64
	// PerPage is handled in API layer before calling Validate()
	return nil
}

// EncodeReportPostCursor creates an opaque cursor string from pagination state.
// The cursor encodes all query-affecting parameters to ensure consistency across pages.
// The cursor is base64-encoded to ensure it's truly opaque and URL-safe.
//
// Internal format: "version:channel_id:time_field:include_deleted:exclude_system_posts:sort_direction:timestamp:post_id"
// Example (before encoding): "1:abc123xyz:create_at:false:true:asc:1635724800000:post456def"
func EncodeReportPostCursor(channelId string, timeField string, includeDeleted bool, excludeSystemPosts bool, sortDirection string, timestamp int64, postId string) string {
	plainText := fmt.Sprintf("1:%s:%s:%t:%t:%s:%d:%s",
		channelId,
		timeField,
		includeDeleted,
		excludeSystemPosts,
		sortDirection,
		timestamp,
		postId)
	return base64.URLEncoding.EncodeToString([]byte(plainText))
}

// DecodeReportPostCursorV1 parses an opaque cursor string into query parameters.
// Returns a partially populated ReportPostQueryParams (missing PerPage which comes from the request).
func DecodeReportPostCursorV1(cursor string) (*ReportPostQueryParams, *AppError) {
	decoded, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return nil, NewAppError("DecodeReportPostCursorV1", "model.post.decode_cursor.invalid_base64", nil, err.Error(), 400)
	}

	parts := strings.Split(string(decoded), ":")
	if len(parts) != 8 {
		return nil, NewAppError("DecodeReportPostCursorV1", "model.post.decode_cursor.invalid_format", nil, fmt.Sprintf("expected 8 parts, got %d", len(parts)), 400)
	}

	version, err := strconv.Atoi(parts[0])
	if err != nil {
		return nil, NewAppError("DecodeReportPostCursorV1", "model.post.decode_cursor.invalid_version", nil, fmt.Sprintf("version must be an integer: %s", err.Error()), 400)
	}
	if version != 1 {
		return nil, NewAppError("DecodeReportPostCursorV1", "model.post.decode_cursor.unsupported_version", nil, fmt.Sprintf("version %d", version), 400)
	}

	includeDeleted, err := strconv.ParseBool(parts[3])
	if err != nil {
		return nil, NewAppError("DecodeReportPostCursorV1", "model.post.decode_cursor.invalid_include_deleted", nil, fmt.Sprintf("include_deleted must be a boolean: %s", err.Error()), 400)
	}

	excludeSystemPosts, err := strconv.ParseBool(parts[4])
	if err != nil {
		return nil, NewAppError("DecodeReportPostCursorV1", "model.post.decode_cursor.invalid_exclude_system_posts", nil, fmt.Sprintf("exclude_system_posts must be a boolean: %s", err.Error()), 400)
	}

	timestamp, err := strconv.ParseInt(parts[6], 10, 64)
	if err != nil {
		return nil, NewAppError("DecodeReportPostCursorV1", "model.post.decode_cursor.invalid_timestamp", nil, fmt.Sprintf("timestamp must be an integer: %s", err.Error()), 400)
	}

	return &ReportPostQueryParams{
		ChannelId:          parts[1],
		CursorTime:         timestamp,
		CursorId:           parts[7],
		TimeField:          parts[2],
		SortDirection:      parts[5],
		IncludeDeleted:     includeDeleted,
		ExcludeSystemPosts: excludeSystemPosts,
	}, nil
}
