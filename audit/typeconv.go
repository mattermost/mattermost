// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"github.com/francoispqt/gojay"
	"github.com/mattermost/mattermost-server/v5/model"
)

type Channel struct {
	ID   string
	Name string
	Type string
}

// NewChannel creates a simplified representation of model.Channel for output to audit log.
func NewChannel(c *model.Channel) Channel {
	var channel Channel
	if c != nil {
		channel.ID = c.Id
		channel.Name = c.Name
		channel.Type = c.Type
	}
	return channel
}

func (c Channel) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", c.ID)
	enc.StringKey("name", c.Name)
	enc.StringKey("type", c.Type)
}

func (t Channel) IsNil() bool {
	return false
}

type Team struct {
	ID   string
	Name string
}

// NewTeam creates a simplified representation of model.Team for output to audit log.
func NewTeam(t *model.Team) Team {
	var team Team
	if t != nil {
		team.ID = t.Id
		team.Name = t.Name
	}
	return team
}

func (t Team) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", t.ID)
	enc.StringKey("name", t.Name)
}

func (t Team) IsNil() bool {
	return false
}

type User struct {
	ID   string
	Name string
}

// Newuser creates a simplified representation of model.User for output to audit log.
func NewUser(u *model.User) User {
	var user User
	if u != nil {
		user.ID = u.Id
		user.Name = u.Username
	}
	return user
}

func (u User) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", u.ID)
	enc.StringKey("name", u.Name)
}

func (u User) IsNil() bool {
	return false
}

type Command struct {
	ID      string
	Trigger string
	TeamID  string
}

// NewCommand creates a simplified representation of model.Command for output to audit log.
func NewCommand(c *model.Command) Command {
	var cmd Command
	if c != nil {
		cmd.ID = c.Id
		cmd.Trigger = c.Trigger
		cmd.TeamID = c.TeamId
	}
	return cmd
}

func (cmd Command) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", cmd.ID)
	enc.StringKey("trigger", cmd.Trigger)
	enc.StringKey("team_id", cmd.TeamID)
}

func (cmd Command) IsNil() bool {
	return false
}

type CommandArgs struct {
	ChannelID string
	TeamID    string
	TriggerID string
	Command   string
}

// NewCommandArgs creates a simplified representation of model.CommandArgs for output to audit log.
func NewCommandArgs(ca *model.CommandArgs) CommandArgs {
	var cmdargs CommandArgs
	if ca != nil {
		cmdargs.ChannelID = ca.ChannelId
		cmdargs.TeamID = ca.TeamId
		cmdargs.TriggerID = ca.TriggerId
		cmdargs.Command = ca.Command
	}
	return cmdargs
}

func (ca CommandArgs) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("channel_id", ca.ChannelID)
	enc.StringKey("team_id", ca.TriggerID)
	enc.StringKey("trigger_id", ca.TeamID)
	enc.StringKey("command", ca.Command)
}

func (ca CommandArgs) IsNil() bool {
	return false
}

type Bot struct {
	UserID      string
	Username    string
	Displayname string
}

// NewBot creates a simplified representation of model.Bot for output to audit log.
func NewBot(b *model.Bot) Bot {
	var bot Bot
	if b != nil {
		bot.UserID = b.UserId
		bot.Username = b.Username
		bot.Displayname = b.DisplayName
	}
	return bot
}

func (b Bot) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("user_id", b.UserID)
	enc.StringKey("username", b.Username)
	enc.StringKey("display", b.Displayname)
}

func (b Bot) IsNil() bool {
	return false
}

type ChannelModerationPatch struct {
	Name        string
	RoleGuests  bool
	RoleMembers bool
}

// NewChannelModerationPatch creates a simplified representation of model.ChannelModerationPatch for output to audit log.
func NewChannelModerationPatch(p *model.ChannelModerationPatch) ChannelModerationPatch {
	var patch ChannelModerationPatch
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

func (p ChannelModerationPatch) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("name", p.Name)
	enc.BoolKey("role_guests", p.RoleGuests)
	enc.BoolKey("role_members", p.RoleMembers)
}

