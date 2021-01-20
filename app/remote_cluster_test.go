// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestAddRemoteCluster(t *testing.T) {
	t.Run("adding remote cluster with duplicate site url", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		remoteCluster := &model.RemoteCluster{
			RemoteTeamId: model.NewId(),
			DisplayName:  "test",
			SiteURL:      "http://localhost:8065",
			Token:        "test",
			RemoteToken:  "test",
			Topics:       "",
			CreatorId:    th.BasicUser.Id,
		}

		_, err := th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		remoteCluster.RemoteId = model.NewId()
		_, err = th.App.AddRemoteCluster(remoteCluster)
		assert.Error(t, err, "Adding a duplicate remote cluster should error")
		assert.Contains(t, err.Error(), "Remote cluster has already been added.")
	})
}

func TestUpdateRemoteCluster(t *testing.T) {
	t.Run("update remote cluster with an already exitsing site url", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		remoteCluster := &model.RemoteCluster{
			RemoteTeamId: model.NewId(),
			DisplayName:  "test",
			SiteURL:      "http://localhost:8065",
			Token:        "test",
			RemoteToken:  "test",
			Topics:       "",
			CreatorId:    th.BasicUser.Id,
		}

		otherRemoteCluster := &model.RemoteCluster{
			RemoteTeamId: model.NewId(),
			DisplayName:  "test",
			SiteURL:      "http://localhost:8066",
			Token:        "test",
			RemoteToken:  "test",
			Topics:       "",
			CreatorId:    th.BasicUser.Id,
		}

		_, err := th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		savedRemoteClustered, err := th.App.AddRemoteCluster(otherRemoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		savedRemoteClustered.SiteURL = remoteCluster.SiteURL
		_, err = th.App.UpdateRemoteCluster(savedRemoteClustered)
		assert.Error(t, err, "Updating remote cluster with duplicate site url should error")
		assert.Contains(t, err.Error(), "Remote cluster with the same url already exists.")
	})
}
