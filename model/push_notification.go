// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
)

const (
	PUSH_NOTIFY_APPLE   = "apple"
	PUSH_NOTIFY_ANDROID = "android"

	PUSH_TYPE_MESSAGE = "message"
	PUSH_TYPE_CLEAR   = "clear"

	CATEGORY_DM = "DIRECT_MESSAGE"

	MHPNS = "https://push.mattermost.com"
)

type PushNotification struct {
	Platform         string `json:"platform"`
	ServerId         string `json:"server_id"`
	DeviceId         string `json:"device_id"`
	Category         string `json:"category"`
	Sound            string `json:"sound"`
	Message          string `json:"message"`
	Badge            int    `json:"badge"`
	ContentAvailable int    `json:"cont_ava"`
	ChannelId        string `json:"channel_id"`
	ChannelName      string `json:"channel_name"`
	Type             string `json:"type"`
}

func (me *PushNotification) ToJson() string {
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (me *PushNotification) SetDeviceIdAndPlatform(deviceId string) {
	if strings.HasPrefix(deviceId, PUSH_NOTIFY_APPLE+":") {
		me.Platform = PUSH_NOTIFY_APPLE
		me.DeviceId = strings.TrimPrefix(deviceId, PUSH_NOTIFY_APPLE+":")
	} else if strings.HasPrefix(deviceId, PUSH_NOTIFY_ANDROID+":") {
		me.Platform = PUSH_NOTIFY_ANDROID
		me.DeviceId = strings.TrimPrefix(deviceId, PUSH_NOTIFY_ANDROID+":")
	}
}

func PushNotificationFromJson(data io.Reader) *PushNotification {
	decoder := json.NewDecoder(data)
	var me PushNotification
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	} else {
		return nil
	}
}
