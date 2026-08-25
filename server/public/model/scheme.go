// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/utils/timeutils"
)

const (
	SchemeDisplayNameMaxLength = 128
	SchemeNameMaxLength        = 64
	SchemeDescriptionMaxLength = 1024
	SchemeScopeTeam            = "team"
	SchemeScopeChannel         = "channel"
	SchemeScopePlaybook        = "playbook"
	SchemeScopeRun             = "run"

	// Seeded space default-capability preset schemes. Channel-scoped schemes
	// attached to space backing channels; the namespaced names make a collision
	// with a pre-existing customer scheme unlikely, and the seeding migration
	// refuses to adopt one that governs ordinary channels.
	SchemeNameSpaceContribute = "docs_space_contribute"
	SchemeNameSpaceComment    = "docs_space_comment"
	SchemeNameSpaceReadOnly   = "docs_space_readonly"

	SchemeDisplayNameSpaceContribute = "Space Contribute Scheme"
	SchemeDisplayNameSpaceComment    = "Space Comment Scheme"
	SchemeDisplayNameSpaceReadOnly   = "Space Read-Only Scheme"
)

// SpaceSchemeNames lists the seeded space preset scheme names. It is the
// enumeration source; membership tests go through IsSpaceSchemeName, which reads a
// set frozen at init so mutating this slice cannot widen what the guards accept.
var SpaceSchemeNames = []string{
	SchemeNameSpaceContribute,
	SchemeNameSpaceComment,
	SchemeNameSpaceReadOnly,
}

var spaceSchemeNameSet map[string]bool

func init() {
	spaceSchemeNameSet = make(map[string]bool, len(SpaceSchemeNames))
	for _, name := range SpaceSchemeNames {
		spaceSchemeNameSet[name] = true
	}
}

// IsSpaceSchemeName reports whether name is one of the seeded space preset scheme
// names. It is both the reservation predicate — these names may not be created or
// renamed into — and proof that a scheme is a preset, since Schemes.Name is unique
// and the seeding runs unconditionally.
func IsSpaceSchemeName(name string) bool {
	return spaceSchemeNameSet[name]
}

// PluginChannelSchemeNamePrefix labels every channel scheme minted on a plugin's
// behalf. Both suffixes are digests, so the whole name is fixed-length and stays
// well inside SchemeNameMaxLength.
const PluginChannelSchemeNamePrefix = "plugin_"

// pluginSchemeDigestLength is how much of each digest a plugin channel scheme name
// carries. Two of these plus the prefix and separator is 40 characters against a
// 64-character limit.
const pluginSchemeDigestLength = 16

// pluginSchemeNamePattern matches exactly what PluginChannelSchemeName produces.
var pluginSchemeNamePattern = regexp.MustCompile(
	fmt.Sprintf("^%s[0-9a-f]{%d}_[0-9a-f]{%d}$", PluginChannelSchemeNamePrefix, pluginSchemeDigestLength, pluginSchemeDigestLength))

// PluginChannelSchemeName returns the name of the channel scheme expressing the
// given generated-role permission sets for pluginID. The name is a pure function of
// its inputs, so every caller asking for the same sets resolves to one scheme.
// Both halves are digests because neither a plugin id (scheme names admit only
// [a-z0-9_]) nor the permission sets fit SchemeNameMaxLength spelled out.
func PluginChannelSchemeName(pluginID string, user, admin, guest []string) string {
	// Joined by a character no permission id contains, so moving a permission
	// between roles yields a different name rather than colliding.
	permissions := strings.Join([]string{
		strings.Join(NormalizePermissions(user), " "),
		strings.Join(NormalizePermissions(admin), " "),
		strings.Join(NormalizePermissions(guest), " "),
	}, "|")
	return PluginChannelSchemeNamePrefix + schemeDigest(pluginID) + "_" + schemeDigest(permissions)
}

// IsPluginChannelSchemeName reports whether name has the exact shape
// PluginChannelSchemeName produces. The whole shape is tested, not the prefix
// alone: a true answer makes the scheme permanently uneditable, and the prefix is
// a plain string a customer may already have used for a scheme of their own.
func IsPluginChannelSchemeName(name string) bool {
	return pluginSchemeNamePattern.MatchString(name)
}

func schemeDigest(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])[:pluginSchemeDigestLength]
}

