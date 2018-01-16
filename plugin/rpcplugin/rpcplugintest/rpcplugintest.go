// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugintest

import (
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

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
