// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

var coverprofileCounters map[string]int = make(map[string]int)

func execArgs(t *testing.T, args []string) []string {
	ret := []string{"-test.run", "ExecCommand"}
	if coverprofile := flag.Lookup("test.coverprofile").Value.String(); coverprofile != "" {
		dir := filepath.Dir(coverprofile)
		base := filepath.Base(coverprofile)
		baseParts := strings.SplitN(base, ".", 2)
		coverprofileCounters[t.Name()] = coverprofileCounters[t.Name()] + 1
		baseParts[0] = fmt.Sprintf("%v-%v-%v", baseParts[0], t.Name(), coverprofileCounters[t.Name()])
		ret = append(ret, "-test.coverprofile", filepath.Join(dir, strings.Join(baseParts, ".")))
	}
	return append(append(ret, "--", "--disableconfigwatch"), args...)
}

func CheckCommand(t *testing.T, args ...string) string {
	path, err := os.Executable()
	require.NoError(t, err)
	output, err := exec.Command(path, execArgs(t, args)...).CombinedOutput()
	require.NoError(t, err, string(output))
	return strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(string(output)), "PASS"))
}

func RunCommand(t *testing.T, args ...string) error {
	path, err := os.Executable()
	require.NoError(t, err)
	return exec.Command(path, execArgs(t, args)...).Run()
}
