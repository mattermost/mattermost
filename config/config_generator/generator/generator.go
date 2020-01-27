// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package generator

import (
	"encoding/json"
	"os"

	"github.com/mattermost/mattermost-server/v5/model"
)

// GenerateDefaultConfig writes default config to outputFile.
func GenerateDefaultConfig(outputFile *os.File) error {
	defaultCfg := &model.Config{}
	defaultCfg.SetDefaults()
	if data, err := json.MarshalIndent(defaultCfg, "", "  "); err != nil {
		return err
	} else if _, err := outputFile.Write(data); err != nil {
		return err
	}
	return nil
}
