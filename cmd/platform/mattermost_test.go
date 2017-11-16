// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/utils"
)

func TestConfigFlag(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	utils.TranslationsPreInit()
	config := utils.LoadGlobalConfig("config.json")
	configPath := filepath.Join(dir, "foo.json")
	require.NoError(t, ioutil.WriteFile(configPath, []byte(config.ToJson()), 0600))

	os.Mkdir(filepath.Join(dir, "i18n"), 0700)
	i18n, ok := utils.FindDir("i18n")
	require.True(t, ok)
	en, err := os.Open(filepath.Join(i18n, "en.json"))
	require.NoError(t, err)
	defer en.Close()
	dest, err := os.OpenFile(filepath.Join(dir, "i18n", "en.json"), os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	require.NoError(t, err)
	defer dest.Close()
	_, err = io.Copy(dest, en)
	require.NoError(t, err)

	prevDir, err := os.Getwd()
	require.NoError(t, err)
	defer os.Chdir(prevDir)
	os.Chdir(dir)

	require.Error(t, runCommand(t, "version"))
	checkCommand(t, "--config", "foo.json", "version")
	checkCommand(t, "--config", "./foo.json", "version")
	checkCommand(t, "--config", configPath, "version")
}