type Scheme struct {
	Id                        string `json:"id"`
	Name                      string `json:"name"`
	DisplayName               string `json:"display_name"`
	Description               string `json:"description"`
	CreateAt                  int64  `json:"create_at"`
	UpdateAt                  int64  `json:"update_at"`
	DeleteAt                  int64  `json:"delete_at"`
	Scope                     string `json:"scope"`
	DefaultTeamAdminRole      string `json:"default_team_admin_role"`
	DefaultTeamUserRole       string `json:"default_team_user_role"`
	DefaultChannelAdminRole   string `json:"default_channel_admin_role"`
	DefaultChannelUserRole    string `json:"default_channel_user_role"`
	DefaultTeamGuestRole      string `json:"default_team_guest_role"`
	DefaultChannelGuestRole   string `json:"default_channel_guest_role"`
	DefaultPlaybookAdminRole  string `json:"default_playbook_admin_role"`
	DefaultPlaybookMemberRole string `json:"default_playbook_member_role"`
	DefaultRunAdminRole       string `json:"default_run_admin_role"`
	DefaultRunMemberRole      string `json:"default_run_member_role"`
}

func (scheme *Scheme) Auditable() map[string]any {
	return map[string]any{
		"id":                           scheme.Id,
		"name":                         scheme.Name,
		"display_name":                 scheme.DisplayName,
		"description":                  scheme.Description,
		"create_at":                    scheme.CreateAt,
		"update_at":                    scheme.UpdateAt,
		"delete_at":                    scheme.DeleteAt,
		"scope":                        scheme.Scope,
		"default_team_admin_role":      scheme.DefaultTeamAdminRole,
		"default_team_user_role":       scheme.DefaultTeamUserRole,
		"default_channel_admin_role":   scheme.DefaultChannelAdminRole,
		"default_channel_user_role":    scheme.DefaultChannelUserRole,
		"default_team_guest_role":      scheme.DefaultTeamGuestRole,
		"default_channel_guest_role":   scheme.DefaultChannelGuestRole,
		"default_playbook_admin_role":  scheme.DefaultPlaybookAdminRole,
		"default_playbook_member_role": scheme.DefaultPlaybookMemberRole,
		"default_run_admin_role":       scheme.DefaultRunAdminRole,
		"default_run_member_role":      scheme.DefaultRunMemberRole,
	}
}

func (scheme *Scheme) Sanitize() {
	scheme.Name = FakeSetting
	scheme.DisplayName = FakeSetting
	scheme.Description = FakeSetting
}

func (scheme *Scheme) MarshalYAML() (any, error) {
	return struct {
		Id                        string `yaml:"id"`
		Name                      string `yaml:"name"`
		DisplayName               string `yaml:"display_name"`
		Description               string `yaml:"description"`
		CreateAt                  string `yaml:"create_at"`
		UpdateAt                  string `yaml:"update_at"`
		DeleteAt                  string `yaml:"delete_at"`
		Scope                     string `yaml:"scope"`
		DefaultTeamAdminRole      string `yaml:"default_team_admin_role"`
		DefaultTeamUserRole       string `yaml:"default_team_user_role"`
		DefaultChannelAdminRole   string `yaml:"default_channel_admin_role"`
		DefaultChannelUserRole    string `yaml:"default_channel_user_role"`
		DefaultTeamGuestRole      string `yaml:"default_team_guest_role"`
		DefaultChannelGuestRole   string `yaml:"default_channel_guest_role"`
		DefaultPlaybookAdminRole  string `yaml:"default_playbook_admin_role"`
		DefaultPlaybookMemberRole string `yaml:"default_playbook_member_role"`
		DefaultRunAdminRole       string `yaml:"default_run_admin_role"`
		DefaultRunMemberRole      string `yaml:"default_run_member_role"`
	}{
		Id:                        scheme.Id,
		Name:                      scheme.Name,
		DisplayName:               scheme.DisplayName,
		Description:               scheme.Description,
		CreateAt:                  timeutils.FormatMillis(scheme.CreateAt),
		UpdateAt:                  timeutils.FormatMillis(scheme.UpdateAt),
		DeleteAt:                  timeutils.FormatMillis(scheme.DeleteAt),
		Scope:                     scheme.Scope,
		DefaultTeamAdminRole:      scheme.DefaultTeamAdminRole,
		DefaultTeamUserRole:       scheme.DefaultTeamUserRole,
		DefaultChannelAdminRole:   scheme.DefaultChannelAdminRole,
		DefaultChannelUserRole:    scheme.DefaultChannelUserRole,
		DefaultTeamGuestRole:      scheme.DefaultTeamGuestRole,
		DefaultChannelGuestRole:   scheme.DefaultChannelGuestRole,
		DefaultPlaybookAdminRole:  scheme.DefaultPlaybookAdminRole,
		DefaultPlaybookMemberRole: scheme.DefaultPlaybookMemberRole,
		DefaultRunAdminRole:       scheme.DefaultRunAdminRole,
		DefaultRunMemberRole:      scheme.DefaultRunMemberRole,
	}, nil
}

