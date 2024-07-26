// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"

	"github.com/francoispqt/gojay"
)

// AuditModelTypeConv converts key model types to something better suited for audit output.
func AuditModelTypeConv(val any) (newVal any, converted bool) {
	if val == nil {
		return nil, false
	}
	switch v := val.(type) {
	case *Channel:
		return newAuditChannel(v), true
	case Channel:
		return newAuditChannel(&v), true
	case *Team:
		return newAuditTeam(v), true
	case Team:
		return newAuditTeam(&v), true
	case *User:
		return newAuditUser(v), true
	case User:
		return newAuditUser(&v), true
	case *UserPatch:
		return newAuditUserPatch(v), true
	case UserPatch:
		return newAuditUserPatch(&v), true
	case *Command:
		return newAuditCommand(v), true
	case Command:
		return newAuditCommand(&v), true
	case *CommandArgs:
		return newAuditCommandArgs(v), true
	case CommandArgs:
		return newAuditCommandArgs(&v), true
	case *Bot:
		return newAuditBot(v), true
	case Bot:
		return newAuditBot(&v), true
	case *ChannelModerationPatch:
		return newAuditChannelModerationPatch(v), true
	case ChannelModerationPatch:
		return newAuditChannelModerationPatch(&v), true
	case *Emoji:
		return newAuditEmoji(v), true
	case Emoji:
		return newAuditEmoji(&v), true
	case *FileInfo:
		return newAuditFileInfo(v), true
	case FileInfo:
		return newAuditFileInfo(&v), true
	case *Group:
		return newAuditGroup(v), true
	case Group:
		return newAuditGroup(&v), true
	case *Job:
		return newAuditJob(v), true
	case Job:
		return newAuditJob(&v), true
	case *OAuthApp:
		return newAuditOAuthApp(v), true
	case OAuthApp:
		return newAuditOAuthApp(&v), true
	case *Post:
		return newAuditPost(v), true
	case Post:
		return newAuditPost(&v), true
	case *Role:
		return newAuditRole(v), true
	case Role:
		return newAuditRole(&v), true
	case *Scheme:
		return newAuditScheme(v), true
	case Scheme:
		return newAuditScheme(&v), true
	case *SchemeRoles:
		return newAuditSchemeRoles(v), true
	case SchemeRoles:
		return newAuditSchemeRoles(&v), true
	case *Session:
		return newAuditSession(v), true
	case Session:
		return newAuditSession(&v), true
	case *IncomingWebhook:
		return newAuditIncomingWebhook(v), true
	case IncomingWebhook:
		return newAuditIncomingWebhook(&v), true
	case *OutgoingWebhook:
		return newAuditOutgoingWebhook(v), true
	case OutgoingWebhook:
		return newAuditOutgoingWebhook(&v), true
	case *RemoteCluster:
		return newRemoteCluster(v), true
	case RemoteCluster:
		return newRemoteCluster(&v), true
	}
	return val, false
}

type auditChannel struct {
	ID   string
	Name string
	Type ChannelType
}

// newAuditChannel creates a simplified representation of Channel for output to audit log.
func newAuditChannel(c *Channel) auditChannel {
	var channel auditChannel
	if c != nil {
		channel.ID = c.Id
		channel.Name = c.Name
		channel.Type = c.Type
	}
	return channel
}

func (c auditChannel) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", c.ID)
	enc.StringKey("name", c.Name)
	enc.StringKey("type", string(c.Type))
}

func (c auditChannel) IsNil() bool {
	return false
}

type auditTeam struct {
	ID   string
	Name string
	Type string
}

// newAuditTeam creates a simplified representation of Team for output to audit log.
func newAuditTeam(t *Team) auditTeam {
	var team auditTeam
	if t != nil {
		team.ID = t.Id
		team.Name = t.Name
		team.Type = t.Type
	}
	return team
}

func (t auditTeam) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", t.ID)
	enc.StringKey("name", t.Name)
	enc.StringKey("type", t.Type)
}

func (t auditTeam) IsNil() bool {
	return false
}

type auditUser struct {
	ID    string
	Name  string
	Roles string
}

