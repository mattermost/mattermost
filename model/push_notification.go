// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"io"
	"strings"
)

const (
	PUSH_NOTIFY_APPLE                = "apple"
	PUSH_NOTIFY_ANDROID              = "android"
	PUSH_NOTIFY_APPLE_REACT_NATIVE   = "apple_rn"
	PUSH_NOTIFY_ANDROID_REACT_NATIVE = "android_rn"

	PUSH_TYPE_MESSAGE      = "message"
	PUSH_TYPE_CLEAR        = "clear"
	PUSH_TYPE_UPDATE_BADGE = "update_badge"
	PUSH_MESSAGE_V2        = "v2"

	PUSH_SOUND_NONE = "none"

	// The category is set to handle a set of interactive Actions
	// with the push notifications
	CATEGORY_CAN_REPLY = "CAN_REPLY"

	MHPNS = "https://push.mattermost.com"

	PUSH_SEND_PREPARE = "Prepared to send"
	PUSH_SEND_SUCCESS = "Successful"
	PUSH_NOT_SENT     = "Not Sent due to preferences"
	PUSH_RECEIVED     = "Received by device"
)

type PushNotificationAck struct {
	Id               string `json:"id"`
	ClientReceivedAt int64  `json:"received_at"`
	ClientPlatform   string `json:"platform"`
	NotificationType string `json:"type"`
	PostId           string `json:"post_id,omitempty"`
	IsIdLoaded       bool   `json:"is_id_loaded"`
}

type PushNotification struct {
	AckId            string `json:"ack_id"`
	Platform         string `json:"platform"`
	ServerId         string `json:"server_id"`
	DeviceId         string `json:"device_id"`
	PostId           string `json:"post_id"`
	Category         string `json:"category,omitempty"`
	Sound            string `json:"sound,omitempty"`
	Message          string `json:"message,omitempty"`
	Badge            int    `json:"badge,omitempty"`
	ContentAvailable int    `json:"cont_ava,omitempty"`
	TeamId           string `json:"team_id,omitempty"`
	ChannelId        string `json:"channel_id,omitempty"`
	RootId           string `json:"root_id,omitempty"`
	ChannelName      string `json:"channel_name,omitempty"`
	Type             string `json:"type,omitempty"`
	SenderId         string `json:"sender_id,omitempty"`
	SenderName       string `json:"sender_name,omitempty"`
	OverrideUsername string `json:"override_username,omitempty"`
	OverrideIconUrl  string `json:"override_icon_url,omitempty"`
	FromWebhook      string `json:"from_webhook,omitempty"`
	Version          string `json:"version,omitempty"`
	IsIdLoaded       bool   `json:"is_id_loaded"`
}

func (me *PushNotification) ToJson() string {
	b, _ := json.Marshal(me)
	return string(b)
}

func (me *PushNotification) SetDeviceIdAndPlatform(deviceId string) {

	index := strings.Index(deviceId, ":")

	if index > -1 {
		me.Platform = deviceId[:index]
		me.DeviceId = deviceId[index+1:]
	}
}

func PushNotificationFromJson(data io.Reader) (*PushNotification, error) {
	if data == nil {
		return nil, errors.New("push notification data can't be nil")
	}
	var me *PushNotification
	if err := json.NewDecoder(data).Decode(&me); err != nil {
		return nil, err
	}
	return me, nil
}

func PushNotificationAckFromJson(data io.Reader) (*PushNotificationAck, error) {
	if data == nil {
		return nil, errors.New("push notification data can't be nil")
	}
	var ack *PushNotificationAck
	if err := json.NewDecoder(data).Decode(&ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func (ack *PushNotificationAck) ToJson() string {
	b, _ := json.Marshal(ack)
	return string(b)
}
