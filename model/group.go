// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
)

const (
	GroupSourceLdap GroupSource = "ldap"

	GroupNameMaxLength        = 64
	GroupSourceMaxLength      = 64
	GroupDisplayNameMaxLength = 128
	GroupDescriptionMaxLength = 1024
	GroupRemoteIDMaxLength    = 48
)

type GroupSource string

var allGroupSources = []GroupSource{
	GroupSourceLdap,
}

var groupSourcesRequiringRemoteID = []GroupSource{
	GroupSourceLdap,
}

type Group struct {
	Id             string      `json:"id"`
	Name           *string     `json:"name,omitempty"`
	DisplayName    string      `json:"display_name"`
	Description    string      `json:"description"`
	Source         GroupSource `json:"source"`
	RemoteId       string      `json:"remote_id"`
	CreateAt       int64       `json:"create_at"`
	UpdateAt       int64       `json:"update_at"`
	DeleteAt       int64       `json:"delete_at"`
	HasSyncables   bool        `db:"-" json:"has_syncables"`
	MemberCount    *int        `db:"-" json:"member_count,omitempty"`
	AllowReference bool        `json:"allow_reference"`
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

	// FilterParentTeamPermitted filters the groups to the intersect of the
	// set associated to the parent team and those returned by the query.
	// If the parent team is not group-constrained or if NotAssociatedToChannel
	// is not set then this option is ignored.
	FilterParentTeamPermitted bool
}

type PageOpts struct {
	Page    int
	PerPage int
}

type GroupStats struct {
	GroupID          string `json:"group_id"`
	TotalMemberCount int64  `json:"total_member_count"`
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
	err := group.IsValidName()
	if err != nil {
		return err
	}

	if l := len(group.DisplayName); l == 0 || l > GroupDisplayNameMaxLength {
		return NewAppError("Group.IsValidForCreate", "model.group.display_name.app_error", map[string]interface{}{"GroupDisplayNameMaxLength": GroupDisplayNameMaxLength}, "", http.StatusBadRequest)
	}

	if len(group.Description) > GroupDescriptionMaxLength {
		return NewAppError("Group.IsValidForCreate", "model.group.description.app_error", map[string]interface{}{"GroupDescriptionMaxLength": GroupDescriptionMaxLength}, "", http.StatusBadRequest)
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

	if len(group.RemoteId) > GroupRemoteIDMaxLength || (group.RemoteId == "" && group.requiresRemoteId()) {
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
	if err := group.IsValidForCreate(); err != nil {
		return err
	}
	return nil
}

func (group *Group) ToJson() string {
	b, _ := json.Marshal(group)
	return string(b)
}

var validGroupnameChars = regexp.MustCompile(`^[a-z0-9\.\-_]+$`)

func (group *Group) IsValidName() *AppError {

	if group.Name == nil {
		if group.AllowReference {
			return NewAppError("Group.IsValidName", "model.group.name.app_error", map[string]interface{}{"GroupNameMaxLength": GroupNameMaxLength}, "", http.StatusBadRequest)
		}
	} else {
		if l := len(*group.Name); l == 0 || l > GroupNameMaxLength {
			return NewAppError("Group.IsValidName", "model.group.name.invalid_length.app_error", map[string]interface{}{"GroupNameMaxLength": GroupNameMaxLength}, "", http.StatusBadRequest)
		}

		if !validGroupnameChars.MatchString(*group.Name) {
			return NewAppError("Group.IsValidName", "model.group.name.invalid_chars.app_error", nil, "", http.StatusBadRequest)
		}
	}
	return nil
}

func GroupFromJson(data io.Reader) *Group {
	var group *Group
	json.NewDecoder(data).Decode(&group)
	return group
}

func GroupsFromJson(data io.Reader) []*Group {
	var groups []*Group
	json.NewDecoder(data).Decode(&groups)
	return groups
}

func GroupPatchFromJson(data io.Reader) *GroupPatch {
	var groupPatch *GroupPatch
	json.NewDecoder(data).Decode(&groupPatch)
	return groupPatch
}

func GroupStatsFromJson(data io.Reader) *GroupStats {
	var groupStats *GroupStats
	json.NewDecoder(data).Decode(&groupStats)
	return groupStats
}
