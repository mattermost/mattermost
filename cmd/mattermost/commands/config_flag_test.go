// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"encoding/json"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestConfigFlag(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	utils.TranslationsPreInit()

	config := &model.Config{}
	config.SetDefaults()
	configFilePath, cleanup := makeConfigFile(config)
	defer cleanup()

	timezones := utils.LoadTimezones("timezones.json")
	tzConfigPath := filepath.Join(dir, "timezones.json")
	timezoneData, _ := json.Marshal(timezones)
	require.NoError(t, ioutil.WriteFile(tzConfigPath, timezoneData, 0600))

	i18n, ok := utils.FindDir("i18n")
	require.True(t, ok)
	require.NoError(t, utils.CopyDir(i18n, filepath.Join(dir, "i18n")))

	prevDir, err := os.Getwd()
	require.NoError(t, err)
	defer os.Chdir(prevDir)
	os.Chdir(dir)

	require.Error(t, RunCommand(t, "version"))
	CheckCommand(t, "--config", "foo.json", "version")
	CheckCommand(t, "--config", "./foo.json", "version")
	CheckCommand(t, "--config", configFilePath, "version")
}