func (p ChannelModerationPatch) IsNil() bool {
	return false
}

type ChannelModerationPatchArray []ChannelModerationPatch

// NewChannelModerationPatchArray creates a simplified representation of an array of
// model.ChannelModerationPatch for output to audit log.
func NewChannelModerationPatchArray(a []*model.ChannelModerationPatch) ChannelModerationPatchArray {
	var arr ChannelModerationPatchArray
	for _, p := range a {
		if p != nil {
			arr = append(arr, NewChannelModerationPatch(p))
		}
	}
	return arr
}

func (a ChannelModerationPatchArray) MarshalJSONArray(enc *gojay.Encoder) {
	for _, p := range a {
		enc.Object(p)
	}
}

func (a ChannelModerationPatchArray) IsNil() bool {
	return len(a) == 0
}

type Emoji struct {
	ID   string
	Name string
}

// NewEmoji creates a simplified representation of model.Emoji for output to audit log.
func NewEmoji(e *model.Emoji) Emoji {
	var emoji Emoji
	if e != nil {
		emoji.ID = e.Id
		emoji.Name = e.Name
	}
	return emoji
}

func (e Emoji) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", e.ID)
	enc.StringKey("name", e.Name)
}

func (e Emoji) IsNil() bool {
	return false
}

type FileInfo struct {
	ID        string
	PostID    string
	Path      string
	Name      string
	Extension string
	Size      int64
}

// NewFileInfo creates a simplified representation of model.FileInfo for output to audit log.
func NewFileInfo(f *model.FileInfo) FileInfo {
	var fi FileInfo
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

func (fi FileInfo) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", fi.ID)
	enc.StringKey("post_id", fi.PostID)
	enc.StringKey("path", fi.Path)
	enc.StringKey("name", fi.Name)
	enc.StringKey("ext", fi.Extension)
	enc.Int64Key("size", fi.Size)
}

func (fi FileInfo) IsNil() bool {
	return false
}

type Group struct {
	ID          string
	Name        string
	DisplayName string
	Description string
}

// NewGroup creates a simplified representation of model.Group for output to audit log.
func NewGroup(g *model.Group) Group {
	var group Group
	if g != nil {
		group.ID = g.Id
		group.Name = g.Name
		group.DisplayName = g.DisplayName
		group.Description = g.Description
	}
	return group
}

func (g Group) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", g.ID)
	enc.StringKey("name", g.Name)
	enc.StringKey("display", g.DisplayName)
	enc.StringKey("desc", g.Description)
}

func (g Group) IsNil() bool {
	return false
}

type Job struct {
	ID       string
	Type     string
	Priority int64
	StartAt  int64
}

// NewJob creates a simplified representation of model.Job for output to audit log.
func NewJob(j *model.Job) Job {
	var job Job
	if j != nil {
		job.ID = j.Id
		job.Type = j.Type
		job.Priority = j.Priority
		job.StartAt = j.StartAt
	}
	return job
}

func (j Job) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", j.ID)
	enc.StringKey("type", j.Type)
	enc.Int64Key("priority", j.Priority)
	enc.Int64Key("start_at", j.StartAt)
}

func (j Job) IsNil() bool {
	return false
}

type OAuthApp struct {
	ID          string
	CreatorID   string
	Name        string
	Description string
	IsTrusted   bool
}

// NewOAuthApp creates a simplified representation of model.OAuthApp for output to audit log.
func NewOAuthApp(o *model.OAuthApp) OAuthApp {
	var oauth OAuthApp
	if o != nil {
		oauth.ID = o.Id
		oauth.CreatorID = o.CreatorId
		oauth.Name = o.Name
		oauth.Description = o.Description
		oauth.IsTrusted = o.IsTrusted
	}
	return oauth
}

