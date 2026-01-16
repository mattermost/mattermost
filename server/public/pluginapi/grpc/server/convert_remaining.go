// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"encoding/json"
	"strings"

	"google.golang.org/protobuf/types/known/structpb"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Bot Conversions
// =============================================================================

// botToProto converts a model.Bot to a pb.Bot.
func botToProto(b *model.Bot) *pb.Bot {
	if b == nil {
		return nil
	}
	return &pb.Bot{
		UserId:         b.UserId,
		Username:       b.Username,
		DisplayName:    b.DisplayName,
		Description:    b.Description,
		OwnerId:        b.OwnerId,
		CreateAt:       b.CreateAt,
		UpdateAt:       b.UpdateAt,
		DeleteAt:       b.DeleteAt,
		LastIconUpdate: b.LastIconUpdate,
	}
}

// botFromProto converts a pb.Bot to a model.Bot.
func botFromProto(b *pb.Bot) *model.Bot {
	if b == nil {
		return nil
	}
	return &model.Bot{
		UserId:         b.UserId,
		Username:       b.Username,
		DisplayName:    b.DisplayName,
		Description:    b.Description,
		OwnerId:        b.OwnerId,
		CreateAt:       b.CreateAt,
		UpdateAt:       b.UpdateAt,
		DeleteAt:       b.DeleteAt,
		LastIconUpdate: b.LastIconUpdate,
	}
}

// botsToProto converts a slice of model.Bot to a slice of pb.Bot.
func botsToProto(bots []*model.Bot) []*pb.Bot {
	if bots == nil {
		return nil
	}
	result := make([]*pb.Bot, len(bots))
	for i, b := range bots {
		result[i] = botToProto(b)
	}
	return result
}

// botPatchFromProto converts a pb.BotPatch to a model.BotPatch.
func botPatchFromProto(p *pb.BotPatch) *model.BotPatch {
	if p == nil {
		return nil
	}
	patch := &model.BotPatch{}
	if p.Username != nil {
		patch.Username = p.Username
	}
	if p.DisplayName != nil {
		patch.DisplayName = p.DisplayName
	}
	if p.Description != nil {
		patch.Description = p.Description
	}
	return patch
}

// botGetOptionsFromProto converts a pb.BotGetOptions to model.BotGetOptions.
func botGetOptionsFromProto(opts *pb.BotGetOptions) *model.BotGetOptions {
	if opts == nil {
		return nil
	}
	return &model.BotGetOptions{
		OwnerId:        opts.OwnerId,
		IncludeDeleted: opts.IncludeDeleted,
		OnlyOrphaned:   opts.OnlyOrphaned,
		Page:           int(opts.Page),
		PerPage:        int(opts.PerPage),
	}
}

// =============================================================================
// Emoji Conversions
// =============================================================================

// emojiToProto converts a model.Emoji to a pb.Emoji.
func emojiToProto(e *model.Emoji) *pb.Emoji {
	if e == nil {
		return nil
	}
	return &pb.Emoji{
		Id:        e.Id,
		CreateAt:  e.CreateAt,
		UpdateAt:  e.UpdateAt,
		DeleteAt:  e.DeleteAt,
		CreatorId: e.CreatorId,
		Name:      e.Name,
	}
}

// emojisToProto converts a slice of model.Emoji to a slice of pb.Emoji.
func emojisToProto(emojis []*model.Emoji) []*pb.Emoji {
	if emojis == nil {
		return nil
	}
	result := make([]*pb.Emoji, len(emojis))
	for i, e := range emojis {
		result[i] = emojiToProto(e)
	}
	return result
}

// =============================================================================
// Command Conversions
// =============================================================================

