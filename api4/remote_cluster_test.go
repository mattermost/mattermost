// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func Test_getRemoteById(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// for this test we need a user that belongs to a channel that
	// is shared with the requested remote id.

	// create a remote cluster
	rc := &model.RemoteCluster{
		RemoteId:     model.NewId(),
		DisplayName:  "Test1",
		RemoteTeamId: model.NewId(),
		SiteURL:      model.NewId(),
		CreatorId:    model.NewId(),
	}
	rc, appErr := th.App.AddRemoteCluster(rc)
	require.Nil(t, appErr)

	// create a shared channel
	sc := &model.SharedChannel{
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicChannel.TeamId,
		Home:      false,
		ShareName: "test_share",
		CreatorId: th.BasicChannel.CreatorId,
		RemoteId:  rc.RemoteId,
	}
	sc, err := th.App.SaveSharedChannel(sc)
	require.NoError(t, err)

	// create a shared channel remote to connect them
	scr := &model.SharedChannelRemote{
		Id:                model.NewId(),
		ChannelId:         sc.ChannelId,
		CreatorId:         sc.CreatorId,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
		RemoteId:          sc.RemoteId,
	}
	scr, err = th.App.SaveSharedChannelRemote(scr)
	require.NoError(t, err)

	t.Run("valid remote, user is member", func(t *testing.T) {
		rcFound, resp := th.Client.GetRemoteClusterById(rc.RemoteId)
		CheckNoError(t, resp)
		assert.Equal(t, rc.RemoteId, rcFound.RemoteId)
	})

	t.Run("invalid remote", func(t *testing.T) {
		_, resp := th.Client.GetRemoteClusterById(model.NewId())
		CheckNotFoundStatus(t, resp)
	})

}
