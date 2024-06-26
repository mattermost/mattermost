// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func setupRemoteCluster(tb testing.TB) *TestHelper {
	return SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ExperimentalSettings.EnableRemoteClusterService = true
	})
}

func TestAddRemoteCluster(t *testing.T) {
	th := setupRemoteCluster(t).InitBasic()
	defer th.TearDown()

	t.Run("adding remote cluster with duplicate site url", func(t *testing.T) {
		remoteCluster := &model.RemoteCluster{
			Name:        "test1",
			SiteURL:     "http://www1.example.com:8065",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		_, err := th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		remoteCluster.RemoteId = model.NewId()
		_, err = th.App.AddRemoteCluster(remoteCluster)
		require.NotNil(t, err, "Adding a duplicate remote cluster should error")
		assert.Contains(t, err.Error(), i18n.T("api.remote_cluster.save_not_unique.app_error"))
	})
}

func TestUpdateRemoteCluster(t *testing.T) {
	th := setupRemoteCluster(t).InitBasic()
	defer th.TearDown()

	t.Run("update remote cluster with an already existing site url", func(t *testing.T) {
		remoteCluster := &model.RemoteCluster{
			Name:        "test3",
			SiteURL:     "http://www3.example.com:8065",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		otherRemoteCluster := &model.RemoteCluster{
			Name:        "test4",
			SiteURL:     "http://www4.example.com:8066",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		_, err := th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		savedRemoteClustered, err := th.App.AddRemoteCluster(otherRemoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		savedRemoteClustered.SiteURL = remoteCluster.SiteURL
		_, err = th.App.UpdateRemoteCluster(savedRemoteClustered)
		require.NotNil(t, err, "Updating remote cluster with duplicate site url should error")
		assert.Contains(t, err.Error(), i18n.T("api.remote_cluster.update_not_unique.app_error"))
	})

	t.Run("update remote cluster with an already existing site url, is not allowed", func(t *testing.T) {
		remoteCluster := &model.RemoteCluster{
			Name:        "test5",
			SiteURL:     "http://www5.example.com:8065",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		otherRemoteCluster := &model.RemoteCluster{
			Name:        "test6",
			SiteURL:     "http://www6.example.com:8065",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		existingRemoteCluster, err := th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		anotherExistingRemoteClustered, err := th.App.AddRemoteCluster(otherRemoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		// Same site url
		anotherExistingRemoteClustered.SiteURL = existingRemoteCluster.SiteURL
		_, err = th.App.UpdateRemoteCluster(anotherExistingRemoteClustered)
		require.NotNil(t, err, "Updating remote cluster should error")
		assert.Contains(t, err.Error(), i18n.T("api.remote_cluster.update_not_unique.app_error"))
	})
}