// commandToProto converts a model.Command to a pb.Command.
func commandToProto(c *model.Command) *pb.Command {
	if c == nil {
		return nil
	}
	return &pb.Command{
		Id:               c.Id,
		Token:            c.Token,
		CreateAt:         c.CreateAt,
		UpdateAt:         c.UpdateAt,
		DeleteAt:         c.DeleteAt,
		CreatorId:        c.CreatorId,
		TeamId:           c.TeamId,
		Trigger:          c.Trigger,
		Method:           c.Method,
		Username:         c.Username,
		IconUrl:          c.IconURL,
		AutoComplete:     c.AutoComplete,
		AutoCompleteDesc: c.AutoCompleteDesc,
		AutoCompleteHint: c.AutoCompleteHint,
		DisplayName:      c.DisplayName,
		Description:      c.Description,
		Url:              c.URL,
		PluginId:         c.PluginId,
	}
}

// commandFromProto converts a pb.Command to a model.Command.
func commandFromProto(c *pb.Command) *model.Command {
	if c == nil {
		return nil
	}
	return &model.Command{
		Id:               c.Id,
		Token:            c.Token,
		CreateAt:         c.CreateAt,
		UpdateAt:         c.UpdateAt,
		DeleteAt:         c.DeleteAt,
		CreatorId:        c.CreatorId,
		TeamId:           c.TeamId,
		Trigger:          c.Trigger,
		Method:           c.Method,
		Username:         c.Username,
		IconURL:          c.IconUrl,
		AutoComplete:     c.AutoComplete,
		AutoCompleteDesc: c.AutoCompleteDesc,
		AutoCompleteHint: c.AutoCompleteHint,
		DisplayName:      c.DisplayName,
		Description:      c.Description,
		URL:              c.Url,
		PluginId:         c.PluginId,
	}
}

// commandsToProto converts a slice of model.Command to a slice of pb.Command.
func commandsToProto(cmds []*model.Command) []*pb.Command {
	if cmds == nil {
		return nil
	}
	result := make([]*pb.Command, len(cmds))
	for i, c := range cmds {
		result[i] = commandToProto(c)
	}
	return result
}

// commandArgsFromProto converts a pb.CommandArgs to a model.CommandArgs.
func commandArgsFromProto(args *pb.CommandArgs) *model.CommandArgs {
	if args == nil {
		return nil
	}
	return &model.CommandArgs{
		UserId:    args.UserId,
		ChannelId: args.ChannelId,
		TeamId:    args.TeamId,
		RootId:    args.RootId,
		ParentId:  args.ParentId,
		TriggerId: args.TriggerId,
		Command:   args.Command,
		SiteURL:   args.SiteUrl,
		T:         nil, // Translation function not serializable
		// Note: UserMentions and ChannelMentions in proto are single strings
		// but model expects them as model.UserMentionMap and model.ChannelMentionMap
	}
}

// commandResponseToProto converts a model.CommandResponse to a pb.CommandResponse.
func commandResponseToProto(r *model.CommandResponse) *pb.CommandResponse {
	if r == nil {
		return nil
	}
	resp := &pb.CommandResponse{
		ResponseType:     r.ResponseType,
		Text:             r.Text,
		Username:         r.Username,
		ChannelId:        r.ChannelId,
		IconUrl:          r.IconURL,
		GotoLocation:     r.GotoLocation,
		TriggerId:        r.TriggerId,
		SkipSlackParsing: r.SkipSlackParsing,
	}
	if r.Props != nil {
		// Convert StringInterface to structpb.Struct
		propsStruct, err := structpb.NewStruct(r.Props)
		if err == nil {
			resp.Props = propsStruct
		}
	}
	// Note: Attachments are not currently supported in proto CommandResponse.
	// They would need to be added to the proto definition if needed.
	return resp
}

// Note: SlackAttachment is not currently defined in proto.
// For now, we serialize attachments as JSON.

// =============================================================================
// OAuth App Conversions
// =============================================================================

