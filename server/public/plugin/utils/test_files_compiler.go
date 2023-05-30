// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func CompileGo(t *testing.T, sourceCode, outputPath string) {
	dir, err := os.MkdirTemp(".", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	dir, err = filepath.Abs(dir)
	require.NoError(t, err)

	// Write out main.go given the source code.
	main := filepath.Join(dir, "main.go")
	err = os.WriteFile(main, []byte(sourceCode), 0600)
	require.NoError(t, err)

	_, sourceFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	serverPath := filepath.Dir(filepath.Dir(sourceFile))

	out := &bytes.Buffer{}
	cmd := exec.Command("go", "build", "-o", outputPath, main)
	cmd.Dir = serverPath
	cmd.Stdout = out
	cmd.Stderr = out
	err = cmd.Run()
	if err != nil {
		t.Log("Go compile errors:\n", out.String())
	}
	require.NoError(t, err, "failed to compile go")
}

func CompileGoTest(t *testing.T, sourceCode, outputPath string) {
	dir, err := os.MkdirTemp(".", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	dir, err = filepath.Abs(dir)
	require.NoError(t, err)

	// Write out main.go given the source code.
	main := filepath.Join(dir, "main_test.go")
	err = os.WriteFile(main, []byte(sourceCode), 0600)
	require.NoError(t, err)

	_, sourceFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	serverPath := filepath.Dir(filepath.Dir(sourceFile))

	out := &bytes.Buffer{}
	cmd := exec.Command("go", "test", "-c", "-o", outputPath, main)
	cmd.Dir = serverPath
	cmd.Stdout = out
	cmd.Stderr = out
	err = cmd.Run()
	if err != nil {
		t.Log("Go compile errors:\n", out.String())
	}
	require.NoError(t, err, "failed to compile go")
}
