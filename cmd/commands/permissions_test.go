// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/utils"
)

func TestPermissionsExport_rejectsUnlicensed(t *testing.T) {
	permissionsLicenseRequiredTest(t, "export")
}

func TestPermissionsImport_rejectsUnlicensed(t *testing.T) {
	permissionsLicenseRequiredTest(t, "import")
}

func permissionsLicenseRequiredTest(t *testing.T, subcommand string) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	path, err := os.Executable()
	if err != nil {
		t.Fail()
	}
	args := []string{"-test.run", "ExecCommand", "--", "--disableconfigwatch", "permissions", subcommand}
	output, err := exec.Command(path, args...).CombinedOutput()

	errorMsg := strings.Split(string(output), "\n")[0]
	if !strings.Contains(errorMsg, utils.T("cli.license.critical")) {
		t.Error()
	}
}
