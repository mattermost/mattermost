// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/utils"
)

func TestPermissionsExport_rejectsUnlicensed(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	actual, _ := th.RunCommandWithOutput(t, "permissions", "export")
	assert.Contains(t, actual, utils.T("cli.license.critical"))
}

func TestPermissionsImport_rejectsUnlicensed(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	actual, _ := th.RunCommandWithOutput(t, "permissions", "import")

	assert.Contains(t, actual, utils.T("cli.license.critical"))
}
