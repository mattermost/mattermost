// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAssignRole(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.CheckCommand(t, "roles", "system_admin", th.BasicUser.Email)

	user, err := th.App.Srv().Store.User().GetByEmail(th.BasicUser.Email)
	require.NoError(t, err)
	assert.Equal(t, "system_user system_admin", user.Roles)

	th.CheckCommand(t, "roles", "member", th.BasicUser.Email)

	user, err = th.App.Srv().Store.User().GetByEmail(th.BasicUser.Email)
	require.NoError(t, err)
	assert.Equal(t, "system_user", user.Roles)

}
