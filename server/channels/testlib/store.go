// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
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
	systemStore.On("GetByName", "FirstAdminSetupComplete").Return(&model.System{Name: "FirstAdminSetupComplete", Value: "true"}, nil)
	systemStore.On("GetByName", "RemainingSchemaMigrations").Return(&model.System{Name: "RemainingSchemaMigrations", Value: "true"}, nil)
	systemStore.On("GetByName", "ContentExtractionConfigDefaultTrueMigrationComplete").Return(&model.System{Name: "ContentExtractionConfigDefaultTrueMigrationComplete", Value: "true"}, nil)
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
	systemStore.On("GetByName", "PlaybookRolesCreationMigrationComplete").Return(&model.System{Name: "PlaybookRolesCreationMigrationComplete", Value: "true"}, nil)
	systemStore.On("GetByName", "PostPriorityConfigDefaultTrueMigrationComplete").Return(&model.System{Name: "PostPriorityConfigDefaultTrueMigrationComplete", Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyEmojiPermissionsSplit).Return(&model.System{Name: model.MigrationKeyEmojiPermissionsSplit, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyWebhookPermissionsSplit).Return(&model.System{Name: model.MigrationKeyWebhookPermissionsSplit, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyListJoinPublicPrivateTeams).Return(&model.System{Name: model.MigrationKeyListJoinPublicPrivateTeams, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyRemovePermanentDeleteUser).Return(&model.System{Name: model.MigrationKeyRemovePermanentDeleteUser, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddBotPermissions).Return(&model.System{Name: model.MigrationKeyAddBotPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyApplyChannelManageDeleteToChannelUser).Return(&model.System{Name: model.MigrationKeyApplyChannelManageDeleteToChannelUser, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyRemoveChannelManageDeleteFromTeamUser).Return(&model.System{Name: model.MigrationKeyRemoveChannelManageDeleteFromTeamUser, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyViewMembersNewPermission).Return(&model.System{Name: model.MigrationKeyViewMembersNewPermission, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddManageGuestsPermissions).Return(&model.System{Name: model.MigrationKeyAddManageGuestsPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyChannelModerationsPermissions).Return(&model.System{Name: model.MigrationKeyChannelModerationsPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddUseGroupMentionsPermission).Return(&model.System{Name: model.MigrationKeyAddUseGroupMentionsPermission, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddSystemConsolePermissions).Return(&model.System{Name: model.MigrationKeyAddSystemConsolePermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddConvertChannelPermissions).Return(&model.System{Name: model.MigrationKeyAddConvertChannelPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddSystemRolesPermissions).Return(&model.System{Name: model.MigrationKeyAddSystemRolesPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddBillingPermissions).Return(&model.System{Name: model.MigrationKeyAddBillingPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddDownloadComplianceExportResults).Return(&model.System{Name: model.MigrationKeyAddDownloadComplianceExportResults, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddSiteSubsectionPermissions).Return(&model.System{Name: model.MigrationKeyAddSiteSubsectionPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddExperimentalSubsectionPermissions).Return(&model.System{Name: model.MigrationKeyAddExperimentalSubsectionPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddAuthenticationSubsectionPermissions).Return(&model.System{Name: model.MigrationKeyAddAuthenticationSubsectionPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddComplianceSubsectionPermissions).Return(&model.System{Name: model.MigrationKeyAddExperimentalSubsectionPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddEnvironmentSubsectionPermissions).Return(&model.System{Name: model.MigrationKeyAddEnvironmentSubsectionPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddReportingSubsectionPermissions).Return(&model.System{Name: model.MigrationKeyAddReportingSubsectionPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddTestEmailAncillaryPermission).Return(&model.System{Name: model.MigrationKeyAddTestEmailAncillaryPermission, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddAboutSubsectionPermissions).Return(&model.System{Name: model.MigrationKeyAddAboutSubsectionPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddIntegrationsSubsectionPermissions).Return(&model.System{Name: model.MigrationKeyAddIntegrationsSubsectionPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddManageSharedChannelPermissions).Return(&model.System{Name: model.MigrationKeyAddManageSharedChannelPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddManageSecureConnectionsPermissions).Return(&model.System{Name: model.MigrationKeyAddManageSecureConnectionsPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddPlaybooksPermissions).Return(&model.System{Name: model.MigrationKeyAddPlaybooksPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddCustomUserGroupsPermissions).Return(&model.System{Name: model.MigrationKeyAddCustomUserGroupsPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddPlayboosksManageRolesPermissions).Return(&model.System{Name: model.MigrationKeyAddPlayboosksManageRolesPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddCustomUserGroupsPermissionRestore).Return(&model.System{Name: model.MigrationKeyAddCustomUserGroupsPermissionRestore, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyAddReadChannelContentPermissions).Return(&model.System{Name: model.MigrationKeyAddReadChannelContentPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", model.MigrationKeyDeleteEmptyDrafts).Return(&model.System{Name: model.MigrationKeyDeleteEmptyDrafts, Value: "true"}, nil)
	systemStore.On("GetByName", "CustomGroupAdminRoleCreationMigrationComplete").Return(&model.System{Name: model.MigrationKeyAddPlayboosksManageRolesPermissions, Value: "true"}, nil)
	systemStore.On("GetByName", "products_boards").Return(&model.System{Name: "products_boards", Value: "true"}, nil)
	systemStore.On("GetByName", "elasticsearch_fix_channel_index_migration").Return(&model.System{Name: "elasticsearch_fix_channel_index_migration", Value: "true"}, nil)
	systemStore.On("InsertIfExists", mock.AnythingOfType("*model.System")).Return(&model.System{}, nil).Once()
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
	schemeStore.On("GetAllPage", model.SchemeScopeTeam, mock.Anything, 100).Return([]*model.Scheme{}, nil)

	teamStore := mocks.TeamStore{}

	roleStore := mocks.RoleStore{}
	roleStore.On("GetAll").Return([]*model.Role{}, nil)

	sessionStore := mocks.SessionStore{}
	oAuthStore := mocks.OAuthStore{}
	groupStore := mocks.GroupStore{}

	pluginStore := mocks.PluginStore{}
	pluginStore.On("List", mock.Anything, mock.Anything, mock.Anything).Return([]string{}, nil)

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
	mockStore.On("Session").Return(&sessionStore)
	mockStore.On("OAuth").Return(&oAuthStore)
	mockStore.On("Group").Return(&groupStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)
	mockStore.On("Plugin").Return(&pluginStore)

	return &mockStore
}
