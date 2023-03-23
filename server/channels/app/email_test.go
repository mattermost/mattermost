// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestSendInviteEmailRateLimits(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.BasicTeam.AllowedDomains = "common.com"
	_, err := th.App.UpdateTeam(th.BasicTeam)
	require.Nilf(t, err, "%v, Should update the team", err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableEmailInvitations = true
	})

	memberInvite := &model.MemberInvite{}
	memberInvite.Emails = make([]string, 22)
	for i := 0; i < 22; i++ {
		memberInvite.Emails[i] = "test-" + strconv.Itoa(i) + "@common.com"
	}
	err = th.App.InviteNewUsersToTeam(memberInvite.Emails, th.BasicTeam.Id, th.BasicUser.Id)
	require.NotNil(t, err)
	assert.Equal(t, "app.email.rate_limit_exceeded.app_error", err.Id)
	assert.Equal(t, http.StatusRequestEntityTooLarge, err.StatusCode)

	_, err = th.App.InviteNewUsersToTeamGracefully(memberInvite, th.BasicTeam.Id, th.BasicUser.Id, "")
	require.NotNil(t, err)
	assert.Equal(t, "app.email.rate_limit_exceeded.app_error", err.Id)
	assert.Equal(t, http.StatusRequestEntityTooLarge, err.StatusCode)
}
