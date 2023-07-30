// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
)

const (
	PushNotifyApple              = "apple"
	PushNotifyAndroid            = "android"
	PushNotifyAppleReactNative   = "apple_rn"
	PushNotifyAndroidReactNative = "android_rn"

	PushTypeMessage     = "message"
	PushTypeClear       = "clear"
	PushTypeUpdateBadge = "update_badge"
	PushTypeSession     = "session"
	PushTypeTest        = "test"
	PushMessageV2       = "v2"

	PushSoundNone = "none"

	// The category is set to handle a set of interactive Actions
	// with the push notifications
	CategoryCanReply = "CAN_REPLY"

	MHPNS = "https://push.mattermost.com"

	PushSendPrepare = "Prepared to send"
	PushSendSuccess = "Successful"
	PushNotSent     = "Not Sent due to preferences"
	PushReceived    = "Received by device"
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
	OverrideIconURL  string `json:"override_icon_url,omitempty"`
	FromWebhook      string `json:"from_webhook,omitempty"`
	Version          string `json:"version,omitempty"`
	IsCRTEnabled     bool   `json:"is_crt_enabled"`
	IsIdLoaded       bool   `json:"is_id_loaded"`
}

func (pn *PushNotification) DeepCopy() *PushNotification {
	pnCopy := *pn
	return &pnCopy
}

func (pn *PushNotification) SetDeviceIdAndPlatform(deviceId string) {
	index := strings.Index(deviceId, ":")

	if index > -1 {
		pn.Platform = deviceId[:index]
		pn.DeviceId = deviceId[index+1:]
	}
}
