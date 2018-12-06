// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/utils"
)

func TestConfigFlag(t *testing.T) {
	th := Setup()
	defer th.TearDown()
	dir := th.TemporaryDirectory()

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

	t.Run("version without a config file should fail", func(t *testing.T) {
		th.SetAutoConfig(false)
		defer th.SetAutoConfig(true)
		require.Error(t, th.RunCommand(t, "version"))
	})

	t.Run("version with varying paths to the config file", func(t *testing.T) {
		th.CheckCommand(t, "--config", filepath.Base(th.ConfigPath()), "version")
		th.CheckCommand(t, "--config", "./"+filepath.Base(th.ConfigPath()), "version")
		th.CheckCommand(t, "version")
	})
}
