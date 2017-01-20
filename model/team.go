// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	TEAM_OPEN   = "O"
	TEAM_INVITE = "I"
)

type Team struct {
	Id              string `json:"id"`
	CreateAt        int64  `json:"create_at"`
	UpdateAt        int64  `json:"update_at"`
	DeleteAt        int64  `json:"delete_at"`
	DisplayName     string `json:"display_name"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	Email           string `json:"email"`
	Type            string `json:"type"`
	CompanyName     string `json:"company_name"`
	AllowedDomains  string `json:"allowed_domains"`
	InviteId        string `json:"invite_id"`
	AllowOpenInvite bool   `json:"allow_open_invite"`
}

type Invites struct {
	Invites []map[string]string `json:"invites"`
}

func InvitesFromJson(data io.Reader) *Invites {
	decoder := json.NewDecoder(data)
	var o Invites
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Invites) ToEmailList() []string {
	emailList := make([]string, len(o.Invites))
	for _, invite := range o.Invites {
		emailList = append(emailList, invite["email"])
	}
	return emailList
}

func (o *Invites) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *Team) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func TeamFromJson(data io.Reader) *Team {
	decoder := json.NewDecoder(data)
	var o Team
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func TeamMapToJson(u map[string]*Team) string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func TeamMapFromJson(data io.Reader) map[string]*Team {
	decoder := json.NewDecoder(data)
	var teams map[string]*Team
	err := decoder.Decode(&teams)
	if err == nil {
		return teams
	} else {
		return nil
	}
}

func (o *Team) Etag() string {
	return Etag(o.Id, o.UpdateAt)
}

func (o *Team) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.id.app_error", nil, "")
	}

	if o.CreateAt == 0 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.create_at.app_error", nil, "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.update_at.app_error", nil, "id="+o.Id)
	}

	if len(o.Email) > 128 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.email.app_error", nil, "id="+o.Id)
	}

	if len(o.Email) > 0 && !IsValidEmail(o.Email) {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.email.app_error", nil, "id="+o.Id)
	}

	if utf8.RuneCountInString(o.DisplayName) == 0 || utf8.RuneCountInString(o.DisplayName) > 64 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.name.app_error", nil, "id="+o.Id)
	}

	if len(o.Name) > 64 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.url.app_error", nil, "id="+o.Id)
	}

	if len(o.Description) > 255 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.description.app_error", nil, "id="+o.Id)
	}

	if IsReservedTeamName(o.Name) {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.reserved.app_error", nil, "id="+o.Id)
	}

	if !IsValidTeamName(o.Name) {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.characters.app_error", nil, "id="+o.Id)
	}

	if !(o.Type == TEAM_OPEN || o.Type == TEAM_INVITE) {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.type.app_error", nil, "id="+o.Id)
	}

	if len(o.CompanyName) > 64 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.company.app_error", nil, "id="+o.Id)
	}

	if len(o.AllowedDomains) > 500 {
		return NewLocAppError("Team.IsValid", "model.team.is_valid.domains.app_error", nil, "id="+o.Id)
	}

	return nil
}

func (o *Team) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt

	if len(o.InviteId) == 0 {
		o.InviteId = NewId()
	}
}

func (o *Team) PreUpdate() {
	o.UpdateAt = GetMillis()
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

	if !IsValidAlphaNum(s, false) {
		return false
	}

	if len(s) <= 1 {
		return false
	}

	return true
}

var validTeamNameCharacter = regexp.MustCompile(`^[a-z0-9-]$`)

func CleanTeamName(s string) string {
	s = strings.ToLower(strings.Replace(s, " ", "-", -1))

	for _, value := range reservedName {
		if strings.Index(s, value) == 0 {
			s = strings.Replace(s, value, "", -1)
		}
	}

	s = strings.TrimSpace(s)

	for _, c := range s {
		char := fmt.Sprintf("%c", c)
		if !validTeamNameCharacter.MatchString(char) {
			s = strings.Replace(s, char, "", -1)
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
	o.AllowedDomains = ""
}

func (o *Team) SanitizeForNotLoggedIn() {
	o.Email = ""
	o.AllowedDomains = ""
	o.CompanyName = ""
	if !o.AllowOpenInvite {
		o.InviteId = ""
	}
}