// oauthAppToProto converts a model.OAuthApp to a pb.OAuthApp.
func oauthAppToProto(a *model.OAuthApp) *pb.OAuthApp {
	if a == nil {
		return nil
	}
	// CallbackUrls in model is a StringArray, convert to comma-separated string
	callbackUrls := ""
	if len(a.CallbackUrls) > 0 {
		callbackUrls = strings.Join(a.CallbackUrls, ",")
	}
	return &pb.OAuthApp{
		Id:           a.Id,
		CreatorId:    a.CreatorId,
		CreateAt:     a.CreateAt,
		UpdateAt:     a.UpdateAt,
		ClientSecret: a.ClientSecret,
		Name:         a.Name,
		Description:  a.Description,
		IconUrl:      a.IconURL,
		CallbackUrls: callbackUrls,
		Homepage:     a.Homepage,
		IsTrusted:    a.IsTrusted,
	}
}

// oauthAppFromProto converts a pb.OAuthApp to a model.OAuthApp.
func oauthAppFromProto(a *pb.OAuthApp) *model.OAuthApp {
	if a == nil {
		return nil
	}
	// Convert comma-separated CallbackUrls string to StringArray
	var callbackUrls model.StringArray
	if a.CallbackUrls != "" {
		callbackUrls = strings.Split(a.CallbackUrls, ",")
	}
	return &model.OAuthApp{
		Id:           a.Id,
		CreatorId:    a.CreatorId,
		CreateAt:     a.CreateAt,
		UpdateAt:     a.UpdateAt,
		ClientSecret: a.ClientSecret,
		Name:         a.Name,
		Description:  a.Description,
		IconURL:      a.IconUrl,
		CallbackUrls: callbackUrls,
		Homepage:     a.Homepage,
		IsTrusted:    a.IsTrusted,
	}
}

// =============================================================================
// Plugin Manifest Conversions
// =============================================================================

// manifestToProto converts a model.Manifest to a pb.Manifest.
func manifestToProto(m *model.Manifest) *pb.Manifest {
	if m == nil {
		return nil
	}
	return &pb.Manifest{
		Id:               m.Id,
		Name:             m.Name,
		Description:      m.Description,
		HomepageUrl:      m.HomepageURL,
		SupportUrl:       m.SupportURL,
		ReleaseNotesUrl:  m.ReleaseNotesURL,
		IconPath:         m.IconPath,
		Version:          m.Version,
		MinServerVersion: m.MinServerVersion,
	}
}

// manifestsToProto converts a slice of model.Manifest to a slice of pb.Manifest.
func manifestsToProto(manifests []*model.Manifest) []*pb.Manifest {
	if manifests == nil {
		return nil
	}
	result := make([]*pb.Manifest, len(manifests))
	for i, m := range manifests {
		result[i] = manifestToProto(m)
	}
	return result
}

// pluginStatusToProto converts a model.PluginStatus to a pb.PluginStatus.
func pluginStatusToProto(s *model.PluginStatus) *pb.PluginStatus {
	if s == nil {
		return nil
	}
	return &pb.PluginStatus{
		PluginId:    s.PluginId,
		PluginPath:  s.PluginPath,
		State:       int32(s.State),
		Name:        s.Name,
		Description: s.Description,
		Version:     s.Version,
		// Note: ClusterId not available in proto PluginStatus
	}
}

// =============================================================================
// Group Conversions
// =============================================================================

// groupToProto converts a model.Group to a pb.Group.
func groupToProto(g *model.Group) *pb.Group {
	if g == nil {
		return nil
	}
	name := ""
	if g.Name != nil {
		name = *g.Name
	}
	remoteId := ""
	if g.RemoteId != nil {
		remoteId = *g.RemoteId
	}
	return &pb.Group{
		Id:             g.Id,
		Name:           name,
		DisplayName:    g.DisplayName,
		Description:    g.Description,
		Source:         string(g.Source),
		RemoteId:       remoteId,
		CreateAt:       g.CreateAt,
		UpdateAt:       g.UpdateAt,
		DeleteAt:       g.DeleteAt,
		AllowReference: g.AllowReference,
		// Note: HasSyncables and MemberCount not available in proto Group
	}
}

