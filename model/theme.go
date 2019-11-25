// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type Theme struct {
	Id          string `json:"id" mapstructure:"id"`
	CreateAt    int64  `json:"create_at" mapstructure:"create_at"`
	UpdateAt    int64  `json:"update_at" mapstructure:"update_at"`
	DisplayName string `json:"display_name" mapstructure:"display_name"`

	SidebarBackground          string `json:"sidebarBg" mapstructure:"sidebarBg"`
	SidebarText                string `json:"sidebarText" mapstructure:"sidebarText"`
	SidebarUnreadText          string `json:"sidebarUnreadText" mapstructure:"sidebarUnreadText"`
	SidebarTextHoverBackground string `json:"sidebarTextHoverBg" mapstructure:"sidebarTextHoverBg"`
	SidebarTextActiveBorder    string `json:"sidebarTextActiveBorder" mapstructure:"sidebarTextActiveBorder"`
	SidebarTextActiveColor     string `json:"sidebarTextActiveColor" mapstructure:"sidebarTextActiveColor"`
	SidebarHeaderBackground    string `json:"sidebarHeaderBg" mapstructure:"sidebarHeaderBg"`
	SidebarHeaderTextColor     string `json:"sidebarHeaderTextColor" mapstructure:"sidebarHeaderTextColor"`
	OnlineIndicator            string `json:"onlineIndicator" mapstructure:"onlineIndicator"`
	AwayIndicator              string `json:"awayIndicator" mapstructure:"awayIndicator"`
	DndIndicator               string `json:"dndIndicator" mapstructure:"dndIndicator"`
	MentionBackground          string `json:"mentionBg" mapstructure:"mentionBg"`
	MentionColor               string `json:"mentionColor" mapstructure:"mentionColor"`
	CenterChannelBackground    string `json:"centerChannelBg" mapstructure:"centerChannelBg"`
	CenterChannelColor         string `json:"centerChannelColor" mapstructure:"centerChannelColor"`
	NewMessageSeparator        string `json:"newMessageSeparator" mapstructure:"newMessageSeparator"`
	LinkColor                  string `json:"linkColor" mapstructure:"linkColor"`
	ButtonBackground           string `json:"buttonBg" mapstructure:"buttonBg"`
	ButtonColor                string `json:"buttonColor" mapstructure:"buttonColor"`
	ErrorTextColor             string `json:"errorTextColor" mapstructure:"errorTextColor"`
	MentionHighlightBackground string `json:"mentionHighlightBg" mapstructure:"mentionHighlightBg"`
	MentionHighlightLink       string `json:"mentionHighlightLink" mapstructure:"mentionHighlightLink"`
	CodeTheme                  string `json:"codeTheme" mapstructure:"codeTheme"`
}

func (t *Theme) PreSave() {
	if t.Id == "" {
		t.Id = NewId()
	}

	if t.CreateAt == 0 {
		t.CreateAt = GetMillis()
	}

	t.UpdateAt = GetMillis()
}

func (t *Theme) ToJson() string {
	b, _ := json.Marshal(t)
	return string(b)
}

func ThemeFromJson(data io.Reader) *Theme {
	var t *Theme
	json.NewDecoder(data).Decode(&t)
	return t
}
