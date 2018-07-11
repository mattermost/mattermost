// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestPluginAPIUpdateUserStatus(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	statuses := []string{model.STATUS_ONLINE, model.STATUS_AWAY, model.STATUS_DND, model.STATUS_OFFLINE}

	for _, s := range statuses {
		status, err := api.UpdateUserStatus(s, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, status)
		assert.Equal(t, s, status.Status)
	}

	status, err := api.UpdateUserStatus("notrealstatus", th.BasicUser.Id)
	assert.NotNil(t, err)
	assert.Nil(t, status)
}