// groupFromProto converts a pb.Group to a model.Group.
func groupFromProto(g *pb.Group) *model.Group {
	if g == nil {
		return nil
	}
	var name *string
	if g.Name != "" {
		name = &g.Name
	}
	var remoteId *string
	if g.RemoteId != "" {
		remoteId = &g.RemoteId
	}
	return &model.Group{
		Id:             g.Id,
		Name:           name,
		DisplayName:    g.DisplayName,
		Description:    g.Description,
		Source:         model.GroupSource(g.Source),
		RemoteId:       remoteId,
		CreateAt:       g.CreateAt,
		UpdateAt:       g.UpdateAt,
		DeleteAt:       g.DeleteAt,
		AllowReference: g.AllowReference,
		// Note: HasSyncables and MemberCount not set from proto
	}
}

// groupsToProto converts a slice of model.Group to a slice of pb.Group.
func groupsToProto(groups []*model.Group) []*pb.Group {
	if groups == nil {
		return nil
	}
	result := make([]*pb.Group, len(groups))
	for i, g := range groups {
		result[i] = groupToProto(g)
	}
	return result
}

// groupMemberToProto converts a model.GroupMember to a pb.GroupMember.
func groupMemberToProto(m *model.GroupMember) *pb.GroupMember {
	if m == nil {
		return nil
	}
	return &pb.GroupMember{
		GroupId:  m.GroupId,
		UserId:   m.UserId,
		CreateAt: m.CreateAt,
		DeleteAt: m.DeleteAt,
	}
}

// groupMembersToProto converts a slice of model.GroupMember to a slice of pb.GroupMember.
func groupMembersToProto(members []*model.GroupMember) []*pb.GroupMember {
	if members == nil {
		return nil
	}
	result := make([]*pb.GroupMember, len(members))
	for i, m := range members {
		result[i] = groupMemberToProto(m)
	}
	return result
}

// groupSyncableToProto converts a model.GroupSyncable to a pb.GroupSyncable.
func groupSyncableToProto(s *model.GroupSyncable) *pb.GroupSyncable {
	if s == nil {
		return nil
	}
	return &pb.GroupSyncable{
		GroupId:      s.GroupId,
		SyncableId:   s.SyncableId,
		SyncableType: string(s.Type),
		AutoAdd:      s.AutoAdd,
		SchemeAdmin:  s.SchemeAdmin,
		CreateAt:     s.CreateAt,
		DeleteAt:     s.DeleteAt,
		UpdateAt:     s.UpdateAt,
	}
}

// groupSyncableFromProto converts a pb.GroupSyncable to a model.GroupSyncable.
func groupSyncableFromProto(s *pb.GroupSyncable) *model.GroupSyncable {
	if s == nil {
		return nil
	}
	return &model.GroupSyncable{
		GroupId:     s.GroupId,
		SyncableId:  s.SyncableId,
		AutoAdd:     s.AutoAdd,
		SchemeAdmin: s.SchemeAdmin,
		CreateAt:    s.CreateAt,
		DeleteAt:    s.DeleteAt,
		UpdateAt:    s.UpdateAt,
		Type:        model.GroupSyncableType(s.SyncableType),
	}
}

// groupSyncablesToProto converts a slice of model.GroupSyncable to a slice of pb.GroupSyncable.
func groupSyncablesToProto(syncables []*model.GroupSyncable) []*pb.GroupSyncable {
	if syncables == nil {
		return nil
	}
	result := make([]*pb.GroupSyncable, len(syncables))
	for i, s := range syncables {
		result[i] = groupSyncableToProto(s)
	}
	return result
}

