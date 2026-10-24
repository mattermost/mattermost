// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetExperienceSyncCancelledContext(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	var teamIDs []string
	for range 5 {
		team := th.CreateTeam(t)
		th.LinkUserToTeam(t, th.BasicUser, team)
		teamIDs = append(teamIDs, team.Id)
	}

	req := &model.ExperienceSyncRequest{
		Since: 0,
		Scope: model.ExperienceSyncScope{TeamIDs: teamIDs},
	}

	resp, appErr := th.App.GetExperienceSync(th.Context, th.BasicUser.Id, req)
	require.Nil(t, appErr)
	require.Len(t, resp.Teams, len(teamIDs))

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	rctx := th.Context.WithContext(ctx)

	resp, appErr = th.App.GetExperienceSync(rctx, th.BasicUser.Id, req)
	require.Nil(t, appErr)
	assert.Empty(t, resp.Teams)
}