// newAuditUser creates a simplified representation of User for output to audit log.
func newAuditUser(u *User) auditUser {
	var user auditUser
	if u != nil {
		user.ID = u.Id
		user.Name = u.Username
		user.Roles = u.Roles
	}
	return user
}

type auditUserPatch struct {
	Name string
}

// newAuditUserPatch creates a simplified representation of UserPatch for output to audit log.
func newAuditUserPatch(up *UserPatch) auditUserPatch {
	var userPatch auditUserPatch
	if up != nil {
		if up.Username != nil {
			userPatch.Name = *up.Username
		}
	}
	return userPatch
}

func (u auditUser) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", u.ID)
	enc.StringKey("name", u.Name)
	enc.StringKey("roles", u.Roles)
}

func (u auditUser) IsNil() bool {
	return false
}

type auditCommand struct {
	ID               string
	CreatorID        string
	TeamID           string
	Trigger          string
	Method           string
	Username         string
	IconURL          string
	AutoComplete     bool
	AutoCompleteDesc string
	AutoCompleteHint string
	DisplayName      string
	Description      string
	URL              string
}

// newAuditCommand creates a simplified representation of Command for output to audit log.
func newAuditCommand(c *Command) auditCommand {
	var cmd auditCommand
	if c != nil {
		cmd.ID = c.Id
		cmd.CreatorID = c.CreatorId
		cmd.TeamID = c.TeamId
		cmd.Trigger = c.Trigger
		cmd.Method = c.Method
		cmd.Username = c.Username
		cmd.IconURL = c.IconURL
		cmd.AutoComplete = c.AutoComplete
		cmd.AutoCompleteDesc = c.AutoCompleteDesc
		cmd.AutoCompleteHint = c.AutoCompleteHint
		cmd.DisplayName = c.DisplayName
		cmd.Description = c.Description
		cmd.URL = c.URL
	}
	return cmd
}

func (cmd auditCommand) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", cmd.ID)
	enc.StringKey("creator_id", cmd.CreatorID)
	enc.StringKey("team_id", cmd.TeamID)
	enc.StringKey("trigger", cmd.Trigger)
	enc.StringKey("method", cmd.Method)
	enc.StringKey("username", cmd.Username)
	enc.StringKey("icon_url", cmd.IconURL)
	enc.BoolKey("auto_complete", cmd.AutoComplete)
	enc.StringKey("auto_complete_desc", cmd.AutoCompleteDesc)
	enc.StringKey("auto_complete_hint", cmd.AutoCompleteHint)
	enc.StringKey("display", cmd.DisplayName)
	enc.StringKey("desc", cmd.Description)
	enc.StringKey("url", cmd.URL)
}

func (cmd auditCommand) IsNil() bool {
	return false
}

type auditCommandArgs struct {
	ChannelID string
	TeamID    string
	TriggerID string
	Command   string
}

// newAuditCommandArgs creates a simplified representation of CommandArgs for output to audit log.
func newAuditCommandArgs(ca *CommandArgs) auditCommandArgs {
	var cmdargs auditCommandArgs
	if ca != nil {
		cmdargs.ChannelID = ca.ChannelId
		cmdargs.TeamID = ca.TeamId
		cmdargs.TriggerID = ca.TriggerId
		cmdFields := strings.Fields(ca.Command)
		if len(cmdFields) > 0 {
			cmdargs.Command = cmdFields[0]
		}
	}
	return cmdargs
}

func (ca auditCommandArgs) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("channel_id", ca.ChannelID)
	enc.StringKey("team_id", ca.TriggerID)
	enc.StringKey("trigger_id", ca.TeamID)
	enc.StringKey("command", ca.Command)
}

func (ca auditCommandArgs) IsNil() bool {
	return false
}

type auditBot struct {
	UserID      string
	Username    string
	Displayname string
}

// newAuditBot creates a simplified representation of Bot for output to audit log.
func newAuditBot(b *Bot) auditBot {
	var bot auditBot
	if b != nil {
		bot.UserID = b.UserId
		bot.Username = b.Username
		bot.Displayname = b.DisplayName
	}
	return bot
}

