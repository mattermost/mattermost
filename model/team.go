// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	TeamOpen                    = "O"
	TeamInvite                  = "I"
	TeamAllowedDomainsMaxLength = 500
	TeamCompanyNameMaxLength    = 64
	TeamDescriptionMaxLength    = 255
	TeamDisplayNameMaxRunes     = 64
	TeamEmailMaxLength          = 128
	TeamNameMaxLength           = 64
	TeamNameMinLength           = 2
)

type Team struct {
	Id                  string  `json:"id"`
	CreateAt            int64   `json:"create_at"`
	UpdateAt            int64   `json:"update_at"`
	DeleteAt            int64   `json:"delete_at"`
	DisplayName         string  `json:"display_name"`
	Name                string  `json:"name"`
	Description         string  `json:"description"`
	Email               string  `json:"email"`
	Type                string  `json:"type"`
	CompanyName         string  `json:"company_name"`
	AllowedDomains      string  `json:"allowed_domains"`
	InviteId            string  `json:"invite_id"`
	AllowOpenInvite     bool    `json:"allow_open_invite"`
	LastTeamIconUpdate  int64   `json:"last_team_icon_update,omitempty"`
	SchemeId            *string `json:"scheme_id"`
	GroupConstrained    *bool   `json:"group_constrained"`
	PolicyID            *string `json:"policy_id"`
	CloudLimitsArchived bool    `json:"cloud_limits_archived"`
}

func (o *Team) Auditable() map[string]any {
	return map[string]any{
		"id":                    o.Id,
		"create_at":             o.CreateAt,
		"update_at":             o.UpdateAt,
		"delete_at":             o.DeleteAt,
		"type":                  o.Type,
		"invite_id":             o.InviteId,
		"allow_open_invite":     o.AllowOpenInvite,
		"scheme_id":             o.SchemeId,
		"group_constrained":     o.GroupConstrained,
		"policy_id":             o.PolicyID,
		"cloud_limits_archived": o.CloudLimitsArchived,
	}
}

type TeamPatch struct {
	DisplayName         *string `json:"display_name"`
	Description         *string `json:"description"`
	CompanyName         *string `json:"company_name"`
	AllowedDomains      *string `json:"allowed_domains"`
	AllowOpenInvite     *bool   `json:"allow_open_invite"`
	GroupConstrained    *bool   `json:"group_constrained"`
	CloudLimitsArchived *bool   `json:"cloud_limits_archived"`
}

type TeamForExport struct {
	Team
	SchemeName *string
}

type Invites struct {
	Invites []map[string]string `json:"invites"`
}

type TeamsWithCount struct {
	Teams      []*Team `json:"teams"`
	TotalCount int64   `json:"total_count"`
}

func (o *Invites) ToEmailList() []string {
	emailList := make([]string, len(o.Invites))
	for _, invite := range o.Invites {
		emailList = append(emailList, invite["email"])
	}
	return emailList
}

func (o *Team) Etag() string {
	return Etag(o.Id, o.UpdateAt)
}

