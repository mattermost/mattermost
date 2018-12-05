// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

var coverprofileCounters map[string]int = make(map[string]int)

// makeConfigFile creates a default configuration and applies the current test database settings.
// Returns the path to the resulting file and a cleanup function to be called when testing is complete.
func makeConfigFile(config *model.Config) (configFilePath string, cleanup func()) {
	if config == nil {
		config = &model.Config{}
		config.SetDefaults()
	}

	config.SqlSettings = *mainHelper.Settings

	dir, err := ioutil.TempDir("", "")
	if err != nil {
		panic("failed to create temporary directory: " + err.Error())
	}

	configFilePath = filepath.Join(dir, "config.json")
	if err := ioutil.WriteFile(configFilePath, []byte(config.ToJson()), 0600); err != nil {
		os.RemoveAll(dir)
		panic("failed to write file " + configFilePath + ": " + err.Error())
	}

	return configFilePath, func() {
		os.RemoveAll(dir)
	}
}

func execArgs(t *testing.T, args []string) ([]string, func()) {
	ret := []string{"-test.v", "-test.run", "ExecCommand"}
	if coverprofile := flag.Lookup("test.coverprofile").Value.String(); coverprofile != "" {
		dir := filepath.Dir(coverprofile)
		base := filepath.Base(coverprofile)
		baseParts := strings.SplitN(base, ".", 2)
		coverprofileCounters[t.Name()] = coverprofileCounters[t.Name()] + 1
		baseParts[0] = fmt.Sprintf("%v-%v-%v", baseParts[0], t.Name(), coverprofileCounters[t.Name()])
		ret = append(ret, "-test.coverprofile", filepath.Join(dir, strings.Join(baseParts, ".")))
	}

	ret = append(ret, "--", "--disableconfigwatch")

	// Unless the test passes a `--config` of its own, create a temporary one from the default
	// configuration with the current test database applied.
	hasConfig := false
	for _, arg := range args {
		if arg == "--config" {
			hasConfig = true
			break
		}
	}

	var configFilePath string
	cleanup := func() {}
	if !hasConfig {
		configFilePath, cleanup = makeConfigFile(nil)

		ret = append(ret, "--config", configFilePath)
	}

	ret = append(ret, args...)

	return ret, cleanup
}

// CheckCommand invokes the test binary, returning the output modified for assertion testing.
func CheckCommand(t *testing.T, args ...string) string {
	path, err := os.Executable()
	require.NoError(t, err)
	args, cleanup := execArgs(t, args)
	defer cleanup()
	output, err := exec.Command(path, args...).CombinedOutput()
	require.NoError(t, err, string(output))
	return strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(string(output)), "PASS"))
}

// RunCommand invokes the test binary, returning only any error.
func RunCommand(t *testing.T, args ...string) error {
	path, err := os.Executable()
	require.NoError(t, err)

	args, cleanup := execArgs(t, args)
	defer cleanup()

	return exec.Command(path, args...).Run()
}

// RunCommandWithOutput is a variant of RunCommand that returns the umodified output and any error.
func RunCommandWithOutput(t *testing.T, args ...string) (string, error) {
	path, err := os.Executable()
	require.NoError(t, err)
	args, cleanup := execArgs(t, args)
	defer cleanup()

	cmd := exec.Command(path, args...)

	var buf bytes.Buffer
	reader, writer := io.Pipe()
	cmd.Stdout = writer
	cmd.Stderr = writer

	done := make(chan bool)
	go func() {
		io.Copy(&buf, reader)
		close(done)
	}()

	err = cmd.Run()
	writer.Close()
	<-done

	return buf.String(), err
}
