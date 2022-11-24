// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"regexp"
)

const (
	GroupSourceLdap   GroupSource = "ldap"
	GroupSourceCustom GroupSource = "custom"

	GroupNameMaxLength        = 64
	GroupSourceMaxLength      = 64
	GroupDisplayNameMaxLength = 128
	GroupDescriptionMaxLength = 1024
	GroupRemoteIDMaxLength    = 48
)

type GroupSource string

var allGroupSources = []GroupSource{
	GroupSourceLdap,
	GroupSourceCustom,
}

var groupSourcesRequiringRemoteID = []GroupSource{
	GroupSourceLdap,
}

type Group struct {
	Id                          string      `json:"id"`
	Name                        *string     `json:"name,omitempty"`
	DisplayName                 string      `json:"display_name"`
	Description                 string      `json:"description"`
	Source                      GroupSource `json:"source"`
	RemoteId                    *string     `json:"remote_id"`
	CreateAt                    int64       `json:"create_at"`
	UpdateAt                    int64       `json:"update_at"`
	DeleteAt                    int64       `json:"delete_at"`
	HasSyncables                bool        `db:"-" json:"has_syncables"`
	MemberCount                 *int        `db:"-" json:"member_count,omitempty"`
	AllowReference              bool        `json:"allow_reference"`
	ChannelMemberCount          *int        `db:"-" json:"channel_member_count,omitempty"`
	ChannelMemberTimezonesCount *int        `db:"-" json:"channel_member_timezones_count,omitempty"`
}

func (group *Group) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":              group.Id,
		"source":          group.Source,
		"remote_id":       group.RemoteId,
		"create_at":       group.CreateAt,
		"update_at":       group.UpdateAt,
		"delete_at":       group.DeleteAt,
		"has_syncables":   group.HasSyncables,
		"member_count":    group.MemberCount,
		"allow_reference": group.AllowReference,
	}
}

type GroupWithUserIds struct {
	Group
	UserIds []string `json:"user_ids"`
}

type GroupWithSchemeAdmin struct {
	Group
	SchemeAdmin *bool `db:"SyncableSchemeAdmin" json:"scheme_admin,omitempty"`
}

type GroupsAssociatedToChannelWithSchemeAdmin struct {
	ChannelId string `json:"channel_id"`
	Group
	SchemeAdmin *bool `db:"SyncableSchemeAdmin" json:"scheme_admin,omitempty"`
}
type GroupsAssociatedToChannel struct {
	ChannelId string                  `json:"channel_id"`
	Groups    []*GroupWithSchemeAdmin `json:"groups"`
}

type GroupPatch struct {
	Name           *string `json:"name"`
	DisplayName    *string `json:"display_name"`
	Description    *string `json:"description"`
	AllowReference *bool   `json:"allow_reference"`
	// For security reasons (including preventing unintended LDAP group synchronization) do no allow a Group's RemoteId or Source field to be
	// included in patches.
}

type LdapGroupSearchOpts struct {
	Q            string
	IsLinked     *bool
	IsConfigured *bool
}

type GroupSearchOpts struct {
	Q                      string
	NotAssociatedToTeam    string
	NotAssociatedToChannel string
	IncludeMemberCount     bool
	FilterAllowReference   bool
	PageOpts               *PageOpts
	Since                  int64
	Source                 GroupSource

	// FilterParentTeamPermitted filters the groups to the intersect of the
	// set associated to the parent team and those returned by the query.
	// If the parent team is not group-constrained or if NotAssociatedToChannel
	// is not set then this option is ignored.
	FilterParentTeamPermitted bool

	// FilterHasMember filters the groups to the intersect of the
	// set returned by the query and those that have the given user as a member.
	FilterHasMember string

	IncludeChannelMemberCount string
	IncludeTimezones          bool
}

type GetGroupOpts struct {
	IncludeMemberCount bool
}

type PageOpts struct {
	Page    int
	PerPage int
}

type GroupStats struct {
	GroupID          string `json:"group_id"`
	TotalMemberCount int64  `json:"total_member_count"`
}

type GroupModifyMembers struct {
	UserIds []string `json:"user_ids"`
}

