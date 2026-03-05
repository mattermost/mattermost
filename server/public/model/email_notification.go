// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type EmailNotificationContent struct {
	Subject     string `json:"subject,omitempty"`
	Title       string `json:"title,omitempty"`
	SubTitle    string `json:"subtitle,omitempty"`
	MessageHTML string `json:"message_html,omitempty"`
	MessageText string `json:"message_text,omitempty"`
	ButtonText  string `json:"button_text,omitempty"`
	ButtonURL   string `json:"button_url,omitempty"`
	FooterText  string `json:"footer_text,omitempty"`
}

type EmailNotification struct {
	PostId            string `json:"post_id"`
	ChannelId         string `json:"channel_id"`
	TeamId            string `json:"team_id"`
	SenderId          string `json:"sender_id"`
	SenderDisplayName string `json:"sender_display_name,omitempty"`
	RecipientId       string `json:"recipient_id"`
	RootId            string `json:"root_id,omitempty"`

	ChannelType     string `json:"channel_type"`
	ChannelName     string `json:"channel_name"`
	TeamName        string `json:"team_name"`
	SenderUsername  string `json:"sender_username"`
	IsDirectMessage bool   `json:"is_direct_message"`
	IsGroupMessage  bool   `json:"is_group_message"`
	IsThreadReply   bool   `json:"is_thread_reply"`
	IsCRTEnabled    bool   `json:"is_crt_enabled"`
	UseMilitaryTime bool   `json:"use_military_time"`

	EmailNotificationContent
}