func (b auditBot) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("user_id", b.UserID)
	enc.StringKey("username", b.Username)
	enc.StringKey("display", b.Displayname)
}

func (b auditBot) IsNil() bool {
	return false
}

type auditChannelModerationPatch struct {
	Name        string
	RoleGuests  bool
	RoleMembers bool
}

// newAuditChannelModerationPatch creates a simplified representation of ChannelModerationPatch for output to audit log.
func newAuditChannelModerationPatch(p *ChannelModerationPatch) auditChannelModerationPatch {
	var patch auditChannelModerationPatch
	if p != nil {
		if p.Name != nil {
			patch.Name = *p.Name
		}
		if p.Roles.Guests != nil {
			patch.RoleGuests = *p.Roles.Guests
		}
		if p.Roles.Members != nil {
			patch.RoleMembers = *p.Roles.Members
		}
	}
	return patch
}

func (p auditChannelModerationPatch) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("name", p.Name)
	enc.BoolKey("role_guests", p.RoleGuests)
	enc.BoolKey("role_members", p.RoleMembers)
}

func (p auditChannelModerationPatch) IsNil() bool {
	return false
}

type auditEmoji struct {
	ID   string
	Name string
}

// newAuditEmoji creates a simplified representation of Emoji for output to audit log.
func newAuditEmoji(e *Emoji) auditEmoji {
	var emoji auditEmoji
	if e != nil {
		emoji.ID = e.Id
		emoji.Name = e.Name
	}
	return emoji
}

func (e auditEmoji) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", e.ID)
	enc.StringKey("name", e.Name)
}

func (e auditEmoji) IsNil() bool {
	return false
}

type auditFileInfo struct {
	ID        string
	PostID    string
	Path      string
	Name      string
	Extension string
	Size      int64
}

// newAuditFileInfo creates a simplified representation of FileInfo for output to audit log.
func newAuditFileInfo(f *FileInfo) auditFileInfo {
	var fi auditFileInfo
	if f != nil {
		fi.ID = f.Id
		fi.PostID = f.PostId
		fi.Path = f.Path
		fi.Name = f.Name
		fi.Extension = f.Extension
		fi.Size = f.Size
	}
	return fi
}

func (fi auditFileInfo) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", fi.ID)
	enc.StringKey("post_id", fi.PostID)
	enc.StringKey("path", fi.Path)
	enc.StringKey("name", fi.Name)
	enc.StringKey("ext", fi.Extension)
	enc.Int64Key("size", fi.Size)
}

func (fi auditFileInfo) IsNil() bool {
	return false
}

type auditGroup struct {
	ID          string
	Name        string
	DisplayName string
	Description string
}

// newAuditGroup creates a simplified representation of Group for output to audit log.
func newAuditGroup(g *Group) auditGroup {
	var group auditGroup
	if g != nil {
		group.ID = g.Id
		if g.Name == nil {
			group.Name = ""
		} else {
			group.Name = *g.Name
		}
		group.DisplayName = g.DisplayName
		group.Description = g.Description
	}
	return group
}

func (g auditGroup) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", g.ID)
	enc.StringKey("name", g.Name)
	enc.StringKey("display", g.DisplayName)
	enc.StringKey("desc", g.Description)
}

func (g auditGroup) IsNil() bool {
	return false
}

type auditJob struct {
	ID       string
	Type     string
	Priority int64
	StartAt  int64
}

// newAuditJob creates a simplified representation of Job for output to audit log.
func newAuditJob(j *Job) auditJob {
	var job auditJob
	if j != nil {
		job.ID = j.Id
		job.Type = j.Type
		job.Priority = j.Priority
		job.StartAt = j.StartAt
	}
	return job
}

func (j auditJob) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", j.ID)
	enc.StringKey("type", j.Type)
	enc.Int64Key("priority", j.Priority)
	enc.Int64Key("start_at", j.StartAt)
}

func (j auditJob) IsNil() bool {
	return false
}

type auditOAuthApp struct {
	ID          string
	CreatorID   string
	Name        string
	Description string
	IsTrusted   bool
}

