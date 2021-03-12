// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/stretchr/testify/assert"
)

func TestPermissionsExport_rejectsUnlicensed(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	actual, _ := th.RunCommandWithOutput(t, "permissions", "export")
	assert.Contains(t, actual, i18n.T("cli.license.critical"))
}

func TestPermissionsImport_rejectsUnlicensed(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	actual, _ := th.RunCommandWithOutput(t, "permissions", "import")

	assert.Contains(t, actual, i18n.T("cli.license.critical"))
}
