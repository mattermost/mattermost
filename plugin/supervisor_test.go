// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSupervisor(t *testing.T) {
	for name, f := range map[string]func(*testing.T){
		"Supervisor_InvalidExecutablePath":     testSupervisor_InvalidExecutablePath,
		"Supervisor_NonExistentExecutablePath": testSupervisor_NonExistentExecutablePath,
		"Supervisor_StartTimeout":              testSupervisor_StartTimeout,
	} {
		t.Run(name, f)
	}
}

func compileGo(t *testing.T, sourceCode, outputPath string) {
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

func testSupervisor_InvalidExecutablePath(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "/foo/../../backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})
	supervisor, err := newSupervisor(bundle, log, nil)
	assert.Nil(t, supervisor)
	assert.Error(t, err)
}

func testSupervisor_NonExistentExecutablePath(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "thisfileshouldnotexist"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})
	supervisor, err := newSupervisor(bundle, log, nil)
	require.Error(t, err)
	require.Nil(t, supervisor)
}

// If plugin development goes really wrong, let's make sure plugin activation won't block forever.
func testSupervisor_StartTimeout(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	compileGo(t, `
		package main

		func main() {
			for {
			}
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})
	supervisor, err := newSupervisor(bundle, log, nil)
	require.Error(t, err)
	require.Nil(t, supervisor)
}