// newAuditOAuthApp creates a simplified representation of OAuthApp for output to audit log.
func newAuditOAuthApp(o *OAuthApp) auditOAuthApp {
	var oauth auditOAuthApp
	if o != nil {
		oauth.ID = o.Id
		oauth.CreatorID = o.CreatorId
		oauth.Name = o.Name
		oauth.Description = o.Description
		oauth.IsTrusted = o.IsTrusted
	}
	return oauth
}

func (o auditOAuthApp) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", o.ID)
	enc.StringKey("creator_id", o.CreatorID)
	enc.StringKey("name", o.Name)
	enc.StringKey("desc", o.Description)
	enc.BoolKey("trusted", o.IsTrusted)
}

func (o auditOAuthApp) IsNil() bool {
	return false
}

type auditPost struct {
	ID        string
	ChannelID string
	Type      string
	IsPinned  bool
}

// newAuditPost creates a simplified representation of Post for output to audit log.
func newAuditPost(p *Post) auditPost {
	var post auditPost
	if p != nil {
		post.ID = p.Id
		post.ChannelID = p.ChannelId
		post.Type = p.Type
		post.IsPinned = p.IsPinned
	}
	return post
}

func (p auditPost) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", p.ID)
	enc.StringKey("channel_id", p.ChannelID)
	enc.StringKey("type", p.Type)
	enc.BoolKey("pinned", p.IsPinned)
}

func (p auditPost) IsNil() bool {
	return false
}

type auditRole struct {
	ID            string
	Name          string
	DisplayName   string
	Permissions   []string
	SchemeManaged bool
	BuiltIn       bool
}

// newAuditRole creates a simplified representation of Role for output to audit log.
func newAuditRole(r *Role) auditRole {
	var role auditRole
	if r != nil {
		role.ID = r.Id
		role.Name = r.Name
		role.DisplayName = r.DisplayName
		role.Permissions = append(role.Permissions, r.Permissions...)
		role.SchemeManaged = r.SchemeManaged
		role.BuiltIn = r.BuiltIn
	}
	return role
}

func (r auditRole) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", r.ID)
	enc.StringKey("name", r.Name)
	enc.StringKey("display", r.DisplayName)
	enc.SliceStringKey("perms", r.Permissions)
	enc.BoolKey("schemeManaged", r.SchemeManaged)
	enc.BoolKey("builtin", r.BuiltIn)
}

func (r auditRole) IsNil() bool {
	return false
}

type auditScheme struct {
	ID          string
	Name        string
	DisplayName string
	Scope       string
}

// newAuditScheme creates a simplified representation of Scheme for output to audit log.
func newAuditScheme(s *Scheme) auditScheme {
	var scheme auditScheme
	if s != nil {
		scheme.ID = s.Id
		scheme.Name = s.Name
		scheme.DisplayName = s.DisplayName
		scheme.Scope = s.Scope
	}
	return scheme
}

func (s auditScheme) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", s.ID)
	enc.StringKey("name", s.Name)
	enc.StringKey("display", s.DisplayName)
	enc.StringKey("scope", s.Scope)
}

func (s auditScheme) IsNil() bool {
	return false
}

type auditSchemeRoles struct {
	SchemeAdmin bool
	SchemeUser  bool
	SchemeGuest bool
}

// newAuditSchemeRoles creates a simplified representation of SchemeRoles for output to audit log.
func newAuditSchemeRoles(s *SchemeRoles) auditSchemeRoles {
	var roles auditSchemeRoles
	if s != nil {
		roles.SchemeAdmin = s.SchemeAdmin
		roles.SchemeUser = s.SchemeUser
		roles.SchemeGuest = s.SchemeGuest
	}
	return roles
}

func (s auditSchemeRoles) MarshalJSONObject(enc *gojay.Encoder) {
	enc.BoolKey("admin", s.SchemeAdmin)
	enc.BoolKey("user", s.SchemeUser)
	enc.BoolKey("guest", s.SchemeGuest)
}

func (s auditSchemeRoles) IsNil() bool {
	return false
}

type auditSession struct {
	ID       string
	UserId   string
	DeviceId string
}

