// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
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
	Id           string      `json:"id"`
	Name         string      `json:"name"`
	DisplayName  string      `json:"display_name"`
	Description  string      `json:"description"`
	Source       GroupSource `json:"source"`
	RemoteId     string      `json:"remote_id"`
	CreateAt     int64       `json:"create_at"`
	UpdateAt     int64       `json:"update_at"`
	DeleteAt     int64       `json:"delete_at"`
	HasSyncables bool        `db:"-" json:"has_syncables"`
	MemberCount  *int        `db:"-" json:"member_count,omitempty"`
}

type GroupWithSchemeAdmin struct {
	Group
	SchemeAdmin *bool `db:"SyncableSchemeAdmin" json:"scheme_admin,omitempty"`
}

type GroupPatch struct {
	Name        *string `json:"name"`
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
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
	PageOpts               *PageOpts
}

type PageOpts struct {
	Page    int
	PerPage int
}

func (group *Group) Patch(patch *GroupPatch) {
	if patch.Name != nil {
		group.Name = *patch.Name
	}
	if patch.DisplayName != nil {
		group.DisplayName = *patch.DisplayName
	}
	if patch.Description != nil {
		group.Description = *patch.Description
	}
}

func (group *Group) IsValidForCreate() *AppError {
	if l := len(group.Name); l == 0 || l > GroupNameMaxLength {
		return NewAppError("Group.IsValidForCreate", "model.group.name.app_error", map[string]interface{}{"GroupNameMaxLength": GroupNameMaxLength}, "", http.StatusBadRequest)
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

	if len(group.RemoteId) > GroupRemoteIDMaxLength || (len(group.RemoteId) == 0 && group.requiresRemoteId()) {
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
	if len(group.Id) != 26 {
		return NewAppError("Group.IsValidForUpdate", "model.group.id.app_error", nil, "", http.StatusBadRequest)
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
