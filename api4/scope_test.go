// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func TestScopes(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	// This test verifies that each API is assigned correct scopes. It needs to
	// be updated when APIs are added/removed, or change their scope
	// requirements.
	t.Run("required scopes by API name", func(t *testing.T) {
		expected := map[string]model.APIScopes{
			"addChannelMember":                   {model.ScopeChannelsJoin},
			"addTeamMember":                      {model.ScopeTeamsJoin},
			"addTeamMembers":                     {model.ScopeTeamsJoin},
			"connectWebSocket":                   model.ScopeUnrestrictedAPI,
			"createChannel":                      {model.ScopeChannelsCreate},
			"createDirectChannel":                {model.ScopeChannelsCreate},
			"createEphemeralPost":                model.ScopeUnrestrictedAPI,
			"createPost":                         {model.ScopePostsCreate},
			"createTeam":                         {model.ScopeTeamsCreate},
			"createUser":                         {model.ScopeUsersCreate},
			"deleteChannel":                      {model.ScopeChannelsDelete},
			"deletePost":                         {model.ScopePostsDelete},
			"deleteReaction":                     {model.ScopePostsUpdate},
			"deleteTeam":                         {model.ScopeTeamsDelete},
			"deleteUser":                         {model.ScopeUsersDelete},
			"doPostAction":                       model.ScopeUnrestrictedAPI,
			"executeCommand":                     {model.ScopeCommandsExecute},
			"getAllChannels":                     {model.ScopeChannelsRead},
			"getAllTeams":                        {model.ScopeTeamsRead},
			"getBrandImage":                      model.ScopeUnrestrictedAPI,
			"getChannel":                         {model.ScopeChannelsRead},
			"getChannelByName":                   {model.ScopeChannelsRead},
			"getChannelMember":                   {model.ScopeChannelsRead, model.ScopeUsersRead},
			"getChannelsForUser":                 {model.ScopeChannelsRead, model.ScopeUsersRead},
			"getClientConfig":                    model.ScopeUnrestrictedAPI,
			"getClientLicense":                   model.ScopeUnrestrictedAPI,
			"getDefaultProfileImage":             {model.ScopeUsersRead},
			"getDeletedChannelsForTeam":          {model.ScopeChannelsRead, model.ScopeTeamsRead},
			"getFile":                            {model.ScopeFilesRead},
			"getFileInfo":                        {model.ScopeFilesRead},
			"getFileInfosForPost":                {model.ScopeFilesRead, model.ScopePostsRead},
			"getFileLink":                        {model.ScopeFilesRead},
			"getFilePreview":                     {model.ScopeFilesRead},
			"getFileThumbnail":                   {model.ScopeFilesRead},
			"getFlaggedPostsForUser":             {model.ScopePostsRead, model.ScopeUsersRead},
			"getKnownUsers":                      {model.ScopeUsersRead},
			"getPinnedPosts":                     {model.ScopeChannelsRead, model.ScopePostsRead},
			"getPost":                            {model.ScopePostsRead},
			"getPostsByIds":                      {model.ScopePostsRead},
			"getPostsForChannel":                 {model.ScopeChannelsRead, model.ScopePostsRead},
			"getPostsForChannelAroundLastUnread": {model.ScopeChannelsRead, model.ScopePostsRead},
			"getPostThread":                      {model.ScopePostsRead},
			"getPrivateChannelsForTeam":          {model.ScopeChannelsRead, model.ScopeTeamsRead},
			"getProfileImage":                    {model.ScopeUsersRead},
			"getPublicChannelsForTeam":           {model.ScopeChannelsRead, model.ScopeTeamsRead},
			"getPublicFile":                      {model.ScopeFilesRead},
			"getReactions":                       {model.ScopePostsRead},
			"getSupportedTimezones":              model.ScopeUnrestrictedAPI,
			"getTeam":                            {model.ScopeTeamsRead},
			"getTeamByName":                      {model.ScopeTeamsRead},
			"getTeamIcon":                        {model.ScopeTeamsRead},
			"getTeamMember":                      {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamMembers":                     {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamMembersByIds":                {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamMembersForUser":              {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamsForUser":                    {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamStats":                       {model.ScopeTeamsRead},
			"getTeamsUnreadForUser":              {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamUnread":                      {model.ScopeTeamsRead},
			"getUser":                            {model.ScopeUsersRead},
			"getUserByEmail":                     {model.ScopeUsersRead},
			"getUserByUsername":                  {model.ScopeUsersRead},
			"getUsers":                           {model.ScopeUsersRead},
			"getUsersByIds":                      {model.ScopeUsersRead},
			"getUsersByNames":                    {model.ScopeUsersRead},
			"getUserStatus":                      {model.ScopeUsersRead},
			"getUserStatusesByIds":               {model.ScopeUsersRead},
			"login":                              model.ScopeUnrestrictedAPI,
			"loginCWS":                           model.ScopeUnrestrictedAPI,
			"logout":                             model.ScopeUnrestrictedAPI,
			"moveChannel":                        {model.ScopeChannelsUpdate},
			"openDialog":                         model.ScopeUnrestrictedAPI,
			"patchChannel":                       {model.ScopeChannelsUpdate},
			"patchPost":                          {model.ScopePostsUpdate},
			"patchTeam":                          {model.ScopeTeamsUpdate},
			"patchUser":                          {model.ScopeUsersUpdate},
			"pinPost":                            {model.ScopeChannelsUpdate, model.ScopePostsRead},
			"publishUserTyping":                  {model.ScopeUsersUpdate},
			"removeChannelMember":                {model.ScopeChannelsJoin, model.ScopeUsersUpdate},
			"removeTeamMember":                   {model.ScopeTeamsJoin, model.ScopeUsersUpdate},
			"removeUserCustomStatus":             {model.ScopeUsersUpdate},
			"removeUserRecentCustomStatus":       {model.ScopeUsersUpdate},
			"saveReaction":                       {model.ScopePostsUpdate},
			"searchAllChannels":                  {model.ScopeChannelsSearch},
			"searchChannelsForTeam":              {model.ScopeChannelsSearch, model.ScopeTeamsRead},
			"searchFilesForUser":                 {model.ScopeFilesSearch, model.ScopeUsersRead},
			"searchFilesInTeam":                  {model.ScopeFilesSearch, model.ScopeTeamsRead},
			"searchPostsInAllTeams":              {model.ScopePostsSearch},
			"searchPostsInTeam":                  {model.ScopePostsSearch, model.ScopeTeamsRead},
			"searchTeams":                        {model.ScopeTeamsSearch},
			"searchUsers":                        {model.ScopeUsersSearch},
			"setDefaultProfileImage":             {model.ScopeUsersUpdate},
			"setPostReminder":                    {model.ScopePostsUpdate},
			"setPostUnread":                      {model.ScopePostsUpdate},
			"setProfileImage":                    {model.ScopeUsersUpdate},
			"setTeamIcon":                        {model.ScopeTeamsUpdate},
			"submitDialog":                       model.ScopeUnrestrictedAPI,
			"teamExists":                         {model.ScopeTeamsRead},
			"unpinPost":                          {model.ScopeChannelsUpdate, model.ScopePostsRead},
			"updateChannel":                      {model.ScopeChannelsUpdate},
			"updateChannelPrivacy":               {model.ScopeChannelsUpdate},
			"updatePost":                         {model.ScopePostsUpdate},
			"updateTeam":                         {model.ScopeTeamsUpdate},
			"updateTeamPrivacy":                  {model.ScopeTeamsUpdate},
			"updateUser":                         {model.ScopeUsersUpdate},
			"updateUserActive":                   {model.ScopeUsersUpdate},
			"updateUserCustomStatus":             {model.ScopeUsersUpdate},
			"updateUserStatus":                   {model.ScopeUsersUpdate},
			"viewChannel":                        {model.ScopeChannelsRead, model.ScopeUsersRead},
		}

		expectedKeys := []string{}
		for k := range expected {
			expectedKeys = append(expectedKeys, k)
		}
		sort.Strings(expectedKeys)
		keys := []string{}
		for k := range th.API.knownAPIsByName {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		require.EqualValues(t, expectedKeys, keys)
		require.EqualValues(t, expected, th.API.knownAPIsByName)
	})

	// This test verifies that each API is assigned correct scopes. It needs to
	// be updated when APIs are added/removed, or change their scope
	// requirements.
	t.Run("APIs by scope name", func(t *testing.T) {
		expected := map[model.Scope][]string{
			"*:*": {
				"connectWebSocket",
				"createEphemeralPost",
				"doPostAction",
				"getBrandImage",
				"getClientConfig",
				"getClientLicense",
				"getSupportedTimezones",
				"login",
				"loginCWS",
				"logout",
				"openDialog",
				"submitDialog",
			},
			"channels:create": {
				"createChannel",
				"createDirectChannel",
			},
			"channels:delete": {
				"deleteChannel",
			},
			"channels:join": {
				"addChannelMember",
				"removeChannelMember",
			},
			"channels:read": {
				"getAllChannels",
				"viewChannel",
				"getPublicChannelsForTeam",
				"getDeletedChannelsForTeam",
				"getPrivateChannelsForTeam",
				"getChannelsForUser",
				"getChannel",
				"getPinnedPosts",
				"getChannelByName",
				"getChannelMember",
				"getPostsForChannel",
				"getPostsForChannelAroundLastUnread",
			},
			"channels:search": {
				"searchAllChannels",
				"searchChannelsForTeam",
			},
			"channels:update": {
				"updateChannel",
				"patchChannel",
				"updateChannelPrivacy",
				"moveChannel",
				"pinPost",
				"unpinPost",
			},
			"commands:execute": {
				"executeCommand",
			},
			"files:read": {
				"getFileInfosForPost",
				"getFile",
				"getFileThumbnail",
				"getFileLink",
				"getFilePreview",
				"getFileInfo",
				"getPublicFile",
			},
			"files:search": {
				"searchFilesForUser",
				"searchFilesInTeam",
			},
			"posts:create": {
				"createPost",
			},
			"posts:delete": {
				"deletePost",
			},
			"posts:read": {
				"getPinnedPosts",
				"getPost",
				"getPostsByIds",
				"getPostThread",
				"getFileInfosForPost",
				"getPostsForChannel",
				"getFlaggedPostsForUser",
				"getPostsForChannelAroundLastUnread",
				"pinPost",
				"unpinPost",
				"getReactions",
			},
			"posts:search": {
				"searchPostsInTeam",
				"searchPostsInAllTeams",
			},
			"posts:update": {
				"updatePost",
				"patchPost",
				"setPostUnread",
				"setPostReminder",
				"saveReaction",
				"deleteReaction",
			},
			"teams:create": {
				"createTeam",
			},
			"teams:join": {
				"addTeamMember",
				"addTeamMembers",
				"removeTeamMember",
			},
			"teams:read": {
				"getAllTeams",
				"getDeletedChannelsForTeam",
				"getPrivateChannelsForTeam",
				"getPublicChannelsForTeam",
				"getTeam",
				"getTeamByName",
				"getTeamIcon",
				"getTeamMember",
				"getTeamMembers",
				"getTeamMembersByIds",
				"getTeamMembersForUser",
				"getTeamsForUser",
				"getTeamStats",
				"getTeamsUnreadForUser",
				"getTeamUnread",
				"searchChannelsForTeam",
				"searchFilesInTeam",
				"searchPostsInTeam",
				"teamExists",
			},
			"teams:search": {
				"searchTeams",
			},
			"teams:update": {
				"updateTeam",
				"patchTeam",
				"updateTeamPrivacy",
				"setTeamIcon",
			},
			"teams:delete": {
				"deleteTeam",
			},
			"users:create": {
				"createUser",
			},
			"users:delete": {
				"deleteUser",
			},
			"users:read": {
				"getUsers",
				"getUsersByIds",
				"getUsersByNames",
				"getKnownUsers",
				"getUser",
				"getDefaultProfileImage",
				"getProfileImage",
				"getUserByUsername",
				"getUserByEmail",
				"getTeamsForUser",
				"getTeamsUnreadForUser",
				"getTeamMembers",
				"getTeamMembersByIds",
				"getTeamMembersForUser",
				"getTeamMember",
				"viewChannel",
				"getChannelsForUser",
				"getChannelMember",
				"getFlaggedPostsForUser",
				"searchFilesForUser",
				"getUserStatus",
				"getUserStatusesByIds",
			},
			"users:search": {
				"searchUsers",
			},
			"users:update": {
				"setProfileImage",
				"setDefaultProfileImage",
				"updateUser",
				"patchUser",
				"updateUserActive",
				"publishUserTyping",
				"removeTeamMember",
				"removeChannelMember",
				"updateUserStatus",
				"updateUserCustomStatus",
				"removeUserCustomStatus",
				"removeUserRecentCustomStatus",
			},
			"_internal_api": {
				"addChannelsToPolicy",
				"addLdapPrivateCertificate",
				"addLdapPublicCertificate",
				"addLicense",
				"addSamlIdpCertificate",
				"addSamlPrivateCertificate",
				"addSamlPublicCertificate",
				"addTeamsToPolicy",
				"addUserToTeamFromInvite",
				"appendAncillaryPermissions",
				"assignBot",
				"attachDeviceId",
				"autocompleteChannelsForTeam",
				"autocompleteChannelsForTeamForSearch",
				"autocompleteEmojis",
				"autocompleteUsers",
				"cancelJob",
				"changeSubscription",
				"channelMemberCountsByGroup",
				"channelMembersMinusGroupMembers",
				"clearServerBusy",
				"completeOnboarding",
				"configReload",
				"confirmCustomerPayment",
				"convertBotToUser",
				"convertUserToBot",
				"createBot",
				"createCategoryForTeamForUser",
				"createCommand",
				"createComplianceReport",
				"createCustomerPayment",
				"createEmoji",
				"createGroupChannel",
				"createIncomingHook",
				"createJob",
				"createOAuthApp",
				"createOutgoingHook",
				"createPolicy",
				"createScheme",
				"createTermsOfService",
				"createUpload",
				"createUserAccessToken",
				"databaseRecycle",
				"deleteBrandImage",
				"deleteCategoryForTeamForUser",
				"deleteCommand",
				"deleteEmoji",
				"deleteExport",
				"deleteIncomingHook",
				"deleteOAuthApp",
				"deleteOutgoingHook",
				"deletePolicy",
				"deletePreferences",
				"deleteScheme",
				"demoteUserToGuest",
				"disableBot",
				"disablePlugin",
				"disableUserAccessToken",
				"downloadComplianceReport",
				"downloadExport",
				"downloadJob",
				"enableBot",
				"enablePlugin",
				"enableUserAccessToken",
				"followThreadByUser",
				"func1",
				"generateMfaSecret",
				"generateSupportPacket",
				"getAllRoles",
				"getAnalytics",
				"getAppliedSchemaMigrations",
				"getAudits",
				"getAuthorizedOAuthApps",
				"getBot",
				"getBots",
				"getBulkReactions",
				"getCategoriesForTeamForUser",
				"getCategoryForTeamForUser",
				"getCategoryOrderForTeamForUser",
				"getChannelByNameForTeamName",
				"getChannelMembers",
				"getChannelMembersByIds",
				"getChannelMembersForTeamForUser",
				"getChannelMembersForUser",
				"getChannelMembersTimezones",
				"getChannelModerations",
				"getChannelPoliciesForUser",
				"getChannelsForPolicy",
				"getChannelsForScheme",
				"getChannelsForTeamForUser",
				"getChannelStats",
				"getChannelUnread",
				"getCloudCustomer",
				"getCloudLimits",
				"getCloudProducts",
				"getClusterStatus",
				"getCommand",
				"getComplianceReport",
				"getComplianceReports",
				"getConfig",
				"getEmoji",
				"getEmojiByName",
				"getEmojiImage",
				"getEmojiList",
				"getEnvironmentConfig",
				"getFilteredUsersStats",
				"getFirstAdminVisitMarketplaceStatus",
				"getGlobalPolicy",
				"getImage",
				"getIncomingHook",
				"getIncomingHooks",
				"getIntegrationsUsage",
				"getInviteInfo",
				"getInvoicesForSubscription",
				"getJob",
				"getJobs",
				"getJobsByType",
				"getLatestTermsOfService",
				"getLatestVersion",
				"getLdapGroups",
				"getLogs",
				"getMarketplacePlugins",
				"getOAuthApp",
				"getOAuthAppInfo",
				"getOAuthApps",
				"getOnboarding",
				"getOpenGraphMetadata",
				"getOutgoingHook",
				"getOutgoingHooks",
				"getPlugins",
				"getPluginStatuses",
				"getPolicies",
				"getPoliciesCount",
				"getPolicy",
				"getPostsUsage",
				"getPreferenceByCategoryAndName",
				"getPreferences",
				"getPreferencesByCategory",
				"getPrevTrialLicense",
				"getProductNotices",
				"getPublicChannelsByIdsForTeam",
				"getRecentSearches",
				"getRedirectLocation",
				"getRemoteClusterInfo",
				"getRole",
				"getRoleByName",
				"getRolesByNames",
				"getSamlCertificateStatus",
				"getSamlMetadata",
				"getSamlMetadataFromIdp",
				"getScheme",
				"getSchemes",
				"getServerBusyExpires",
				"getSessions",
				"getSharedChannels",
				"getStorageUsage",
				"getSubscription",
				"getSubscriptionInvoicePDF",
				"getSystemPing",
				"getTeamPoliciesForUser",
				"getTeamsForPolicy",
				"getTeamsForScheme",
				"getTeamsUsage",
				"getThreadForUser",
				"getThreadsForUser",
				"getTotalUsersStats",
				"getUpload",
				"getUploadsForUser",
				"getUserAccessToken",
				"getUserAccessTokens",
				"getUserAccessTokensForUser",
				"getUserAudits",
				"getUsersByGroupChannelIds",
				"getUsersWithInvalidEmails",
				"getUserTermsOfService",
				"getWarnMetricsStatus",
				"getWebappPlugins",
				"handleCWSWebhook",
				"handleNotifyAdmin",
				"handleTriggerNotifyAdminPosts",
				"importTeam",
				"installMarketplacePlugin",
				"installPluginFromURL",
				"invalidateAllEmailInvites",
				"invalidateCaches",
				"inviteGuestsToChannels",
				"inviteUsersToTeam",
				"linkLdapGroup",
				"listAutocompleteCommands",
				"listCommandAutocompleteSuggestions",
				"listCommands",
				"listExports",
				"listImports",
				"migrateAuthToLDAP",
				"migrateAuthToSaml",
				"migrateIdLdap",
				"moveCommand",
				"patchBot",
				"patchChannelModerations",
				"patchConfig",
				"patchPolicy",
				"patchRole",
				"patchScheme",
				"postLog",
				"promoteGuestToUser",
				"purgeBleveIndexes",
				"purgeElasticsearchIndexes",
				"pushNotificationAck",
				"regenCommandToken",
				"regenerateOAuthAppSecret",
				"regenerateTeamInviteId",
				"regenOutgoingHookToken",
				"remoteClusterAcceptMessage",
				"remoteClusterConfirmInvite",
				"remoteClusterPing",
				"remoteSetProfileImage",
				"removeChannelsFromPolicy",
				"removeLdapPrivateCertificate",
				"removeLdapPublicCertificate",
				"removeLicense",
				"removePlugin",
				"removeSamlIdpCertificate",
				"removeSamlPrivateCertificate",
				"removeSamlPublicCertificate",
				"removeTeamIcon",
				"removeTeamsFromPolicy",
				"requestCloudTrial",
				"requestRenewalLink",
				"requestTrialLicense",
				"requestTrialLicenseAndAckWarnMetric",
				"resetAuthDataToEmail",
				"resetPassword",
				"restart",
				"restoreChannel",
				"restoreTeam",
				"revokeAllSessionsAllUsers",
				"revokeAllSessionsForUser",
				"revokeSession",
				"revokeUserAccessToken",
				"saveUserTermsOfService",
				"searchArchivedChannelsForTeam",
				"searchChannelsInPolicy",
				"searchEmojis",
				"searchGroupChannels",
				"searchTeamsInPolicy",
				"searchUserAccessTokens",
				"sendPasswordReset",
				"sendVerificationEmail",
				"sendWarnMetricAckEmail",
				"setFirstAdminVisitMarketplaceStatus",
				"setServerBusy",
				"setUnreadThreadByPostId",
				"softDeleteTeamsExcept",
				"switchAccountType",
				"syncLdap",
				"teamMembersMinusGroupMembers",
				"testElasticsearch",
				"testEmail",
				"testLdap",
				"testS3",
				"testSiteURL",
				"unfollowThreadByUser",
				"unlinkLdapGroup",
				"updateCategoriesForTeamForUser",
				"updateCategoryForTeamForUser",
				"updateCategoryOrderForTeamForUser",
				"updateChannelMemberNotifyProps",
				"updateChannelMemberRoles",
				"updateChannelMemberSchemeRoles",
				"updateChannelScheme",
				"updateCloudCustomer",
				"updateCloudCustomerAddress",
				"updateCommand",
				"updateConfig",
				"updateIncomingHook",
				"updateOAuthApp",
				"updateOutgoingHook",
				"updatePassword",
				"updatePreferences",
				"updateReadStateAllThreadsByUser",
				"updateReadStateThreadByUser",
				"updateTeamMemberRoles",
				"updateTeamMemberSchemeRoles",
				"updateTeamScheme",
				"updateUserAuth",
				"updateUserMfa",
				"updateUserRoles",
				"updateViewedProductNotices",
				"upgradeToEnterprise",
				"upgradeToEnterpriseStatus",
				"uploadBrandImage",
				"uploadData",
				"uploadFileStream",
				"uploadPlugin",
				"uploadRemoteData",
				"validateBusinessEmail",
				"validateWorkspaceBusinessEmail",
				"verifyUserEmail",
				"verifyUserEmailWithoutToken",
			},
		}

		normalize := func(v map[model.Scope][]string) map[model.Scope][]string {
			for k := range v {
				sort.Slice(v[k], func(i, j int) bool { return v[k][i] < v[k][j] })
			}
			return v
		}

		require.EqualValues(t, normalize(expected), normalize(th.API.knownAPIsByScope))
	})

	// Test that the API and plugin scope restrictions actually work.
	if testing.Short() {
		t.SkipNow()
	}

	th = th.InitBasic()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableOAuthServiceProvider = true
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
	})

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOAuth.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	// install the test plugin
	pluginID := "testpluginhttp"
	pluginDir := *th.App.Config().PluginSettings.Directory
	pluginWebappDir := *th.App.Config().PluginSettings.ClientDirectory
	code := `
	package main

	import (
		"net/http"

		"github.com/mattermost/mattermost-server/v6/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, req *http.Request) {
		_, _ = w.Write([]byte(req.Header.Get("Mattermost-Scopes")))
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
	`
	pluginServer := filepath.Join(pluginDir, pluginID, pluginID)
	utils.CompileGo(t, code, pluginServer)
	manifest := fmt.Sprintf(`{"id": "%s", "server": {"executable": "%s"}}`, pluginID, pluginID)
	os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(manifest), 0600)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates[pluginID] = &model.PluginState{
			Enable: true,
		}
	})

	th.App.InitPlugins(th.Context, pluginDir, pluginWebappDir)

	pr, _, err := th.SystemAdminClient.GetPlugins()
	require.NoError(t, err)
	require.Len(t, pr.Active, 1)
	require.Equal(t, pluginID, pr.Active[0].Id)
	require.Len(t, pr.Inactive, 0)

	// setupTestAppClient sets up a test OAuth app with specified scopes, and obtains a client for it.
	setupTestAppClient := func(scopes model.AppScopes) (*model.OAuthApp, *model.Client4) {
		oauthApp := &model.OAuthApp{
			Name:         "OAuthScopedApp" + model.NewId(),
			Homepage:     "https://nowhere.com",
			Description:  "test",
			CallbackUrls: []string{"https://nowhere.com"},
			CreatorId:    th.SystemAdminUser.Id,
			Scopes:       scopes,
		}
		oauthApp, appErr := th.App.CreateOAuthApp(oauthApp)
		require.Nil(t, appErr)

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.AuthCodeResponseType,
			ClientId:     oauthApp.Id,
			RedirectURI:  oauthApp.CallbackUrls[0],
			Scope:        "all",
			State:        "123",
		}

		redirect, _, err := th.SystemAdminClient.AuthorizeOAuthApp(authRequest)
		require.NoError(t, err)
		rurl, _ := url.Parse(redirect)
		data := url.Values{
			"grant_type":    []string{model.AccessTokenGrantType},
			"client_id":     []string{oauthApp.Id},
			"client_secret": []string{oauthApp.ClientSecret},
			"code":          []string{rurl.Query().Get("code")},
			"redirect_uri":  []string{oauthApp.CallbackUrls[0]},
		}

		client := model.NewAPIv4Client(th.Client.URL)
		rsp, _, err := client.GetOAuthAccessToken(data)
		require.NoError(t, err)
		require.NotEmpty(t, rsp.AccessToken, "access token not returned")
		token := rsp.AccessToken
		require.Equal(t, rsp.TokenType, model.AccessTokenType, "access token type incorrect")
		client.SetOAuthToken(token)

		return oauthApp, client
	}

	t.Run("GetUser", func(t *testing.T) {
		for _, tc := range []struct {
			name          string
			scopes        model.AppScopes
			expectFailure bool
		}{
			{
				name:   "matching scope",
				scopes: model.AppScopes{"users:read"},
			},
			{
				name:   "broader scope",
				scopes: model.AppScopes{"users:read", "channels:read"},
			},
			{
				name: "legacy app no scopes",
			},
			{
				name:          "mismatched scope",
				scopes:        model.AppScopes{"users:update", "channels:read"},
				expectFailure: true,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				_, client := setupTestAppClient(tc.scopes)

				user, resp, err := client.GetUser(th.BasicUser.Id, "")
				if !tc.expectFailure {
					require.NoError(t, err)
					require.Equal(t, th.BasicUser.Id, user.Id, "should have returned the user")
					require.Equal(t, http.StatusOK, resp.StatusCode, "should have returned a 200 status code")
				} else {
					require.Error(t, err)
					require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
				}
			})
		}
	})

	t.Run("plugin access", func(t *testing.T) {
		for _, tc := range []struct {
			name          string
			scopes        model.AppScopes
			expectFailure bool
		}{
			{
				name:   "matching scope",
				scopes: model.AppScopes{"plugins:testpluginhttp/apipath"},
			},
			{
				name:   "matching pluginid only",
				scopes: model.AppScopes{"plugins:testpluginhttp"},
			},
			{
				name:   "broader scope",
				scopes: model.AppScopes{"plugins:testpluginhttp/apipath", "users:read", "channels:read"},
			},
			{
				name: "legacy app no scopes",
			},
			{
				name:          "mismatched scope",
				scopes:        model.AppScopes{"users:update", "channels:read", "plugins:otherplugin"},
				expectFailure: true,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				tc.scopes = model.NormalizeScopes(tc.scopes)
				_, client := setupTestAppClient(tc.scopes)

				resp, err := client.DoAPIRequest(http.MethodPost, client.URL+"/plugins/testpluginhttp/apipath", "", "")
				if !tc.expectFailure {
					require.NoError(t, err)
					require.Equal(t, http.StatusOK, resp.StatusCode)
					body, ioerr := io.ReadAll(resp.Body)
					require.NoError(t, ioerr)
					require.Equal(t, tc.scopes.String(), string(body))
				} else {
					require.Error(t, err)
					require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
				}
			})
		}
	})
}