func (o OAuthApp) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", o.ID)
	enc.StringKey("creator_id", o.CreatorID)
	enc.StringKey("name", o.Name)
	enc.StringKey("desc", o.Description)
	enc.BoolKey("trusted", o.IsTrusted)
}

func (o OAuthApp) IsNil() bool {
	return false
}

type Post struct {
	ID        string
	ChannelID string
	Type      string
	IsPinned  bool
}

// NewPost creates a simplified representation of model.Post for output to audit log.
func NewPost(p *model.Post) Post {
	var post Post
	if p != nil {
		post.ID = p.Id
		post.ChannelID = p.ChannelId
		post.Type = p.Type
		post.IsPinned = p.IsPinned
	}
	return post
}

func (p Post) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", p.ID)
	enc.StringKey("channel_id", p.ChannelID)
	enc.StringKey("type", p.Type)
	enc.BoolKey("pinned", p.IsPinned)
}

func (p Post) IsNil() bool {
	return false
}

type Role struct {
	ID            string
	Name          string
	DisplayName   string
	Permissions   []string
	SchemeManaged bool
	BuiltIn       bool
}

// NewRole creates a simplified representation of model.Role for output to audit log.
func NewRole(r *model.Role) Role {
	var role Role
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

func (r Role) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", r.ID)
	enc.StringKey("name", r.Name)
	enc.StringKey("display", r.DisplayName)
	enc.SliceStringKey("perms", r.Permissions)
	enc.BoolKey("schemeManaged", r.SchemeManaged)
	enc.BoolKey("builtin", r.BuiltIn)
}

func (r Role) IsNil() bool {
	return false
}

type Scheme struct {
	ID          string
	Name        string
	DisplayName string
	Scope       string
}

// NewScheme creates a simplified representation of model.Scheme for output to audit log.
func NewScheme(s *model.Scheme) Scheme {
	var scheme Scheme
	if s != nil {
		scheme.ID = s.Id
		scheme.Name = s.Name
		scheme.DisplayName = s.DisplayName
		scheme.Scope = s.Scope
	}
	return scheme
}

func (s Scheme) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", s.ID)
	enc.StringKey("name", s.Name)
	enc.StringKey("display", s.DisplayName)
	enc.StringKey("scope", s.Scope)
}

func (s Scheme) IsNil() bool {
	return false
}

type SchemeRoles struct {
	SchemeAdmin bool
	SchemeUser  bool
	SchemeGuest bool
}

// NewSchemeRoles creates a simplified representation of model.SchemeRoles for output to audit log.
func NewSchemeRoles(s *model.SchemeRoles) SchemeRoles {
	var roles SchemeRoles
	if s != nil {
		roles.SchemeAdmin = s.SchemeAdmin
		roles.SchemeUser = s.SchemeUser
		roles.SchemeGuest = s.SchemeGuest
	}
	return roles
}

func (s SchemeRoles) MarshalJSONObject(enc *gojay.Encoder) {
	enc.BoolKey("admin", s.SchemeAdmin)
	enc.BoolKey("user", s.SchemeUser)
	enc.BoolKey("guest", s.SchemeGuest)
}

func (s SchemeRoles) IsNil() bool {
	return false
}

type Session struct {
	ID       string
	UserId   string
	DeviceId string
}

// NewSession creates a simplified representation of model.Session for output to audit log.
func NewSession(s *model.Session) Session {
	var session Session
	if s != nil {
		session.ID = s.Id
		session.UserId = s.UserId
		session.DeviceId = s.DeviceId
	}
	return session
}

func (s Session) MarshalJSONObject(enc *gojay.Encoder) {
	enc.StringKey("id", s.ID)
	enc.StringKey("user_id", s.UserId)
	enc.StringKey("device_id", s.DeviceId)
}

func (s Session) IsNil() bool {
	return false
}
