// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"encoding/json"
	"io/ioutil"

	"github.com/mattermost/mattermost-server/model"
)

func LoadTimezones(fileName string) (model.SupportedTimezones, *model.AppError) {
	var supportedTimezones model.SupportedTimezones

	if timezoneFile := FindConfigFile(fileName); timezoneFile == "" {
		return nil, model.NewAppError("LoadTimezones", "app.timezones.load_config.app_error", map[string]interface{}{"Filename": fileName}, "", 0)
	} else if raw, err := ioutil.ReadFile(timezoneFile); err != nil {
		return nil, model.NewAppError("LoadTimezones", "app.timezones.read_config.app_error", map[string]interface{}{"Filename": fileName, " ": err.Error()}, "", 0)
	} else if err := json.Unmarshal(raw, &supportedTimezones); err != nil {
		return nil, model.NewAppError("LoadTimezones", "app.timezones.failed_deserialize.app_error", map[string]interface{}{"Filename": fileName, "Error": err.Error()}, "", 0)
	} else {
		return supportedTimezones, nil
	}
}