func (group *Group) Patch(patch *GroupPatch) {
	if patch.Name != nil {
		group.Name = patch.Name
	}
	if patch.DisplayName != nil {
		group.DisplayName = *patch.DisplayName
	}
	if patch.Description != nil {
		group.Description = *patch.Description
	}
	if patch.AllowReference != nil {
		group.AllowReference = *patch.AllowReference
	}
}

func (group *Group) IsValidForCreate() *AppError {
	appErr := group.IsValidName()
	if appErr != nil {
		return appErr
	}

	if l := len(group.DisplayName); l == 0 || l > GroupDisplayNameMaxLength {
		return NewAppError("Group.IsValidForCreate", "model.group.display_name.app_error", map[string]any{"GroupDisplayNameMaxLength": GroupDisplayNameMaxLength}, "", http.StatusBadRequest)
	}

	if len(group.Description) > GroupDescriptionMaxLength {
		return NewAppError("Group.IsValidForCreate", "model.group.description.app_error", map[string]any{"GroupDescriptionMaxLength": GroupDescriptionMaxLength}, "", http.StatusBadRequest)
	}

	isValidSource := false
	for _, groupSource := range allGroupSources {
		if group.Source == groupSource {
			isValidSource = true
			break
		}
	}
	if !isValidSource {
		return NewAppError("Group.IsValidForCreate", "model.group.source.app_error", nil, "", http.StatusBadRequest)
	}

	if (group.GetRemoteId() == "" && group.requiresRemoteId()) || len(group.GetRemoteId()) > GroupRemoteIDMaxLength {
		return NewAppError("Group.IsValidForCreate", "model.group.remote_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (group *Group) requiresRemoteId() bool {
	for _, groupSource := range groupSourcesRequiringRemoteID {
		if groupSource == group.Source {
			return true
		}
	}
	return false
}

func (group *Group) IsValidForUpdate() *AppError {
	if !IsValidId(group.Id) {
		return NewAppError("Group.IsValidForUpdate", "app.group.id.app_error", nil, "", http.StatusBadRequest)
	}
	if group.CreateAt == 0 {
		return NewAppError("Group.IsValidForUpdate", "model.group.create_at.app_error", nil, "", http.StatusBadRequest)
	}
	if group.UpdateAt == 0 {
		return NewAppError("Group.IsValidForUpdate", "model.group.update_at.app_error", nil, "", http.StatusBadRequest)
	}
	if appErr := group.IsValidForCreate(); appErr != nil {
		return appErr
	}
	return nil
}

var validGroupnameChars = regexp.MustCompile(`^[a-z0-9\.\-_]+$`)

func (group *Group) IsValidName() *AppError {

	if group.Name == nil {
		if group.AllowReference {
			return NewAppError("Group.IsValidName", "model.group.name.app_error", map[string]any{"GroupNameMaxLength": GroupNameMaxLength}, "", http.StatusBadRequest)
		}
	} else {
		if l := len(*group.Name); l == 0 || l > GroupNameMaxLength {
			return NewAppError("Group.IsValidName", "model.group.name.invalid_length.app_error", map[string]any{"GroupNameMaxLength": GroupNameMaxLength}, "", http.StatusBadRequest)
		}

		if *group.Name == UserNotifyAll || *group.Name == ChannelMentionsNotifyProp || *group.Name == UserNotifyHere {
			return NewAppError("IsValidName", "model.group.name.reserved_name.app_error", nil, "", http.StatusBadRequest)
		}

		if !validGroupnameChars.MatchString(*group.Name) {
			return NewAppError("Group.IsValidName", "model.group.name.invalid_chars.app_error", nil, "", http.StatusBadRequest)
		}
	}
	return nil
}

func (group *Group) GetName() string {
	if group.Name == nil {
		return ""
	}
	return *group.Name
}

func (group *Group) GetRemoteId() string {
	if group.RemoteId == nil {
		return ""
	}
	return *group.RemoteId
}

type GroupsWithCount struct {
	Groups     []*Group `json:"groups"`
	TotalCount int64    `json:"total_count"`
}

type CreateDefaultMembershipParams struct {
	Since               int64
	ReAddRemovedMembers bool
	ScopedUserID        *string
	ScopedTeamID        *string
	ScopedChannelID     *string
}
