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
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost-server/v5/utils/markdown"
)

const (
	POST_SYSTEM_MESSAGE_PREFIX  = "system_"
	POST_DEFAULT                = ""
	POST_SLACK_ATTACHMENT       = "slack_attachment"
	POST_SYSTEM_GENERIC         = "system_generic"
	POST_JOIN_LEAVE             = "system_join_leave" // Deprecated, use POST_JOIN_CHANNEL or POST_LEAVE_CHANNEL instead
	POST_JOIN_CHANNEL           = "system_join_channel"
	POST_GUEST_JOIN_CHANNEL     = "system_guest_join_channel"
	POST_LEAVE_CHANNEL          = "system_leave_channel"
	POST_JOIN_TEAM              = "system_join_team"
	POST_LEAVE_TEAM             = "system_leave_team"
	POST_AUTO_RESPONDER         = "system_auto_responder"
	POST_ADD_REMOVE             = "system_add_remove" // Deprecated, use POST_ADD_TO_CHANNEL or POST_REMOVE_FROM_CHANNEL instead
	POST_ADD_TO_CHANNEL         = "system_add_to_channel"
	POST_ADD_GUEST_TO_CHANNEL   = "system_add_guest_to_chan"
	POST_REMOVE_FROM_CHANNEL    = "system_remove_from_channel"
	POST_MOVE_CHANNEL           = "system_move_channel"
	POST_ADD_TO_TEAM            = "system_add_to_team"
	POST_REMOVE_FROM_TEAM       = "system_remove_from_team"
	POST_HEADER_CHANGE          = "system_header_change"
	POST_DISPLAYNAME_CHANGE     = "system_displayname_change"
	POST_CONVERT_CHANNEL        = "system_convert_channel"
	POST_PURPOSE_CHANGE         = "system_purpose_change"
	POST_CHANNEL_DELETED        = "system_channel_deleted"
	POST_CHANNEL_RESTORED       = "system_channel_restored"
	POST_EPHEMERAL              = "system_ephemeral"
	POST_CHANGE_CHANNEL_PRIVACY = "system_change_chan_privacy"
	POST_ADD_BOT_TEAMS_CHANNELS = "add_bot_teams_channels"
	POST_FILEIDS_MAX_RUNES      = 150
	POST_FILENAMES_MAX_RUNES    = 4000
	POST_HASHTAGS_MAX_RUNES     = 1000
	POST_MESSAGE_MAX_RUNES_V1   = 4000
	POST_MESSAGE_MAX_BYTES_V2   = 65535                         // Maximum size of a TEXT column in MySQL
	POST_MESSAGE_MAX_RUNES_V2   = POST_MESSAGE_MAX_BYTES_V2 / 4 // Assume a worst-case representation
	POST_PROPS_MAX_RUNES        = 8000
	POST_PROPS_MAX_USER_RUNES   = POST_PROPS_MAX_RUNES - 400 // Leave some room for system / pre-save modifications
	POST_CUSTOM_TYPE_PREFIX     = "custom_"
	POST_ME                     = "me"
	PROPS_ADD_CHANNEL_MEMBER    = "add_channel_member"

	POST_PROPS_ADDED_USER_ID       = "addedUserId"
	POST_PROPS_DELETE_BY           = "deleteBy"
	POST_PROPS_OVERRIDE_ICON_URL   = "override_icon_url"
	POST_PROPS_OVERRIDE_ICON_EMOJI = "override_icon_emoji"

	POST_PROPS_MENTION_HIGHLIGHT_DISABLED = "mentionHighlightDisabled"
	POST_PROPS_GROUP_HIGHLIGHT_DISABLED   = "disable_group_highlight"
	POST_SYSTEM_WARN_METRIC_STATUS        = "warn_metric_status"
)

