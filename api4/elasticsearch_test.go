// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestElasticsearchTest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("as system user", func(t *testing.T) {
		_, resp := th.Client.TestElasticsearch()
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		_, resp := th.SystemAdminClient.TestElasticsearch()
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		_, resp := th.SystemAdminClient.TestElasticsearch()
		CheckForbiddenStatus(t, resp)
	})
}

func TestElasticsearchPurgeIndexes(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("as system user", func(t *testing.T) {
		_, resp := th.Client.PurgeElasticsearchIndexes()
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		_, resp := th.SystemAdminClient.PurgeElasticsearchIndexes()
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		_, resp := th.SystemAdminClient.PurgeElasticsearchIndexes()
		CheckForbiddenStatus(t, resp)
	})
}
