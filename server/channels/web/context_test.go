// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestRequireHookId(t *testing.T) {
	c := &Context{}
	t.Run("WhenHookIdIsValid", func(t *testing.T) {
		c.Params = &Params{HookId: "abcdefghijklmnopqrstuvwxyz"}
		c.RequireHookId()

		require.Nil(t, c.Err, "Hook Id is Valid. Should not have set error in context")
	})

	t.Run("WhenHookIdIsInvalid", func(t *testing.T) {
		c.Params = &Params{HookId: "abc"}
		c.RequireHookId()

		require.NotNil(t, c.Err, "Should have set Error in context")
		require.Equal(t, http.StatusBadRequest, c.Err.StatusCode, "Should have set status as 400")
	})
}

func TestCloudKeyRequired(t *testing.T) {
	th := SetupWithStoreMock(t)

	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

	c := &Context{
		App:        th.App,
		AppContext: th.Context,
	}

	c.CloudKeyRequired()

	assert.Equal(t, c.Err.Id, "api.context.session_expired.app_error")
}

func TestMfaRequired(t *testing.T) {
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("Get", context.Background(), "userid").Return(nil, model.NewAppError("Userstore.Get", "storeerror", nil, "store error", http.StatusInternalServerError))
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)

	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	th.App.Srv().SetLicense(model.NewTestLicense("mfa"))

	th.Context = th.Context.WithSession(&model.Session{Id: "abc", UserId: "userid"})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AnnouncementSettings.UserNoticesEnabled = false
		*cfg.AnnouncementSettings.AdminNoticesEnabled = false
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
		*cfg.ServiceSettings.EnforceMultifactorAuthentication = true
	})

	c := &Context{
		App:        th.App,
		AppContext: th.Context,
	}

	c.MfaRequired()

	assert.Equal(t, c.Err.Id, "api.context.get_user.app_error")
}
