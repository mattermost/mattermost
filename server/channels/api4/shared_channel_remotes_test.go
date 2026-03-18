// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetSharedChannelRemotes(t *testing.T) {
	th := setupForSharedChannels(t).InitBasic(t)

	// Create remote clusters
	remote1 := &model.RemoteCluster{
		Name:        "remote1",
		DisplayName: "Remote Cluster 1",
		SiteURL:     "http://example.com",
		CreatorId:   th.BasicUser.Id,
		Token:       model.NewId(),
		LastPingAt:  model.GetMillis(),
	}
	remote1, appErr := th.App.AddRemoteCluster(remote1)
	require.Nil(t, appErr)

	remote2 := &model.RemoteCluster{
		Name:        "remote2",
		DisplayName: "Remote Cluster 2",
		SiteURL:     "http://example.org",
		CreatorId:   th.BasicUser.Id,
		Token:       model.NewId(),
		LastPingAt:  model.GetMillis(),
	}
	remote2, appErr = th.App.AddRemoteCluster(remote2)
	require.Nil(t, appErr)

	// Create shared channel
	channel1 := th.CreateChannelWithClientAndTeam(t, th.Client, model.ChannelTypeOpen, th.BasicTeam.Id)
	sc1 := &model.SharedChannel{
		ChannelId:        channel1.Id,
		TeamId:           th.BasicTeam.Id,
		Home:             true,
		ReadOnly:         false,
		ShareName:        channel1.Name,
		ShareDisplayName: channel1.DisplayName,
		SharePurpose:     channel1.Purpose,
		ShareHeader:      channel1.Header,
		CreatorId:        th.BasicUser.Id,
	}

	_, sErr := th.App.ShareChannel(th.Context, sc1)
	require.NoError(t, sErr)

	// Add remotes to channel1
	scr1 := &model.SharedChannelRemote{
		ChannelId:         sc1.ChannelId,
		RemoteId:          remote1.RemoteId,
		CreatorId:         th.BasicUser.Id,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
	}
	_, sErr = th.App.SaveSharedChannelRemote(scr1)
	require.NoError(t, sErr)

	scr2 := &model.SharedChannelRemote{
		ChannelId:         sc1.ChannelId,
		RemoteId:          remote2.RemoteId,
		CreatorId:         th.BasicUser.Id,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
	}
	_, sErr = th.App.SaveSharedChannelRemote(scr2)
	require.NoError(t, sErr)

	// Test the API endpoint
	url := fmt.Sprintf("/sharedchannels/%s/remotes", channel1.Id)
	resp, err := th.Client.DoAPIGet(context.Background(), url, "")
	require.NoError(t, err)

	var result []*model.RemoteClusterInfo
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)

	// Verify response
	require.NotNil(t, result)
	require.Len(t, result, 2)

	// Sort remote infos by display name for consistent testing
	sort.Slice(result, func(i, j int) bool {
		return result[i].DisplayName < result[j].DisplayName
	})

	// Verify the RemoteClusterInfo objects contain the expected data
	assert.Equal(t, remote1.DisplayName, result[0].DisplayName)
	assert.Equal(t, remote2.DisplayName, result[1].DisplayName)

	// Should also contain other fields
	assert.NotEmpty(t, result[0].Name)
	assert.NotEmpty(t, result[1].Name)
	assert.NotZero(t, result[0].LastPingAt)
	assert.NotZero(t, result[1].LastPingAt)

	// Test access control - user without permissions should not be able to access
	user2 := th.CreateUser(t)
	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.Client.Login(context.Background(), user2.Email, user2.Password)
	require.NoError(t, err)

	resp, err = th.Client.DoAPIGet(context.Background(), url, "")
	require.Error(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
}
