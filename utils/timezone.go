// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"encoding/json"
	"io/ioutil"

	"github.com/mattermost/mattermost-server/model"
)

func LoadTimezones(fileName string) model.SupportedTimezones {
	var supportedTimezones model.SupportedTimezones

	if timezoneFile := FindConfigFile(fileName); timezoneFile == "" {
		return model.DefaultSupportedTimezones
	} else if raw, err := ioutil.ReadFile(timezoneFile); err != nil {
		return model.DefaultSupportedTimezones
	} else if err := json.Unmarshal(raw, &supportedTimezones); err != nil {
		return model.DefaultSupportedTimezones
	} else {
		return supportedTimezones
	}
}
