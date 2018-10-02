// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type GroupType string

type GroupTypes []GroupType

func (gts *GroupTypes) String() string {
	gtStrs := []string{}
	for _, gt := range *gts {
		gtStrs = append(gtStrs, string(gt))
	}
	return strings.Join(gtStrs, ",")
}

var groupTypes = GroupTypes{
	GroupTypeLdap,
}

const (
	GroupTypeLdap GroupType = "ldap"

	GroupNameMaxLength        = 64
	GroupTypeMaxLength        = 64
	GroupDisplayNameMaxLength = 128
	GroupDescriptionMaxLength = 1024
	GroupRemoteIDMaxLength    = 2048
)

var groupTypesRequiringRemoteID = []GroupType{
	GroupTypeLdap,
}

type Group struct {
	Id          string    `json:"id"`
	Name        string    `json:"name"`
	DisplayName string    `json:"display_name"`
	Description string    `json:"description"`
	Type        GroupType `json:"type"`
	RemoteId    string    `json:"remote_id"`
	CreateAt    int64     `json:"create_at"`
	UpdateAt    int64     `json:"update_at"`
	DeleteAt    int64     `json:"delete_at"`
}

type GroupPatch struct {
	Name        *string `json:"name"`
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
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

	isValidType := false
	for _, groupType := range groupTypes {
		if group.Type == groupType {
			isValidType = true
			break
		}
	}
	if !isValidType {
		return NewAppError("Group.IsValidForCreate", "model.group.type.app_error", map[string]interface{}{"ValidGroupTypes": groupTypes.String()}, "", http.StatusBadRequest)
	}

	if len(group.RemoteId) > GroupRemoteIDMaxLength || len(group.RemoteId) == 0 && group.RequiresRemoteId() {
		return NewAppError("Group.IsValidForCreate", "model.group.remote_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (group *Group) RequiresRemoteId() bool {
	for _, groupType := range groupTypesRequiringRemoteID {
		if groupType == group.Type {
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
		return NewAppError("Group.IsValidForCreate", "model.group.create_at.app_error", nil, "", http.StatusBadRequest)
	}
	if group.UpdateAt == 0 {
		return NewAppError("Group.IsValidForCreate", "model.group.update_at.app_error", nil, "", http.StatusBadRequest)
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

func GroupPatchFromJson(data io.Reader) *GroupPatch {
	var groupPatch *GroupPatch
	json.NewDecoder(data).Decode(&groupPatch)
	return groupPatch
}