// groupSearchOptsFromProto converts a pb.GroupSearchOpts to model.GroupSearchOpts.
// Note: Several fields have different types in proto vs model; mapping best effort.
func groupSearchOptsFromProto(opts *pb.GroupSearchOpts) model.GroupSearchOpts {
	if opts == nil {
		return model.GroupSearchOpts{}
	}
	// FilterAllowReference in model is bool, but in proto is string
	filterAllowReference := opts.FilterAllowReference == "true"
	// FilterHasMember in model is string, but in proto is bool
	filterHasMember := ""
	if opts.FilterHasMember {
		filterHasMember = "true"
	}
	// IncludeChannelMemberCount in model is string, but in proto is bool
	includeChannelMemberCount := ""
	if opts.IncludeChannelMemberCount {
		includeChannelMemberCount = "true"
	}
	return model.GroupSearchOpts{
		Q:                         opts.Q,
		IncludeMemberCount:        opts.IncludeMemberCount,
		FilterAllowReference:      filterAllowReference,
		PageOpts:                  nil, // Pagination handled separately
		Source:                    model.GroupSource(opts.Source),
		FilterParentTeamPermitted: opts.FilterParentTeamPermitted,
		FilterHasMember:           filterHasMember,
		IncludeTimezones:          opts.IncludeTimezones,
		IncludeChannelMemberCount: includeChannelMemberCount,
		// Note: NotAssociatedToTeam, NotAssociatedToChannel, Since, IncludeArchived not in proto
	}
}

// viewUsersRestrictionsFromProto converts a pb.ViewUsersRestrictions to model.ViewUsersRestrictions.
func viewUsersRestrictionsFromProto(r *pb.ViewUsersRestrictions) *model.ViewUsersRestrictions {
	if r == nil {
		return nil
	}
	return &model.ViewUsersRestrictions{
		Teams:    r.Teams,
		Channels: r.Channels,
	}
}

// =============================================================================
// Shared Channel Conversions
// =============================================================================

// sharedChannelToProto converts a model.SharedChannel to a pb.SharedChannel.
func sharedChannelToProto(sc *model.SharedChannel) *pb.SharedChannel {
	if sc == nil {
		return nil
	}
	// Home in proto is string, in model is bool
	home := ""
	if sc.Home {
		home = "true"
	}
	return &pb.SharedChannel{
		ChannelId:        sc.ChannelId,
		TeamId:           sc.TeamId,
		Home:             home,
		ReadOnly:         sc.ReadOnly,
		ShareName:        sc.ShareName,
		ShareDisplayName: sc.ShareDisplayName,
		SharePurpose:     sc.SharePurpose,
		ShareHeader:      sc.ShareHeader,
		CreatorId:        sc.CreatorId,
		CreateAt:         sc.CreateAt,
		UpdateAt:         sc.UpdateAt,
		RemoteId:         sc.RemoteId,
	}
}

// sharedChannelFromProto converts a pb.SharedChannel to a model.SharedChannel.
func sharedChannelFromProto(sc *pb.SharedChannel) *model.SharedChannel {
	if sc == nil {
		return nil
	}
	// Home in proto is string, in model is bool
	home := sc.Home == "true"
	return &model.SharedChannel{
		ChannelId:        sc.ChannelId,
		TeamId:           sc.TeamId,
		Home:             home,
		ReadOnly:         sc.ReadOnly,
		ShareName:        sc.ShareName,
		ShareDisplayName: sc.ShareDisplayName,
		SharePurpose:     sc.SharePurpose,
		ShareHeader:      sc.ShareHeader,
		CreatorId:        sc.CreatorId,
		CreateAt:         sc.CreateAt,
		UpdateAt:         sc.UpdateAt,
		RemoteId:         sc.RemoteId,
	}
}

// registerPluginOptsFromProto converts a pb.RegisterPluginOpts to model.RegisterPluginOpts.
func registerPluginOptsFromProto(opts *pb.RegisterPluginOpts) model.RegisterPluginOpts {
	if opts == nil {
		return model.RegisterPluginOpts{}
	}
	return model.RegisterPluginOpts{
		Displayname: opts.DisplayName,
		// Note: Proto has Description, model does not
		// Note: Proto doesn't have CreatorID, AutoShareDMs, AutoInvited
	}
}

