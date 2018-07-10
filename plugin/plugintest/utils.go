// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugintest

import (
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest/mock"
	"github.com/stretchr/testify/require"
)

func CompileGo(t *testing.T, sourceCode, outputPath string) {
	dir, err := ioutil.TempDir(".", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)
	require.NoError(t, ioutil.WriteFile(filepath.Join(dir, "main.go"), []byte(sourceCode), 0600))
	cmd := exec.Command("go", "build", "-o", outputPath, "main.go")
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	require.NoError(t, cmd.Run())
}

func RunTestWithSupervisor(t *testing.T, pluginCode string, pluginManifest string, test func(t *testing.T, supervisor *plugin.Supervisor, mockAPI *API)) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	CompileGo(t, pluginCode, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(pluginManifest), 0600)

	bundle := model.BundleInfoForPath(dir)
	var api API
	api.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})
	supervisor, err := plugin.NewSupervisor(bundle, log, &api)
	require.NoError(t, err)

	if test != nil {
		test(t, supervisor, &api)
	}

	supervisor.Shutdown()
}