// newAuditSession creates a simplified representation of Session for output to audit log.
func newAuditSession(s *Session) auditSession {
	var session auditSession
	if s != nil {
		session.ID = s.Id
		session.UserId = s.UserId
		session.DeviceId = s.DeviceId
	}
	return session
}

func (s auditSession) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", s.ID)
	enc.StringKey("user_id", s.UserId)
	enc.StringKey("device_id", s.DeviceId)
}

func (s auditSession) IsNil() bool {
	return false
}

type auditIncomingWebhook struct {
	ID          string
	ChannelID   string
	TeamId      string
	DisplayName string
	Description string
}

// newAuditIncomingWebhook creates a simplified representation of IncomingWebhook for output to audit log.
func newAuditIncomingWebhook(h *IncomingWebhook) auditIncomingWebhook {
	var hook auditIncomingWebhook
	if h != nil {
		hook.ID = h.Id
		hook.ChannelID = h.ChannelId
		hook.TeamId = h.TeamId
		hook.DisplayName = h.DisplayName
		hook.Description = h.Description
	}
	return hook
}

func (h auditIncomingWebhook) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", h.ID)
	enc.StringKey("channel_id", h.ChannelID)
	enc.StringKey("team_id", h.TeamId)
	enc.StringKey("display", h.DisplayName)
	enc.StringKey("desc", h.Description)
}

func (h auditIncomingWebhook) IsNil() bool {
	return false
}

type auditOutgoingWebhook struct {
	ID           string
	ChannelID    string
	TeamID       string
	TriggerWords StringArray
	TriggerWhen  int
	DisplayName  string
	Description  string
	ContentType  string
	Username     string
}

// newAuditOutgoingWebhook creates a simplified representation of OutgoingWebhook for output to audit log.
func newAuditOutgoingWebhook(h *OutgoingWebhook) auditOutgoingWebhook {
	var hook auditOutgoingWebhook
	if h != nil {
		hook.ID = h.Id
		hook.ChannelID = h.ChannelId
		hook.TeamID = h.TeamId
		hook.TriggerWords = h.TriggerWords
		hook.TriggerWhen = h.TriggerWhen
		hook.DisplayName = h.DisplayName
		hook.Description = h.Description
		hook.ContentType = h.ContentType
		hook.Username = h.Username
	}
	return hook
}

func (h auditOutgoingWebhook) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", h.ID)
	enc.StringKey("channel_id", h.ChannelID)
	enc.StringKey("team_id", h.TeamID)
	enc.SliceStringKey("trigger_words", h.TriggerWords)
	enc.IntKey("trigger_when", h.TriggerWhen)
	enc.StringKey("display", h.DisplayName)
	enc.StringKey("desc", h.Description)
	enc.StringKey("content_type", h.ContentType)
	enc.StringKey("username", h.Username)
}

func (h auditOutgoingWebhook) IsNil() bool {
	return false
}

type auditRemoteCluster struct {
	RemoteId     string
	RemoteTeamId string
	Name         string
	DisplayName  string
	SiteURL      string
	CreateAt     int64
	LastPingAt   int64
	CreatorId    string
}

// newRemoteCluster creates a simplified representation of RemoteCluster for output to audit log.
func newRemoteCluster(r *RemoteCluster) auditRemoteCluster {
	var rc auditRemoteCluster
	if r != nil {
		rc.RemoteId = r.RemoteId
		rc.Name = r.Name
		rc.DisplayName = r.DisplayName
		rc.SiteURL = r.SiteURL
		rc.CreateAt = r.CreateAt
		rc.LastPingAt = r.LastPingAt
		rc.CreatorId = r.CreatorId
	}
	return rc
}

func (r auditRemoteCluster) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("remote_id", r.RemoteId)
	enc.StringKey("remote_team_id", r.RemoteTeamId)
	enc.StringKey("name", r.Name)
	enc.StringKey("display_name", r.DisplayName)
	enc.StringKey("site_url", r.SiteURL)
	enc.Int64Key("create_at", r.CreateAt)
	enc.Int64Key("last_ping_at", r.LastPingAt)
	enc.StringKey("creator_id", r.CreatorId)
}

func (r auditRemoteCluster) IsNil() bool {
	return false
}
