// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package timezones

import (
	"encoding/json"
	"io/ioutil"
	"sync/atomic"

	"github.com/mattermost/mattermost-server/utils/fileutils"
)

type Timezones struct {
	supportedZones atomic.Value
}

func New(timezonesConfigFile string) *Timezones {
	timezones := Timezones{}

	if len(timezonesConfigFile) == 0 {
		timezonesConfigFile = "timezones.json"
	}

	var supportedTimezones []string

	// Attempt to get timezones from config. Failure results in defaults.
	if timezoneFile := fileutils.FindConfigFile(timezonesConfigFile); timezoneFile == "" {
		supportedTimezones = DefaultSupportedTimezones
	} else if raw, err := ioutil.ReadFile(timezoneFile); err != nil {
		supportedTimezones = DefaultSupportedTimezones
	} else if err := json.Unmarshal(raw, &supportedTimezones); err != nil {
		supportedTimezones = DefaultSupportedTimezones
	}

	timezones.supportedZones.Store(supportedTimezones)

	return &timezones
}

func (t *Timezones) GetSupported() []string {
	if supportedZonesValue := t.supportedZones.Load(); supportedZonesValue != nil {
		return supportedZonesValue.([]string)
	}
	return []string{}
}

func DefaultUserTimezone() map[string]string {
	defaultTimezone := make(map[string]string)
	defaultTimezone["useAutomaticTimezone"] = "true"
	defaultTimezone["automaticTimezone"] = ""
	defaultTimezone["manualTimezone"] = ""

	return defaultTimezone
}