func (scheme *Scheme) UnmarshalYAML(unmarshal func(any) error) error {
	out := struct {
		Id                        string `yaml:"id"`
		Name                      string `yaml:"name"`
		DisplayName               string `yaml:"display_name"`
		Description               string `yaml:"description"`
		CreateAt                  string `yaml:"create_at"`
		UpdateAt                  string `yaml:"update_at"`
		DeleteAt                  string `yaml:"delete_at"`
		Scope                     string `yaml:"scope"`
		DefaultTeamAdminRole      string `yaml:"default_team_admin_role"`
		DefaultTeamUserRole       string `yaml:"default_team_user_role"`
		DefaultChannelAdminRole   string `yaml:"default_channel_admin_role"`
		DefaultChannelUserRole    string `yaml:"default_channel_user_role"`
		DefaultTeamGuestRole      string `yaml:"default_team_guest_role"`
		DefaultChannelGuestRole   string `yaml:"default_channel_guest_role"`
		DefaultPlaybookAdminRole  string `yaml:"default_playbook_admin_role"`
		DefaultPlaybookMemberRole string `yaml:"default_playbook_member_role"`
		DefaultRunAdminRole       string `yaml:"default_run_admin_role"`
		DefaultRunMemberRole      string `yaml:"default_run_member_role"`
	}{}

	err := unmarshal(&out)
	if err != nil {
		return err
	}

	createAt, err := timeutils.ParseFormatedMillis(out.CreateAt)
	if err != nil {
		return err
	}
	updateAt, err := timeutils.ParseFormatedMillis(out.UpdateAt)
	if err != nil {
		return err
	}
	deleteAt, err := timeutils.ParseFormatedMillis(out.DeleteAt)
	if err != nil {
		return err
	}

	*scheme = Scheme{
		Id:                        out.Id,
		Name:                      out.Name,
		DisplayName:               out.DisplayName,
		Description:               out.Description,
		CreateAt:                  createAt,
		UpdateAt:                  updateAt,
		DeleteAt:                  deleteAt,
		Scope:                     out.Scope,
		DefaultTeamAdminRole:      out.DefaultTeamAdminRole,
		DefaultTeamUserRole:       out.DefaultTeamUserRole,
		DefaultChannelAdminRole:   out.DefaultChannelAdminRole,
		DefaultChannelUserRole:    out.DefaultChannelUserRole,
		DefaultTeamGuestRole:      out.DefaultTeamGuestRole,
		DefaultChannelGuestRole:   out.DefaultChannelGuestRole,
		DefaultPlaybookAdminRole:  out.DefaultPlaybookAdminRole,
		DefaultPlaybookMemberRole: out.DefaultPlaybookMemberRole,
		DefaultRunAdminRole:       out.DefaultRunAdminRole,
		DefaultRunMemberRole:      out.DefaultRunMemberRole,
	}
	return nil
}

type SchemePatch struct {
	Name        *string `json:"name"`
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
}

func (scheme *SchemePatch) Auditable() map[string]any {
	return map[string]any{
		"name":         scheme.Name,
		"display_name": scheme.DisplayName,
		"description":  scheme.Description,
	}
}

type SchemeIDPatch struct {
	SchemeID *string `json:"scheme_id"`
}

func (p *SchemeIDPatch) Auditable() map[string]any {
	return map[string]any{
		"scheme_id": p.SchemeID,
	}
}

