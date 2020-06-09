// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestGetClusterStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("as system user", func(t *testing.T) {
		_, resp := th.Client.GetClusterStatus()
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		infos, resp := th.SystemAdminClient.GetClusterStatus()
		CheckNoError(t, resp)

		require.NotNil(t, infos, "cluster status should not be nil")
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		_, resp := th.SystemAdminClient.GetClusterStatus()
		CheckForbiddenStatus(t, resp)
	})
}
