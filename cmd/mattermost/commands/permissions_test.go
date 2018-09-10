// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/utils"
)

func TestPermissionsExport_rejectsUnlicensed(t *testing.T) {
	permissionsLicenseRequiredTest(t, "export")
}

func TestPermissionsImport_rejectsUnlicensed(t *testing.T) {
	permissionsLicenseRequiredTest(t, "import")
}

func permissionsLicenseRequiredTest(t *testing.T, subcommand string) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	path, err := os.Executable()
	if err != nil {
		t.Fail()
	}
	args := []string{"-test.run", "ExecCommand", "--", "--disableconfigwatch", "permissions", subcommand}
	output, _ := exec.Command(path, args...).CombinedOutput()

	actual := string(output)
	expected := utils.T("cli.license.critical")
	if !strings.Contains(actual, expected) {
		t.Errorf("Expected '%v' but got '%v'.", expected, actual)
	}
}
