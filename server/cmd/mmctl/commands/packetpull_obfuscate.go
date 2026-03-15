// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
)

// sanitizeConfigJSON sanitizes sensitive fields in a Mattermost config.json file
// using model.Config.Sanitize(), the same approach used by the server's online
// support packet generation. Returns the sanitized JSON bytes and any error.
func sanitizeConfigJSON(jsonBytes []byte) ([]byte, error) {
	var cfg model.Config
	if err := json.Unmarshal(jsonBytes, &cfg); err != nil {
		return nil, err
	}

	cfg.Sanitize(nil, &model.SanitizeOptions{PartiallyRedactDataSources: true})

	result, err := json.MarshalIndent(cfg, "", "    ")
	if err != nil {
		return nil, err
	}

	return result, nil
}
