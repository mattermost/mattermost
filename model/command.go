// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	COMMAND_METHOD_POST = "P"
	COMMAND_METHOD_GET  = "G"
)

type Command struct {
	Id               string `json:"id"`
	Token            string `json:"token"`
	CreateAt         int64  `json:"create_at"`
	UpdateAt         int64  `json:"update_at"`
	DeleteAt         int64  `json:"delete_at"`
	CreatorId        string `json:"creator_id"`
	TeamId           string `json:"team_id"`
	Trigger          string `json:"trigger"`
	Method           string `json:"method"`
	Username         string `json:"username"`
	IconURL          string `json:"icon_url"`
	AutoComplete     bool   `json:"auto_complete"`
	AutoCompleteDesc string `json:"auto_complete_desc"`
	AutoCompleteHint string `json:"auto_complete_hint"`
	DisplayName      string `json:"display_name"`
	URL              string `json:"url"`
}

func (o *Command) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func CommandFromJson(data io.Reader) *Command {
	decoder := json.NewDecoder(data)
	var o Command
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func CommandListToJson(l []*Command) string {
	b, err := json.Marshal(l)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func CommandListFromJson(data io.Reader) []*Command {
	decoder := json.NewDecoder(data)
	var o []*Command
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}

func (o *Command) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("Command.IsValid", "Invalid Id", "")
	}

	if len(o.Token) != 26 {
		return NewAppError("Command.IsValid", "Invalid token", "")
	}

	if o.CreateAt == 0 {
		return NewAppError("Command.IsValid", "Create at must be a valid time", "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Command.IsValid", "Update at must be a valid time", "id="+o.Id)
	}

	if len(o.CreatorId) != 26 {
		return NewAppError("Command.IsValid", "Invalid user id", "")
	}

	if len(o.TeamId) != 26 {
		return NewAppError("Command.IsValid", "Invalid team id", "")
	}

	if len(o.Trigger) > 1024 {
		return NewAppError("Command.IsValid", "Invalid trigger", "")
	}

	if len(o.URL) == 0 || len(o.URL) > 1024 {
		return NewAppError("Command.IsValid", "Invalid url", "")
	}

	if !IsValidHttpUrl(o.URL) {
		return NewAppError("Command.IsValid", "Invalid URL. Must be a valid URL and start with http:// or https://", "")
	}

	if !(o.Method == COMMAND_METHOD_GET || o.Method == COMMAND_METHOD_POST) {
		return NewAppError("Command.IsValid", "Invalid Method", "")
	}

	return nil
}

func (o *Command) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.Token == "" {
		o.Token = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
}

func (o *Command) PreUpdate() {
	o.UpdateAt = GetMillis()
}

func (o *Command) Sanatize() {
	o.Token = ""
	o.CreatorId = ""
	o.Method = ""
	o.URL = ""
	o.Username = ""
	o.IconURL = ""
}
