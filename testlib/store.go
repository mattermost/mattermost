// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
)

type TestStore struct {
	store.Store
}

func (s *TestStore) Close() {
	// Don't propagate to the underlying store, since this instance is persistent.
}

func GetMockStoreForSetupFunctions() *mocks.Store {
	mockStore := mocks.Store{}
	systemStore := mocks.SystemStore{}
	systemStore.On("GetByName", "UpgradedFromTE").Return(nil, model.NewAppError("FakeError", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError))
	systemStore.On("GetByName", "ContentExtractionConfigMigrationComplete").Return(&model.System{Name: "ContentExtractionConfigMigrationComplete", Value: "true"}, nil)
	systemStore.On("GetByName", "AsymmetricSigningKey").Return(nil, model.NewAppError("FakeError", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError))
	systemStore.On("GetByName", "PostActionCookieSecret").Return(nil, model.NewAppError("FakeError", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError))
	systemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: strconv.FormatInt(model.GetMillis(), 10)}, nil)
	systemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)
	systemStore.On("GetByName", "AdvancedPermissionsMigrationComplete").Return(&model.System{Name: "AdvancedPermissionsMigrationComplete", Value: "true"}, nil)
	systemStore.On("GetByName", "EmojisPermissionsMigrationComplete").Return(&model.System{Name: "EmojisPermissionsMigrationComplete", Value: "true"}, nil)
	systemStore.On("GetByName", "GuestRolesCreationMigrationComplete").Return(&model.System{Name: "GuestRolesCreationMigrationComplete", Value: "true"}, nil)
	systemStore.On("GetByName", "SystemConsoleRolesCreationMigrationComplete").Return(&model.System{Name: "SystemConsoleRolesCreationMigrationComplete", Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_EMOJI_PERMISSIONS_SPLIT).Return(&model.System{Name: model.MIGRATION_KEY_EMOJI_PERMISSIONS_SPLIT, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_WEBHOOK_PERMISSIONS_SPLIT).Return(&model.System{Name: model.MIGRATION_KEY_WEBHOOK_PERMISSIONS_SPLIT, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_LIST_JOIN_PUBLIC_PRIVATE_TEAMS).Return(&model.System{Name: model.MIGRATION_KEY_LIST_JOIN_PUBLIC_PRIVATE_TEAMS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_REMOVE_PERMANENT_DELETE_USER).Return(&model.System{Name: model.MIGRATION_KEY_REMOVE_PERMANENT_DELETE_USER, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_BOT_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_BOT_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_APPLY_CHANNEL_MANAGE_DELETE_TO_CHANNEL_USER).Return(&model.System{Name: model.MIGRATION_KEY_APPLY_CHANNEL_MANAGE_DELETE_TO_CHANNEL_USER, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_REMOVE_CHANNEL_MANAGE_DELETE_FROM_TEAM_USER).Return(&model.System{Name: model.MIGRATION_KEY_REMOVE_CHANNEL_MANAGE_DELETE_FROM_TEAM_USER, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_VIEW_MEMBERS_NEW_PERMISSION).Return(&model.System{Name: model.MIGRATION_KEY_VIEW_MEMBERS_NEW_PERMISSION, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_MANAGE_GUESTS_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_MANAGE_GUESTS_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_CHANNEL_MODERATIONS_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_CHANNEL_MODERATIONS_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_USE_GROUP_MENTIONS_PERMISSION).Return(&model.System{Name: model.MIGRATION_KEY_ADD_USE_GROUP_MENTIONS_PERMISSION, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_SYSTEM_CONSOLE_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_SYSTEM_CONSOLE_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_CONVERT_CHANNEL_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_CONVERT_CHANNEL_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_SYSTEM_ROLES_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_SYSTEM_ROLES_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_BILLING_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_BILLING_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_DOWNLOAD_COMPLIANCE_EXPORT_RESULTS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_DOWNLOAD_COMPLIANCE_EXPORT_RESULTS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_MANAGE_SHARED_CHANNEL_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_MANAGE_SHARED_CHANNEL_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("GetByName", model.MIGRATION_KEY_ADD_MANAGE_REMOTE_CLUSTERS_PERMISSIONS).Return(&model.System{Name: model.MIGRATION_KEY_ADD_MANAGE_REMOTE_CLUSTERS_PERMISSIONS, Value: "true"}, nil)
	systemStore.On("Get").Return(make(model.StringMap), nil)
	systemStore.On("Save", mock.AnythingOfType("*model.System")).Return(nil)

	userStore := mocks.UserStore{}
	userStore.On("Count", mock.AnythingOfType("model.UserCountOptions")).Return(int64(1), nil)
	userStore.On("DeactivateGuests").Return(nil, nil)
	userStore.On("ClearCaches").Return(nil)

	postStore := mocks.PostStore{}
	postStore.On("GetMaxPostSize").Return(4000)

	statusStore := mocks.StatusStore{}
	statusStore.On("ResetAll").Return(nil)

	channelStore := mocks.ChannelStore{}
	channelStore.On("ClearCaches").Return(nil)

	schemeStore := mocks.SchemeStore{}
	schemeStore.On("GetAllPage", model.SCHEME_SCOPE_TEAM, mock.Anything, 100).Return([]*model.Scheme{}, nil)

	teamStore := mocks.TeamStore{}

	roleStore := mocks.RoleStore{}
	roleStore.On("GetAll").Return([]*model.Role{}, nil)

	mockStore.On("System").Return(&systemStore)
	mockStore.On("User").Return(&userStore)
	mockStore.On("Post").Return(&postStore)
	mockStore.On("Status").Return(&statusStore)
	mockStore.On("Channel").Return(&channelStore)
	mockStore.On("Team").Return(&teamStore)
	mockStore.On("Role").Return(&roleStore)
	mockStore.On("Scheme").Return(&schemeStore)
	mockStore.On("Close").Return(nil)
	mockStore.On("DropAllTables").Return(nil)
	mockStore.On("MarkSystemRanUnitTests").Return(nil)
	return &mockStore
}