func (o *Team) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("Team.IsValid", "model.team.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("Team.IsValid", "model.team.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Team.IsValid", "model.team.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.Email) > TeamEmailMaxLength {
		return NewAppError("Team.IsValid", "model.team.is_valid.email.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Email != "" && !IsValidEmail(o.Email) {
		return NewAppError("Team.IsValid", "model.team.is_valid.email.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.DisplayName) == 0 || utf8.RuneCountInString(o.DisplayName) > TeamDisplayNameMaxRunes {
		return NewAppError("Team.IsValid", "model.team.is_valid.name.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.Name) > TeamNameMaxLength {
		return NewAppError("Team.IsValid", "model.team.is_valid.url.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.Description) > TeamDescriptionMaxLength {
		return NewAppError("Team.IsValid", "model.team.is_valid.description.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.InviteId == "" {
		return NewAppError("Team.IsValid", "model.team.is_valid.invite_id.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if IsReservedTeamName(o.Name) {
		return NewAppError("Team.IsValid", "model.team.is_valid.reserved.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidTeamName(o.Name) {
		return NewAppError("Team.IsValid", "model.team.is_valid.characters.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !(o.Type == TeamOpen || o.Type == TeamInvite) {
		return NewAppError("Team.IsValid", "model.team.is_valid.type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.CompanyName) > TeamCompanyNameMaxLength {
		return NewAppError("Team.IsValid", "model.team.is_valid.company.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.AllowedDomains) > TeamAllowedDomainsMaxLength {
		return NewAppError("Team.IsValid", "model.team.is_valid.domains.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	return nil
}

func (o *Team) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt

	o.Name = SanitizeUnicode(o.Name)
	o.DisplayName = SanitizeUnicode(o.DisplayName)
	o.Description = SanitizeUnicode(o.Description)
	o.CompanyName = SanitizeUnicode(o.CompanyName)

	if o.InviteId == "" {
		o.InviteId = NewId()
	}
}

func (o *Team) PreUpdate() {
	o.UpdateAt = GetMillis()
	o.Name = SanitizeUnicode(o.Name)
	o.DisplayName = SanitizeUnicode(o.DisplayName)
	o.Description = SanitizeUnicode(o.Description)
	o.CompanyName = SanitizeUnicode(o.CompanyName)
}

func IsReservedTeamName(s string) bool {
	s = strings.ToLower(s)

	for _, value := range reservedName {
		if strings.Index(s, value) == 0 {
			return true
		}
	}

	return false
}

func IsValidTeamName(s string) bool {
	if !isValidAlphaNum(s) {
		return false
	}

	if len(s) < TeamNameMinLength {
		return false
	}

	return true
}

var validTeamNameCharacter = regexp.MustCompile(`^[a-z0-9-]$`)

func CleanTeamName(s string) string {
	s = strings.ToLower(strings.ReplaceAll(s, " ", "-"))

	for _, value := range reservedName {
		if strings.Index(s, value) == 0 {
			s = strings.ReplaceAll(s, value, "")
		}
	}

	s = strings.TrimSpace(s)

	for _, c := range s {
		char := fmt.Sprintf("%c", c)
		if !validTeamNameCharacter.MatchString(char) {
			s = strings.ReplaceAll(s, char, "")
		}
	}

	s = strings.Trim(s, "-")

	if !IsValidTeamName(s) {
		s = NewId()
	}

	return s
}

func (o *Team) Sanitize() {
	o.Email = ""
	o.InviteId = ""
}

func (o *Team) Patch(patch *TeamPatch) {
	if patch.DisplayName != nil {
		o.DisplayName = *patch.DisplayName
	}

	if patch.Description != nil {
		o.Description = *patch.Description
	}

	if patch.CompanyName != nil {
		o.CompanyName = *patch.CompanyName
	}

	if patch.AllowedDomains != nil {
		o.AllowedDomains = *patch.AllowedDomains
	}

	if patch.AllowOpenInvite != nil {
		o.AllowOpenInvite = *patch.AllowOpenInvite
	}

	if patch.GroupConstrained != nil {
		o.GroupConstrained = patch.GroupConstrained
	}

	if patch.CloudLimitsArchived != nil {
		o.CloudLimitsArchived = *patch.CloudLimitsArchived
	}
}

func (o *Team) IsGroupConstrained() bool {
	return o.GroupConstrained != nil && *o.GroupConstrained
}

// ShallowCopy returns a shallow copy of team.
func (o *Team) ShallowCopy() *Team {
	c := *o
	return &c
}

// The following are some GraphQL methods necessary to return the
// data in float64 type. The spec doesn't support 64 bit integers,
// so we have to pass the data in float64. The _ at the end is
// a hack to keep the attribute name same in GraphQL schema.

func (o *Team) CreateAt_() float64 {
	return float64(o.UpdateAt)
}

func (o *Team) UpdateAt_() float64 {
	return float64(o.UpdateAt)
}

func (o *Team) DeleteAt_() float64 {
	return float64(o.DeleteAt)
}

func (o *Team) LastTeamIconUpdate_() float64 {
	return float64(o.LastTeamIconUpdate)
}
