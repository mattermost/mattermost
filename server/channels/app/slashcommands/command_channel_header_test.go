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

func TestHeaderProviderDoCommand(t *testing.T) {
	th := setup(t).initBasic(t)

	hp := HeaderProvider{}

	th.addPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

	// Try a public channel *with* permission.
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	for msg, expected := range map[string]string{
		"":      "api.command_channel_header.message.app_error",
		"hello": "",
	} {
		actual := hp.DoCommand(th.App, th.Context, args, msg).Text
		assert.Equal(t, expected, actual)
	}

	th.removePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

	// Try a public channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual := hp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	th.addPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

	// Try a private channel *with* permission.
	privateChannel := th.createPrivateChannel(t, th.BasicTeam)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: privateChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = hp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "", actual)

	th.removePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

	// Try a private channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: privateChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = hp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	// Try a group channel *with* being a member.
	user1 := th.createUser(t)
	user2 := th.createUser(t)
	user3 := th.createUser(t)

	groupChannel := th.createGroupChannel(t, user1, user2)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: groupChannel.Id,
		UserId:    user1.Id,
	}

	actual = hp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a group channel *without* being a member.
	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: groupChannel.Id,
		UserId:    user3.Id,
	}

	actual = hp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	// Try a direct channel *with* being a member.
	directChannel := th.createDmChannel(t, user1)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: directChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = hp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a direct channel *without* being a member.
	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: directChannel.Id,
		UserId:    user2.Id,
	}

	actual = hp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)
}

// A command run through the plugin API carries no session for the user it runs as. The
// management policy must still be evaluated for that user rather than skipped.
func TestHeaderProviderChecksChannelManagementAccessWithoutSession(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_CHANNELPERMISSIONACTIONS", "true")
	th := setup(t).initBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	th.addPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

	mockACS := &mocks.AccessControlServiceInterface{}
	original := th.App.Srv().Channels().AccessControl
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("ResourcePolicyGovernsAction", mock.Anything, mock.Anything, mock.Anything).Return(false, nil).Maybe()
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionChannelManagementAccess
	})).Return(model.AccessDecision{Decision: false}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, nil)

	require.Empty(t, th.Context.Session().UserId, "the command must run without the user's session")

	resp := (&HeaderProvider{}).DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}, "new header")

	assert.Equal(t, "api.channel.channel_management_access.abac_denied.app_error", resp.Text)
	channel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, appErr)
	assert.NotEqual(t, "new header", channel.Header)
}