var AT_MENTION_PATTEN = regexp.MustCompile(`\B@`)

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
	ParentId   string `json:"parent_id"`
	OriginalId string `json:"original_id"`

	Message string `json:"message"`
	// MessageSource will contain the message as submitted by the user if Message has been modified
	// by Mattermost for presentation (e.g if an image proxy is being used). It should be used to
	// populate edit boxes if present.
	MessageSource string `json:"message_source,omitempty" db:"-"`

	Type          string          `json:"type"`
	propsMu       sync.RWMutex    `db:"-"`       // Unexported mutex used to guard Post.Props.
	Props         StringInterface `json:"props"` // Deprecated: use GetProps()
	Hashtags      string          `json:"hashtags"`
	Filenames     StringArray     `json:"filenames,omitempty"` // Deprecated, do not use this field any more
	FileIds       StringArray     `json:"file_ids,omitempty"`
	PendingPostId string          `json:"pending_post_id" db:"-"`
	HasReactions  bool            `json:"has_reactions,omitempty"`

	// Transient data populated before sending a post to the client
	ReplyCount int64         `json:"reply_count" db:"-"`
	Metadata   *PostMetadata `json:"metadata,omitempty" db:"-"`
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

type SearchParameter struct {
	Terms                  *string `json:"terms"`
	IsOrSearch             *bool   `json:"is_or_search"`
	TimeZoneOffset         *int    `json:"time_zone_offset"`
	Page                   *int    `json:"page"`
	PerPage                *int    `json:"per_page"`
	IncludeDeletedChannels *bool   `json:"include_deleted_channels"`
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
	dst.ParentId = o.ParentId
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
	dst.Metadata = o.Metadata
	return nil
}

// Clone shallowly copies the post and returns the copy.
func (o *Post) Clone() *Post {
	copy := &Post{}
	o.ShallowCopy(copy)
	return copy
}

func (o *Post) ToJson() string {
	copy := o.Clone()
	copy.StripActionIntegrations()
	b, _ := json.Marshal(copy)
	return string(b)
}

func (o *Post) ToUnsanitizedJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

type GetPostsSinceOptions struct {
	ChannelId        string
	Time             int64
	SkipFetchThreads bool
}

type GetPostsOptions struct {
	ChannelId        string
	PostId           string
	Page             int
	PerPage          int
	SkipFetchThreads bool
}

