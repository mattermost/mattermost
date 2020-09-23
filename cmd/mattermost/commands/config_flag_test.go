// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

func TestConfigFlag(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	dir := th.TemporaryDirectory()

	i18n, ok := fileutils.FindDir("i18n")
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
