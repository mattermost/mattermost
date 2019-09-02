// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func goMod(t *testing.T, dir string, args ...string) {
	cmd := exec.Command("go", append([]string{"mod"}, args...)...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("Failed to %s: %s", strings.Join(args, " "), string(output))
	}
}

func CompileGo(t *testing.T, sourceCode, outputPath string) {
	dir, err := ioutil.TempDir(".", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	dir, err = filepath.Abs(dir)
	require.NoError(t, err)

	// Write out main.go given the source code.
	main := filepath.Join(dir, "main.go")
	err = ioutil.WriteFile(main, []byte(sourceCode), 0600)
	require.NoError(t, err)

	if os.Getenv("GO111MODULE") != "off" {
		var mattermostServerPath string

		// Generate a go.mod file relying on the local copy of the mattermost-server.
		// testlib linked mattermost-server into the general temporary directory for this test.
		mattermostServerPath, err = filepath.Abs("mattermost-server")
		require.NoError(t, err)

		goMod(t, dir, "init", "mattermost.com/test")
		goMod(t, dir, "edit", "-require", "github.com/mattermost/mattermost-server@v0.0.0")
		goMod(t, dir, "edit", "-replace", fmt.Sprintf("github.com/mattermost/mattermost-server@v0.0.0=%s", mattermostServerPath))
	}

	out := &bytes.Buffer{}
	cmd := exec.Command("go", "build", "-o", outputPath, "main.go")
	cmd.Dir = dir
	cmd.Stdout = out
	cmd.Stderr = out
	err = cmd.Run()
	if err != nil {
		t.Log("Go compile errors:\n", out.String())
	}
	require.NoError(t, err, "failed to compile go")
}