// getPostsSinceForSyncCursorFromProto converts a pb.GetPostsSinceForSyncCursor to model.GetPostsSinceForSyncCursor.
func getPostsSinceForSyncCursorFromProto(c *pb.GetPostsSinceForSyncCursor) model.GetPostsSinceForSyncCursor {
	if c == nil {
		return model.GetPostsSinceForSyncCursor{}
	}
	return model.GetPostsSinceForSyncCursor{
		LastPostUpdateAt: c.LastPostUpdateAt,
		LastPostUpdateID: c.LastPostId, // proto uses LastPostId, model uses LastPostUpdateID
	}
}

// =============================================================================
// WebSocket Broadcast Conversions
// =============================================================================

// websocketBroadcastFromProto converts a pb.WebsocketBroadcast to model.WebsocketBroadcast.
func websocketBroadcastFromProto(b *pb.WebsocketBroadcast) *model.WebsocketBroadcast {
	if b == nil {
		return nil
	}
	// Convert []string to map[string]bool for OmitUsers
	omitUsers := make(map[string]bool)
	for _, u := range b.OmitUsers {
		omitUsers[u] = true
	}
	// OmitConnectionId in proto is bool, in model is string
	omitConnectionId := ""
	if b.OmitConnectionId {
		omitConnectionId = b.ConnectionId // use ConnectionId as the omitted one
	}
	return &model.WebsocketBroadcast{
		OmitUsers:        omitUsers,
		UserId:           b.UserId,
		ChannelId:        b.ChannelId,
		TeamId:           b.TeamId,
		OmitConnectionId: omitConnectionId,
		// Note: ContainsSanitizedData and ContainsSensitiveData not in proto
	}
}

// =============================================================================
// License Conversions
// =============================================================================

// licenseToJSON converts a model.License to JSON bytes.
func licenseToJSON(l *model.License) []byte {
	if l == nil {
		return nil
	}
	data, err := json.Marshal(l)
	if err != nil {
		return nil
	}
	return data
}

// =============================================================================
// PluginClusterEvent Conversions
// =============================================================================

// pluginClusterEventFromProto converts a pb.PluginClusterEvent to model.PluginClusterEvent.
func pluginClusterEventFromProto(e *pb.PluginClusterEvent) model.PluginClusterEvent {
	if e == nil {
		return model.PluginClusterEvent{}
	}
	return model.PluginClusterEvent{
		Id:   e.Id,
		Data: e.Data,
	}
}

// pluginClusterEventSendOptionsFromProto converts a pb.PluginClusterEventSendOptions to model.PluginClusterEventSendOptions.
func pluginClusterEventSendOptionsFromProto(opts *pb.PluginClusterEventSendOptions) model.PluginClusterEventSendOptions {
	if opts == nil {
		return model.PluginClusterEventSendOptions{}
	}
	return model.PluginClusterEventSendOptions{
		TargetId: opts.TargetId,
	}
}

// =============================================================================
// OpenDialogRequest Conversions
// =============================================================================

// openDialogRequestFromProto converts a pb.OpenInteractiveDialogRequest to model.OpenDialogRequest.
func openDialogRequestFromProto(r *pb.OpenInteractiveDialogRequest) model.OpenDialogRequest {
	if r == nil {
		return model.OpenDialogRequest{}
	}
	// OpenInteractiveDialogRequest contains a Dialog field which has TriggerId, Url, Dialog
	if r.Dialog == nil {
		return model.OpenDialogRequest{}
	}
	result := model.OpenDialogRequest{
		TriggerId: r.Dialog.TriggerId,
		URL:       r.Dialog.Url,
	}
	if r.Dialog.Dialog != nil {
		result.Dialog = dialogFromProto(r.Dialog.Dialog)
	}
	return result
}

// dialogFromProto converts a pb.Dialog to model.Dialog.
func dialogFromProto(d *pb.Dialog) model.Dialog {
	if d == nil {
		return model.Dialog{}
	}
	dialog := model.Dialog{
		CallbackId:       d.CallbackId,
		Title:            d.Title,
		IntroductionText: d.IntroductionText,
		IconURL:          d.IconUrl,
		SubmitLabel:      d.SubmitLabel,
		NotifyOnCancel:   d.NotifyOnCancel,
		State:            d.State,
	}
	if d.Elements != nil {
		dialog.Elements = dialogElementsFromProto(d.Elements)
	}
	return dialog
}

