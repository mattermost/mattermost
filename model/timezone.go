// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

func TimezonesToJson(timezoneList []string) string {
	b, _ := json.Marshal(timezoneList)
	return string(b)
}

func TimezonesFromJson(data io.Reader) SupportedTimezones {
	var timezones SupportedTimezones
	json.NewDecoder(data).Decode(&timezones)
	return timezones
}

func DefaultUserTimezone() map[string]string {
	defaultTimezone := make(map[string]string)
	defaultTimezone["useAutomaticTimezone"] = "true"
	defaultTimezone["automaticTimezone"] = ""
	defaultTimezone["manualTimezone"] = ""

	return defaultTimezone
}