func PostFromJson(data io.Reader) *Post {
	var o *Post
	json.NewDecoder(data).Decode(&o)
	return o
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

	if !(IsValidId(o.RootId) || len(o.RootId) == 0) {
		return NewAppError("Post.IsValid", "model.post.is_valid.root_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !(IsValidId(o.ParentId) || len(o.ParentId) == 0) {
		return NewAppError("Post.IsValid", "model.post.is_valid.parent_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.ParentId) == 26 && len(o.RootId) == 0 {
		return NewAppError("Post.IsValid", "model.post.is_valid.root_parent.app_error", nil, "", http.StatusBadRequest)
	}

	if !(len(o.OriginalId) == 26 || len(o.OriginalId) == 0) {
		return NewAppError("Post.IsValid", "model.post.is_valid.original_id.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Message) > maxPostSize {
		return NewAppError("Post.IsValid", "model.post.is_valid.msg.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Hashtags) > POST_HASHTAGS_MAX_RUNES {
		return NewAppError("Post.IsValid", "model.post.is_valid.hashtags.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	switch o.Type {
	case
		POST_DEFAULT,
		POST_SYSTEM_GENERIC,
		POST_JOIN_LEAVE,
		POST_AUTO_RESPONDER,
		POST_ADD_REMOVE,
		POST_JOIN_CHANNEL,
		POST_GUEST_JOIN_CHANNEL,
		POST_LEAVE_CHANNEL,
		POST_JOIN_TEAM,
		POST_LEAVE_TEAM,
		POST_ADD_TO_CHANNEL,
		POST_ADD_GUEST_TO_CHANNEL,
		POST_REMOVE_FROM_CHANNEL,
		POST_MOVE_CHANNEL,
		POST_ADD_TO_TEAM,
		POST_REMOVE_FROM_TEAM,
		POST_SLACK_ATTACHMENT,
		POST_HEADER_CHANGE,
		POST_PURPOSE_CHANGE,
		POST_DISPLAYNAME_CHANGE,
		POST_CONVERT_CHANNEL,
		POST_CHANNEL_DELETED,
		POST_CHANNEL_RESTORED,
		POST_CHANGE_CHANNEL_PRIVACY,
		POST_ME,
		POST_ADD_BOT_TEAMS_CHANNELS,
		POST_SYSTEM_WARN_METRIC_STATUS:
	default:
		if !strings.HasPrefix(o.Type, POST_CUSTOM_TYPE_PREFIX) {
			return NewAppError("Post.IsValid", "model.post.is_valid.type.app_error", nil, "id="+o.Type, http.StatusBadRequest)
		}
	}

	if utf8.RuneCountInString(ArrayToJson(o.Filenames)) > POST_FILENAMES_MAX_RUNES {
		return NewAppError("Post.IsValid", "model.post.is_valid.filenames.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(ArrayToJson(o.FileIds)) > POST_FILEIDS_MAX_RUNES {
		return NewAppError("Post.IsValid", "model.post.is_valid.file_ids.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(StringInterfaceToJson(o.GetProps())) > POST_PROPS_MAX_RUNES {
		return NewAppError("Post.IsValid", "model.post.is_valid.props.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	return nil
}

func (o *Post) SanitizeProps() {
	membersToSanitize := []string{
		PROPS_ADD_CHANNEL_MEMBER,
	}

	for _, member := range membersToSanitize {
		if _, ok := o.GetProps()[member]; ok {
			o.DelProp(member)
		}
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
		o.SetProps(make(map[string]interface{}))
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
		o.SetProps(make(map[string]interface{}))
	}
}

func (o *Post) DelProp(key string) {
	o.propsMu.Lock()
	defer o.propsMu.Unlock()
	propsCopy := make(map[string]interface{}, len(o.Props)-1)
	for k, v := range o.Props {
		propsCopy[k] = v
	}
	delete(propsCopy, key)
	o.Props = propsCopy
}

func (o *Post) AddProp(key string, value interface{}) {
	o.propsMu.Lock()
	defer o.propsMu.Unlock()
	propsCopy := make(map[string]interface{}, len(o.Props)+1)
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

func (o *Post) GetProp(key string) interface{} {
	o.propsMu.RLock()
	defer o.propsMu.RUnlock()
	return o.Props[key]
}

func (o *Post) IsSystemMessage() bool {
	return len(o.Type) >= len(POST_SYSTEM_MESSAGE_PREFIX) && o.Type[:len(POST_SYSTEM_MESSAGE_PREFIX)] == POST_SYSTEM_MESSAGE_PREFIX
}

func (o *Post) IsJoinLeaveMessage() bool {
	return o.Type == POST_JOIN_LEAVE ||
		o.Type == POST_ADD_REMOVE ||
		o.Type == POST_JOIN_CHANNEL ||
		o.Type == POST_LEAVE_CHANNEL ||
		o.Type == POST_JOIN_TEAM ||
		o.Type == POST_LEAVE_TEAM ||
		o.Type == POST_ADD_TO_CHANNEL ||
		o.Type == POST_REMOVE_FROM_CHANNEL ||
		o.Type == POST_ADD_TO_TEAM ||
		o.Type == POST_REMOVE_FROM_TEAM
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

func (o *PostPatch) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	}

	return string(b)
}

func PostPatchFromJson(data io.Reader) *PostPatch {
	decoder := json.NewDecoder(data)
	var post PostPatch
	err := decoder.Decode(&post)
	if err != nil {
		return nil
	}

	return &post
}

func (o *SearchParameter) SearchParameterToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	}

	return string(b)
}

func SearchParameterFromJson(data io.Reader) (*SearchParameter, error) {
	decoder := json.NewDecoder(data)
	var searchParam SearchParameter
	if err := decoder.Decode(&searchParam); err != nil {
		return nil, err
	}

	return &searchParam, nil
}

func (o *Post) ChannelMentions() []string {
	return ChannelMentions(o.Message)
}

// DisableMentionHighlights disables a posts mention highlighting and returns the first channel mention that was present in the message.
func (o *Post) DisableMentionHighlights() string {
	mention, hasMentions := findAtChannelMention(o.Message)
	if hasMentions {
		o.AddProp(POST_PROPS_MENTION_HIGHLIGHT_DISABLED, true)
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
		(*o.Props)[POST_PROPS_MENTION_HIGHLIGHT_DISABLED] = true
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
	if attachments, ok := o.GetProp("attachments").([]interface{}); ok {
		for _, attachment := range attachments {
			if enc, err := json.Marshal(attachment); err == nil {
				var decoded SlackAttachment
				if json.Unmarshal(enc, &decoded) == nil {
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

func (o *PostEphemeral) ToUnsanitizedJson() string {
	b, _ := json.Marshal(o)
	return string(b)
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

	markdown.Inspect(message, func(blockOrInline interface{}) bool {
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

type ExplicitMentions struct {
	// Mentions contains the ID of each user that was mentioned and how they were mentioned.
	Mentions map[string]MentionType

	// Contains a map of groups that were mentioned
	GroupMentions map[string]*Group

	// OtherPotentialMentions contains a list of strings that looked like mentions, but didn't have
	// a corresponding keyword.
	OtherPotentialMentions []string

	// HereMentioned is true if the message contained @here.
	HereMentioned bool

	// AllMentioned is true if the message contained @all.
	AllMentioned bool

	// ChannelMentioned is true if the message contained @channel.
	ChannelMentioned bool
}

type MentionType int

const (
	// Different types of mentions ordered by their priority from lowest to highest

	// A placeholder that should never be used in practice
	NoMention MentionType = iota

	// The post is in a thread that the user has commented on
	ThreadMention

	// The post is a comment on a thread started by the user
	CommentMention

	// The post contains an at-channel, at-all, or at-here
	ChannelMention

	// The post is a DM
	DMMention

	// The post contains an at-mention for the user
	KeywordMention

	// The post contains a group mention for the user
	GroupMention
)

func (m *ExplicitMentions) AddMention(userId string, mentionType MentionType) {
	if m.Mentions == nil {
		m.Mentions = make(map[string]MentionType)
	}

	if currentType, ok := m.Mentions[userId]; ok && currentType >= mentionType {
		return
	}

	m.Mentions[userId] = mentionType
}

func (m *ExplicitMentions) addGroupMention(word string, groups map[string]*Group) bool {
	if strings.HasPrefix(word, "@") {
		word = word[1:]
	} else {
		// Only allow group mentions when mentioned directly with @group-name
		return false
	}

	group, groupFound := groups[word]
	if !groupFound {
		group = groups[strings.ToLower(word)]
	}

	if group == nil {
		return false
	}

	if m.GroupMentions == nil {
		m.GroupMentions = make(map[string]*Group)
	}

	if group.Name != nil {
		m.GroupMentions[*group.Name] = group
	}

	return true
}

func (m *ExplicitMentions) addMentions(userIds []string, mentionType MentionType) {
	for _, userId := range userIds {
		m.AddMention(userId, mentionType)
	}
}

func (m *ExplicitMentions) RemoveMention(userId string) {
	delete(m.Mentions, userId)
}

// Given a message and a map mapping mention keywords to the users who use them, returns a map of mentioned
// users and a slice of potential mention users not in the channel and whether or not @here was mentioned.
func (post *Post) GetExplicitMentions(keywords map[string][]string, groups map[string]*Group) *ExplicitMentions {
	ret := &ExplicitMentions{}

	buf := ""
	mentionsEnabledFields := getMentionsEnabledFields(post)
	for _, message := range mentionsEnabledFields {
		markdown.Inspect(message, func(node interface{}) bool {
			text, ok := node.(*markdown.Text)
			if !ok {
				ret.processText(buf, keywords, groups)
				buf = ""
				return true
			}
			buf += text.Text
			return false
		})
	}
	ret.processText(buf, keywords, groups)

	return ret
}

// Processes text to filter mentioned users and other potential mentions
func (m *ExplicitMentions) processText(text string, keywords map[string][]string, groups map[string]*Group) {
	systemMentions := map[string]bool{"@here": true, "@channel": true, "@all": true}

	for _, word := range strings.FieldsFunc(text, func(c rune) bool {
		// Split on any whitespace or punctuation that can't be part of an at mention or emoji pattern
		return !(c == ':' || c == '.' || c == '-' || c == '_' || c == '@' || unicode.IsLetter(c) || unicode.IsNumber(c))
	}) {
		// skip word with format ':word:' with an assumption that it is an emoji format only
		if word[0] == ':' && word[len(word)-1] == ':' {
			continue
		}

		word = strings.TrimLeft(word, ":.-_")

		if m.checkForMention(word, keywords, groups) {
			continue
		}

		foundWithoutSuffix := false
		wordWithoutSuffix := word

		for len(wordWithoutSuffix) > 0 && strings.LastIndexAny(wordWithoutSuffix, ".-:_") == (len(wordWithoutSuffix)-1) {
			wordWithoutSuffix = wordWithoutSuffix[0 : len(wordWithoutSuffix)-1]

			if m.checkForMention(wordWithoutSuffix, keywords, groups) {
				foundWithoutSuffix = true
				break
			}
		}

		if foundWithoutSuffix {
			continue
		}

		if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
			// No need to bother about unicode as we are looking for ASCII characters.
			last := word[len(word)-1]
			switch last {
			// If the word is possibly at the end of a sentence, remove that character.
			case '.', '-', ':':
				word = word[:len(word)-1]
			}
			m.OtherPotentialMentions = append(m.OtherPotentialMentions, word[1:])
		} else if strings.ContainsAny(word, ".-:") {
			// This word contains a character that may be the end of a sentence, so split further
			splitWords := strings.FieldsFunc(word, func(c rune) bool {
				return c == '.' || c == '-' || c == ':'
			})

			for _, splitWord := range splitWords {
				if m.checkForMention(splitWord, keywords, groups) {
					continue
				}
				if _, ok := systemMentions[splitWord]; !ok && strings.HasPrefix(splitWord, "@") {
					m.OtherPotentialMentions = append(m.OtherPotentialMentions, splitWord[1:])
				}
			}
		}

		if ids, match := isKeywordMultibyte(keywords, word); match {
			m.addMentions(ids, KeywordMention)
		}
	}
}

// checkForMention checks if there is a mention to a specific user or to the keywords here / channel / all
func (m *ExplicitMentions) checkForMention(word string, keywords map[string][]string, groups map[string]*Group) bool {
	var mentionType MentionType

	switch strings.ToLower(word) {
	case "@here":
		m.HereMentioned = true
		mentionType = ChannelMention
	case "@channel":
		m.ChannelMentioned = true
		mentionType = ChannelMention
	case "@all":
		m.AllMentioned = true
		mentionType = ChannelMention
	default:
		mentionType = KeywordMention
	}

	m.addGroupMention(word, groups)

	if ids, match := keywords[strings.ToLower(word)]; match {
		m.addMentions(ids, mentionType)
		return true
	}

	// Case-sensitive check for first name
	if ids, match := keywords[word]; match {
		m.addMentions(ids, mentionType)
		return true
	}

	return false
}

// isKeywordMultibyte checks if a word containing a multibyte character contains a multibyte keyword
func isKeywordMultibyte(keywords map[string][]string, word string) ([]string, bool) {
	ids := []string{}
	match := false
	var multibyteKeywords []string
	for keyword := range keywords {
		if len(keyword) != utf8.RuneCountInString(keyword) {
			multibyteKeywords = append(multibyteKeywords, keyword)
		}
	}

	if len(word) != utf8.RuneCountInString(word) {
		for _, key := range multibyteKeywords {
			if strings.Contains(word, key) {
				ids, match = keywords[key]
			}
		}
	}
	return ids, match
}

// Given a post returns the values of the fields in which mentions are possible.
// post.message, preText and text in the attachment are enabled.
func getMentionsEnabledFields(post *Post) StringArray {
	ret := []string{}

	ret = append(ret, post.Message)
	for _, attachment := range post.Attachments() {

		if len(attachment.Pretext) != 0 {
			ret = append(ret, attachment.Pretext)
		}
		if len(attachment.Text) != 0 {
			ret = append(ret, attachment.Text)
		}
	}
	return ret
}