// dialogElementsFromProto converts a slice of pb.DialogElement to model.DialogElement.
func dialogElementsFromProto(elements []*pb.DialogElement) []model.DialogElement {
	if elements == nil {
		return nil
	}
	result := make([]model.DialogElement, len(elements))
	for i, e := range elements {
		result[i] = dialogElementFromProto(e)
	}
	return result
}

// dialogElementFromProto converts a pb.DialogElement to model.DialogElement.
func dialogElementFromProto(e *pb.DialogElement) model.DialogElement {
	if e == nil {
		return model.DialogElement{}
	}
	elem := model.DialogElement{
		DisplayName: e.DisplayName,
		Name:        e.Name,
		Type:        e.Type,
		SubType:     e.Subtype,
		Default:     e.Default,
		Placeholder: e.Placeholder,
		HelpText:    e.HelpText,
		Optional:    e.Optional,
		MinLength:   int(e.MinLength),
		MaxLength:   int(e.MaxLength),
	}
	return elem
}

// =============================================================================
// Upload Session Conversions
// =============================================================================

// uploadSessionToProto converts a model.UploadSession to a pb.UploadSession.
func uploadSessionToProto(us *model.UploadSession) *pb.UploadSession {
	if us == nil {
		return nil
	}
	return &pb.UploadSession{
		Id:        us.Id,
		Type:      string(us.Type),
		CreateAt:  us.CreateAt,
		UserId:    us.UserId,
		ChannelId: us.ChannelId,
		Filename:  us.Filename,
		Path:      us.Path,
		FileSize:  us.FileSize,
		FileOffset: us.FileOffset,
	}
}

// uploadSessionFromProto converts a pb.UploadSession to a model.UploadSession.
func uploadSessionFromProto(us *pb.UploadSession) *model.UploadSession {
	if us == nil {
		return nil
	}
	return &model.UploadSession{
		Id:        us.Id,
		Type:      model.UploadType(us.Type),
		CreateAt:  us.CreateAt,
		UserId:    us.UserId,
		ChannelId: us.ChannelId,
		Filename:  us.Filename,
		Path:      us.Path,
		FileSize:  us.FileSize,
		FileOffset: us.FileOffset,
	}
}

// =============================================================================
// PushNotification Conversions
// =============================================================================

// pushNotificationFromProto converts a pb.PushNotification to a model.PushNotification.
func pushNotificationFromProto(pn *pb.PushNotification) *model.PushNotification {
	if pn == nil {
		return nil
	}
	// Badge in proto is string, in model is int
	badge := 0
	if pn.Badge != "" {
		// Try to parse, default to 0 on error
		_ = json.Unmarshal([]byte(pn.Badge), &badge)
	}
	return &model.PushNotification{
		AckId:            pn.AckId,
		Platform:         pn.Platform,
		ServerId:         pn.ServerId,
		DeviceId:         pn.DeviceId,
		PostId:           pn.PostId,
		Category:         pn.Category,
		Sound:            pn.Sound,
		Message:          pn.Message,
		Badge:            badge,
		TeamId:           pn.TeamId,
		ChannelId:        pn.ChannelId,
		RootId:           pn.RootId,
		ChannelName:      pn.ChannelName,
		Type:             pn.Type,
		SenderId:         pn.SenderId,
		SenderName:       pn.SenderName,
		OverrideUsername: pn.OverrideUsername,
		OverrideIconURL:  pn.OverrideIconUrl,
		FromWebhook:      pn.FromWebhook,
		Version:          pn.Version,
		// Note: ContentAvailable, IsIdLoaded not in proto
	}
}

// Note: CreateDefaultMembershipParams conversion removed as the RPC doesn't exist in proto.
