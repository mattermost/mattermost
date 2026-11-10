// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func TestMobileLogsGetCommand(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	result := cmd.GetCommand(th.App, i18n.IdentityTfunc())
	assert.Equal(t, CmdMobileLogs, result.Trigger)
	assert.True(t, result.AutoComplete)
	assert.NotEmpty(t, result.AutoCompleteDesc)
	assert.NotEmpty(t, result.AutoCompleteHint)
	assert.NotEmpty(t, result.DisplayName)
}

func TestMobileLogsOnSelf(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "on")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.enabled", resp.Text)

	pref, err := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, th.BasicUser.Id, model.PreferenceCategoryAdvancedSettings, model.PreferenceNameAttachAppLogs)
	require.Nil(t, err)
	assert.Equal(t, "true", pref.Value)
}

func TestMobileLogsOffSelf(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "on")

	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "off")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.disabled", resp.Text)

	pref, err := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, th.BasicUser.Id, model.PreferenceCategoryAdvancedSettings, model.PreferenceNameAttachAppLogs)
	require.Nil(t, err)
	assert.Equal(t, "false", pref.Value)
}

func TestMobileLogsStatusDefault(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "status")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.status_off", resp.Text)
}

func TestMobileLogsStatusOn(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "on")

	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "status")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.status_on", resp.Text)
}

func TestMobileLogsOnOtherUserWithPermission(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "on @"+th.BasicUser.Username)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.enabled", resp.Text)

	pref, err := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, th.BasicUser.Id, model.PreferenceCategoryAdvancedSettings, model.PreferenceNameAttachAppLogs)
	require.Nil(t, err)
	assert.Equal(t, "true", pref.Value)
}

func TestMobileLogsOffOtherUserWithPermission(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "on @"+th.BasicUser.Username)

	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "off @"+th.BasicUser.Username)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.disabled", resp.Text)

	pref, err := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, th.BasicUser.Id, model.PreferenceCategoryAdvancedSettings, model.PreferenceNameAttachAppLogs)
	require.Nil(t, err)
	assert.Equal(t, "false", pref.Value)
}

func TestMobileLogsStatusOtherUser(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}

	// Default status for other user
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "status @"+th.BasicUser.Username)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.status_off", resp.Text)

	// Enable for other user, then check status
	cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "on @"+th.BasicUser.Username)

	resp = cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "status @"+th.BasicUser.Username)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.status_on", resp.Text)
}

func TestMobileLogsOnOtherUserWithoutPermission(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "on @"+th.BasicUser2.Username)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.cross_user_unavailable.app_error", resp.Text)
}

func TestMobileLogsOnOtherUserWithoutAtPrefix(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "on "+th.BasicUser.Username)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.enabled", resp.Text)

	pref, err := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, th.BasicUser.Id, model.PreferenceCategoryAdvancedSettings, model.PreferenceNameAttachAppLogs)
	require.Nil(t, err)
	assert.Equal(t, "true", pref.Value)
}

func TestMobileLogsNoArgs(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.usage", resp.Text)
}

func TestMobileLogsTooManyArgs(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "on @"+th.BasicUser.Username)

	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "on @"+th.BasicUser.Username+" trailing")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.usage", resp.Text)

	pref, err := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, th.BasicUser.Id, model.PreferenceCategoryAdvancedSettings, model.PreferenceNameAttachAppLogs)
	require.Nil(t, err)
	assert.Equal(t, "true", pref.Value)
}

func TestMobileLogsInvalidAction(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "invalid")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.usage", resp.Text)
}

func TestMobileLogsUserNotFound(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "on @nonexistentuser12345")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.user_not_found.app_error", resp.Text)
}

func TestMobileLogsNonexistentTargetAsRegularUserReturnsNoPermission(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "on @nonexistentuser12345")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.cross_user_unavailable.app_error", resp.Text)
}

func TestMobileLogsOnSelfWithAtUsername(t *testing.T) {
	th := setup(t).initBasic(t)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "on @"+th.BasicUser.Username)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.enabled", resp.Text)

	pref, err := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, th.BasicUser.Id, model.PreferenceCategoryAdvancedSettings, model.PreferenceNameAttachAppLogs)
	require.Nil(t, err)
	assert.Equal(t, "true", pref.Value)
}

func TestMobileLogsDeactivatedUser(t *testing.T) {
	th := setup(t).initBasic(t)

	_, err := th.App.UpdateActive(th.Context, th.BasicUser2, false)
	require.Nil(t, err)

	cmd := &MobileLogsProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.SystemAdminUser.Id,
	}, "on @"+th.BasicUser2.Username)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_mobile_logs.user_not_found.app_error", resp.Text)
}
