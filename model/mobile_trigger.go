// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type MobileTrigger struct {
	PluginId string `json:"id"`
	Location string `json:"location"`
	Trigger  string `json:"trigger"`
	//	Extra    interface{} `json:"extra"`
	Extra string `json:"extra"` // Should use interface{} to be able to create different extras for different locations
}

type MobileTriggerChannelHeader struct {
	DefaultMessage string `json:"default_message"`
}

func (o *MobileTrigger) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func MobileTriggerFromJson(data io.Reader) *MobileTrigger {
	var o *MobileTrigger
	json.NewDecoder(data).Decode(&o)
	return o
}

func MobileTriggerListToJson(l []*MobileTrigger) string {
	b, _ := json.Marshal(l)
	return string(b)
}

func MobileTriggerListFromJson(data io.Reader) []*MobileTrigger {
	var o []*MobileTrigger
	json.NewDecoder(data).Decode(&o)
	return o
}
