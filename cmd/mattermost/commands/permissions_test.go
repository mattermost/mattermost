// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/utils"
)

func TestPermissionsExport_rejectsUnlicensed(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	actual, _ := th.RunCommandWithOutput(t, "permissions", "export")
	assert.Contains(t, actual, utils.T("cli.license.critical"))
}

func TestPermissionsImport_rejectsUnlicensed(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	actual, _ := th.RunCommandWithOutput(t, "permissions", "import")

	assert.Contains(t, actual, utils.T("cli.license.critical"))
}
