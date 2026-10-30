// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestJoinCommandNoChannel(t *testing.T) {
	th := setup(t).initBasic(t)

	if testing.Short() {
		t.SkipNow()
	}

	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}, "asdsad")

	assert.Equal(t, "api.command_join.list.app_error", resp.Text)
}

func TestJoinCommandForExistingChannel(t *testing.T) {
	th := setup(t).initBasic(t)

	if testing.Short() {
		t.SkipNow()
	}

	channel2, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}, channel2.Name)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channel2.Name, resp.GotoLocation)
}

func TestJoinCommandWithTilde(t *testing.T) {
	th := setup(t).initBasic(t)

	if testing.Short() {
		t.SkipNow()
	}

	channel2, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}, "~"+channel2.Name)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channel2.Name, resp.GotoLocation)
}

func TestJoinCommandPermissions(t *testing.T) {
	th := setup(t).initBasic(t)

	channel2, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &JoinProvider{}

	user3 := th.createUser(t)

	// Try a public channel *without* permission.
	args := &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  user3.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}

	actual := cmd.DoCommand(th.App, th.Context, args, "~"+channel2.Name).Text
	assert.Equal(t, "api.command_join.fail.app_error", actual)

	// Try a public channel with permission.
	args = &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}

	actual = cmd.DoCommand(th.App, th.Context, args, "~"+channel2.Name).Text
	assert.Equal(t, "", actual)

	// Try a private channel *without* permission.
	channel3, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "BB",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	args = &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}

	actual = cmd.DoCommand(th.App, th.Context, args, "~"+channel3.Name).Text
	assert.Equal(t, "api.command_join.fail.app_error", actual)
}

// Joining is a read-tier action: /join is refused for a channel the user's read rules
// deny, as the REST self-join is, although the RBAC check alone would allow it.
func TestJoinCommandChecksChannelReadAccess(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_CHANNELPERMISSIONACTIONS", "true")
	th := setup(t).initBasic(t)

	if testing.Short() {
		t.SkipNow()
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "Read denied",
		Name:        "read-denied-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)
	require.Nil(t, appErr)

	mockACS := &mocks.AccessControlServiceInterface{}
	original := th.App.Srv().Channels().AccessControl
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
		Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: false}, nil)

	resp := (&JoinProvider{}).DoCommand(th.App, th.Context, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}, channel.Name)

	assert.Equal(t, "api.command_join.fail.app_error", resp.Text)
	assert.Empty(t, resp.GotoLocation)
	_, memberErr := th.App.GetChannelMember(th.Context, channel.Id, th.BasicUser2.Id)
	require.NotNil(t, memberErr, "the denied user must not have joined")
}
