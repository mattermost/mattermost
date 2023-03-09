// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package timezones

type Timezones struct {
	supportedZones []string
}

func New() *Timezones {
	timezones := Timezones{}

	timezones.supportedZones = DefaultSupportedTimezones

	return &timezones
}

func (t *Timezones) GetSupported() []string {
	return t.supportedZones
}

func DefaultUserTimezone() map[string]string {
	defaultTimezone := make(map[string]string)
	defaultTimezone["useAutomaticTimezone"] = "true"
	defaultTimezone["automaticTimezone"] = ""
	defaultTimezone["manualTimezone"] = ""

	return defaultTimezone
}