// SchemeConveyor is used for importing and exporting a Scheme and its associated Roles.
type SchemeConveyor struct {
	Name           string  `json:"name"`
	DisplayName    string  `json:"display_name"`
	Description    string  `json:"description"`
	Scope          string  `json:"scope"`
	TeamAdmin      string  `json:"default_team_admin_role"`
	TeamUser       string  `json:"default_team_user_role"`
	TeamGuest      string  `json:"default_team_guest_role"`
	ChannelAdmin   string  `json:"default_channel_admin_role"`
	ChannelUser    string  `json:"default_channel_user_role"`
	ChannelGuest   string  `json:"default_channel_guest_role"`
	PlaybookAdmin  string  `json:"default_playbook_admin_role"`
	PlaybookMember string  `json:"default_playbook_member_role"`
	RunAdmin       string  `json:"default_run_admin_role"`
	RunMember      string  `json:"default_run_member_role"`
	Roles          []*Role `json:"roles"`
}

func (sc *SchemeConveyor) Scheme() *Scheme {
	return &Scheme{
		DisplayName:               sc.DisplayName,
		Name:                      sc.Name,
		Description:               sc.Description,
		Scope:                     sc.Scope,
		DefaultTeamAdminRole:      sc.TeamAdmin,
		DefaultTeamUserRole:       sc.TeamUser,
		DefaultTeamGuestRole:      sc.TeamGuest,
		DefaultChannelAdminRole:   sc.ChannelAdmin,
		DefaultChannelUserRole:    sc.ChannelUser,
		DefaultChannelGuestRole:   sc.ChannelGuest,
		DefaultPlaybookAdminRole:  sc.PlaybookAdmin,
		DefaultPlaybookMemberRole: sc.PlaybookMember,
		DefaultRunAdminRole:       sc.RunAdmin,
		DefaultRunMemberRole:      sc.RunMember,
	}
}

type SchemeRoles struct {
	SchemeAdmin bool `json:"scheme_admin"`
	SchemeUser  bool `json:"scheme_user"`
	SchemeGuest bool `json:"scheme_guest"`
}

func (s *SchemeRoles) Auditable() map[string]any {
	return map[string]any{}
}

func (scheme *Scheme) IsValid() bool {
	if !IsValidId(scheme.Id) {
		return false
	}

	return scheme.IsValidForCreate()
}

func (scheme *Scheme) IsValidForCreate() bool {
	if scheme.DisplayName == "" || len(scheme.DisplayName) > SchemeDisplayNameMaxLength {
		return false
	}

	if !IsValidSchemeName(scheme.Name) {
		return false
	}

	if len(scheme.Description) > SchemeDescriptionMaxLength {
		return false
	}

	switch scheme.Scope {
	case SchemeScopeTeam, SchemeScopeChannel, SchemeScopePlaybook, SchemeScopeRun:
	default:
		return false
	}

	if !IsValidRoleName(scheme.DefaultChannelAdminRole) {
		return false
	}

	if !IsValidRoleName(scheme.DefaultChannelUserRole) {
		return false
	}

	if !IsValidRoleName(scheme.DefaultChannelGuestRole) {
		return false
	}

	if scheme.Scope == SchemeScopeTeam {
		if !IsValidRoleName(scheme.DefaultTeamAdminRole) {
			return false
		}

		if !IsValidRoleName(scheme.DefaultTeamUserRole) {
			return false
		}

		if !IsValidRoleName(scheme.DefaultTeamGuestRole) {
			return false
		}

		if !IsValidRoleName(scheme.DefaultPlaybookAdminRole) {
			return false
		}

		if !IsValidRoleName(scheme.DefaultPlaybookMemberRole) {
			return false
		}

		if !IsValidRoleName(scheme.DefaultRunAdminRole) {
			return false
		}

		if !IsValidRoleName(scheme.DefaultRunMemberRole) {
			return false
		}
	}

	if scheme.Scope == SchemeScopeChannel {
		if scheme.DefaultTeamAdminRole != "" {
			return false
		}

		if scheme.DefaultTeamUserRole != "" {
			return false
		}

		if scheme.DefaultTeamGuestRole != "" {
			return false
		}
	}

	return true
}

func (scheme *Scheme) Patch(patch *SchemePatch) {
	if patch.DisplayName != nil {
		scheme.DisplayName = *patch.DisplayName
	}
	if patch.Name != nil {
		scheme.Name = *patch.Name
	}
	if patch.Description != nil {
		scheme.Description = *patch.Description
	}
}

func IsValidSchemeName(name string) bool {
	re := regexp.MustCompile(fmt.Sprintf("^[a-z0-9_]{2,%d}$", SchemeNameMaxLength))
	return re.MatchString(name)
}
