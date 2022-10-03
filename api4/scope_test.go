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
			"addChannelMember":                     {model.ScopeChannelsJoin},
			"addTeamMember":                        {model.ScopeTeamsJoin},
			"addTeamMembers":                       {model.ScopeTeamsJoin},
			"autocompleteChannelsForTeam":          {model.ScopeChannelsSearch},
			"autocompleteChannelsForTeamForSearch": {model.ScopeChannelsSearch, model.ScopeTeamsRead},
			"autocompleteEmojis":                   {model.ScopeEmojisSearch},
			"autocompleteUsers":                    {model.ScopeUsersSearch},
			"connectWebSocket":                     model.ScopeUnrestrictedAPI,
			"createChannel":                        {model.ScopeChannelsCreate},
			"createDirectChannel":                  {model.ScopeChannelsCreate},
			"createEmoji":                          {model.ScopeEmojisCreate},
			"createEphemeralPost":                  {model.ScopePostsCreate},
			"createPost":                           {model.ScopePostsCreate},
			"createTeam":                           {model.ScopeTeamsCreate},
			"createUpload":                         {model.ScopeFilesCreate},
			"createUser":                           {model.ScopeUsersCreate},
			"deleteChannel":                        {model.ScopeChannelsDelete},
			"deleteEmoji":                          {model.ScopeEmojisDelete},
			"deletePost":                           {model.ScopePostsDelete},
			"deleteReaction":                       {model.ScopePostsUpdate},
			"deleteTeam":                           {model.ScopeTeamsDelete},
			"deleteUser":                           {model.ScopeUsersDelete},
			"demoteUserToGuest":                    {model.ScopeUsersUpdate},
			"doPostAction":                         model.ScopeUnrestrictedAPI,
			"executeCommand":                       {model.ScopeCommandsExecute},
			"getAllChannels":                       {model.ScopeChannelsRead},
			"getAllTeams":                          {model.ScopeTeamsRead},
			"getBrandImage":                        model.ScopeUnrestrictedAPI,
			"getBulkReactions":                     {model.ScopePostsRead},
			"getChannel":                           {model.ScopeChannelsRead},
			"getChannelByName":                     {model.ScopeChannelsRead},
			"getChannelByNameForTeamName":          {model.ScopeChannelsRead, model.ScopeTeamsRead},
			"getChannelMember":                     {model.ScopeChannelsRead, model.ScopeUsersRead},
			"getChannelMembers":                    {model.ScopeChannelsRead, model.ScopeUsersRead},
			"getChannelMembersByIds":               {model.ScopeChannelsRead, model.ScopeUsersRead},
			"getChannelMembersForTeamForUser":      {model.ScopeChannelsRead, model.ScopeTeamsRead, model.ScopeUsersRead},
			"getChannelMembersForUser":             {model.ScopeChannelsRead, model.ScopeUsersRead},
			"getChannelMembersTimezones":           {model.ScopeChannelsRead, model.ScopeUsersRead},
			"getChannelsForTeamForUser":            {model.ScopeChannelsRead, model.ScopeTeamsRead, model.ScopeUsersRead},
			"getChannelsForUser":                   {model.ScopeChannelsRead, model.ScopeUsersRead},
			"getChannelStats":                      {model.ScopeChannelsRead},
			"getChannelUnread":                     {model.ScopeChannelsRead},
			"getClientConfig":                      model.ScopeUnrestrictedAPI,
			"getClientLicense":                     model.ScopeUnrestrictedAPI,
			"getDefaultProfileImage":               {model.ScopeUsersRead},
			"getDeletedChannelsForTeam":            {model.ScopeChannelsRead, model.ScopeTeamsRead},
			"getEmoji":                             {model.ScopeEmojisRead},
			"getEmojiByName":                       {model.ScopeEmojisRead},
			"getEmojiImage":                        {model.ScopeEmojisRead},
			"getEmojiList":                         {model.ScopeEmojisRead},
			"getFile":                              {model.ScopeFilesRead},
			"getFileInfo":                          {model.ScopeFilesRead},
			"getFileInfosForPost":                  {model.ScopeFilesRead, model.ScopePostsRead},
			"getFileLink":                          {model.ScopeFilesRead},
			"getFilePreview":                       {model.ScopeFilesRead},
			"getFileThumbnail":                     {model.ScopeFilesRead},
			"getFlaggedPostsForUser":               {model.ScopePostsRead, model.ScopeUsersRead},
			"getKnownUsers":                        {model.ScopeUsersRead},
			"getPinnedPosts":                       {model.ScopeChannelsRead, model.ScopePostsRead},
			"getPost":                              {model.ScopePostsRead},
			"getPostsByIds":                        {model.ScopePostsRead},
			"getPostsForChannel":                   {model.ScopeChannelsRead, model.ScopePostsRead},
			"getPostsForChannelAroundLastUnread":   {model.ScopeChannelsRead, model.ScopePostsRead},
			"getPostThread":                        {model.ScopePostsRead},
			"getPrivateChannelsForTeam":            {model.ScopeChannelsRead, model.ScopeTeamsRead},
			"getProfileImage":                      {model.ScopeUsersRead},
			"getPublicChannelsByIdsForTeam":        {model.ScopeChannelsRead, model.ScopeTeamsRead},
			"getPublicChannelsForTeam":             {model.ScopeChannelsRead, model.ScopeTeamsRead},
			"getPublicFile":                        {model.ScopeFilesRead},
			"getReactions":                         {model.ScopePostsRead},
			"getRecentSearches":                    {model.ScopeUsersRead},
			"getSupportedTimezones":                model.ScopeUnrestrictedAPI,
			"getTeam":                              {model.ScopeTeamsRead},
			"getTeamByName":                        {model.ScopeTeamsRead},
			"getTeamIcon":                          {model.ScopeTeamsRead},
			"getTeamMember":                        {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamMembers":                       {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamMembersByIds":                  {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamMembersForUser":                {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamsForUser":                      {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamStats":                         {model.ScopeTeamsRead},
			"getTeamsUnreadForUser":                {model.ScopeTeamsRead, model.ScopeUsersRead},
			"getTeamUnread":                        {model.ScopeTeamsRead},
			"getUpload":                            {model.ScopeFilesRead},
			"getUploadsForUser":                    {model.ScopeFilesRead, model.ScopeUsersRead},
			"getUser":                              {model.ScopeUsersRead},
			"getUserByEmail":                       {model.ScopeUsersRead},
			"getUserByUsername":                    {model.ScopeUsersRead},
			"getUsers":                             {model.ScopeUsersRead},
			"getUsersByIds":                        {model.ScopeUsersRead},
			"getUsersByNames":                      {model.ScopeUsersRead},
			"getUserStatus":                        {model.ScopeUsersRead},
			"getUserStatusesByIds":                 {model.ScopeUsersRead},
			"login":                                model.ScopeUnrestrictedAPI,
			"loginCWS":                             model.ScopeUnrestrictedAPI,
			"logout":                               model.ScopeUnrestrictedAPI,
			"moveChannel":                          {model.ScopeChannelsUpdate},
			"openDialog":                           model.ScopeUnrestrictedAPI,
			"patchChannel":                         {model.ScopeChannelsUpdate},
			"patchPost":                            {model.ScopePostsUpdate},
			"patchTeam":                            {model.ScopeTeamsUpdate},
			"patchUser":                            {model.ScopeUsersUpdate},
			"pinPost":                              {model.ScopeChannelsUpdate, model.ScopePostsRead},
			"promoteGuestToUser":                   {model.ScopeUsersUpdate},
			"publishUserTyping":                    {model.ScopeUsersUpdate},
			"removeChannelMember":                  {model.ScopeChannelsJoin, model.ScopeUsersUpdate},
			"removeTeamIcon":                       {model.ScopeTeamsUpdate},
			"removeTeamMember":                     {model.ScopeTeamsJoin, model.ScopeUsersUpdate},
			"removeUserCustomStatus":               {model.ScopeUsersUpdate},
			"removeUserRecentCustomStatus":         {model.ScopeUsersUpdate},
			"restoreChannel":                       {model.ScopeChannelsUpdate},
			"restoreTeam":                          {model.ScopeTeamsUpdate},
			"saveReaction":                         {model.ScopePostsUpdate},
			"searchAllChannels":                    {model.ScopeChannelsSearch},
			"searchArchivedChannelsForTeam":        {model.ScopeChannelsSearch, model.ScopeTeamsRead},
			"searchChannelsForTeam":                {model.ScopeChannelsSearch, model.ScopeTeamsRead},
			"searchEmojis":                         {model.ScopeEmojisSearch},
			"searchFilesForUser":                   {model.ScopeFilesSearch, model.ScopeUsersRead},
			"searchFilesInTeam":                    {model.ScopeFilesSearch, model.ScopeTeamsRead},
			"searchPostsInAllTeams":                {model.ScopePostsSearch},
			"searchPostsInTeam":                    {model.ScopePostsSearch, model.ScopeTeamsRead},
			"searchTeams":                          {model.ScopeTeamsRead, model.ScopeTeamsSearch},
			"searchUsers":                          {model.ScopeUsersRead, model.ScopeUsersSearch},
			"setDefaultProfileImage":               {model.ScopeUsersUpdate},
			"setPostReminder":                      {model.ScopePostsUpdate},
			"setPostUnread":                        {model.ScopePostsUpdate},
			"setProfileImage":                      {model.ScopeUsersUpdate},
			"setTeamIcon":                          {model.ScopeTeamsUpdate},
			"softDeleteTeamsExcept":                {model.ScopeTeamsDelete},
			"submitDialog":                         model.ScopeUnrestrictedAPI,
			"teamExists":                           {model.ScopeTeamsRead},
			"unpinPost":                            {model.ScopeChannelsUpdate, model.ScopePostsRead},
			"updateChannel":                        {model.ScopeChannelsUpdate},
			"updateChannelPrivacy":                 {model.ScopeChannelsUpdate},
			"updatePost":                           {model.ScopePostsUpdate},
			"updateTeam":                           {model.ScopeTeamsUpdate},
			"updateTeamPrivacy":                    {model.ScopeTeamsUpdate},
			"updateUser":                           {model.ScopeUsersUpdate},
			"updateUserActive":                     {model.ScopeUsersUpdate},
			"updateUserCustomStatus":               {model.ScopeUsersUpdate},
			"updateUserStatus":                     {model.ScopeUsersUpdate},
			"uploadData":                           {model.ScopeFilesCreate},
			"uploadFileStream":                     {model.ScopeFilesCreate},
			"viewChannel":                          {model.ScopeChannelsRead, model.ScopeUsersRead},
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
				"getChannelMembersForUser",
				"getAllChannels",
				"viewChannel",
				"getPublicChannelsForTeam",
				"getDeletedChannelsForTeam",
				"getPrivateChannelsForTeam",
				"getPublicChannelsByIdsForTeam",
				"getChannelsForTeamForUser",
				"getChannelsForUser",
				"getChannel",
				"getChannelStats",
				"getPinnedPosts",
				"getChannelMembersTimezones",
				"getChannelUnread",
				"getChannelByName",
				"getChannelByNameForTeamName",
				"getChannelMembers",
				"getChannelMembersByIds",
				"getChannelMembersForTeamForUser",
				"getChannelMember",
				"getPostsForChannel",
				"getPostsForChannelAroundLastUnread",
			},
			"channels:search": {
				"searchAllChannels",
				"searchChannelsForTeam",
				"searchArchivedChannelsForTeam",
				"autocompleteChannelsForTeam",
				"autocompleteChannelsForTeamForSearch",
			},
			"channels:update": {
				"updateChannel",
				"patchChannel",
				"updateChannelPrivacy",
				"restoreChannel",
				"moveChannel",
				"pinPost",
				"unpinPost",
			},
			"commands:execute": {
				"executeCommand",
			},
			"emojis:create": {
				"createEmoji",
			},
			"emojis:delete": {
				"deleteEmoji",
			},
			"emojis:read": {
				"getEmojiList",
				"getEmoji",
				"getEmojiByName",
				"getEmojiImage",
			},
			"emojis:search": {
				"searchEmojis",
				"autocompleteEmojis",
			},
			"files:create": {
				"uploadFileStream",
				"createUpload",
				"uploadData",
			},
			"files:read": {
				"getUploadsForUser",
				"getFileInfosForPost",
				"getFile",
				"getFileThumbnail",
				"getFileLink",
				"getFilePreview",
				"getFileInfo",
				"getPublicFile",
				"getUpload",
			},
			"files:search": {
				"searchFilesForUser",
				"searchFilesInTeam",
			},
			"internal_api": {
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
				"createGroupChannel",
				"createIncomingHook",
				"createJob",
				"createOAuthApp",
				"createOutgoingHook",
				"createPolicy",
				"createScheme",
				"createTermsOfService",
				"createUserAccessToken",
				"databaseRecycle",
				"deleteBrandImage",
				"deleteCategoryForTeamForUser",
				"deleteCommand",
				"deleteExport",
				"deleteIncomingHook",
				"deleteOAuthApp",
				"deleteOutgoingHook",
				"deletePolicy",
				"deletePreferences",
				"deleteScheme",
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
				"getCategoriesForTeamForUser",
				"getCategoryForTeamForUser",
				"getCategoryOrderForTeamForUser",
				"getChannelModerations",
				"getChannelPoliciesForUser",
				"getChannelsForPolicy",
				"getChannelsForScheme",
				"getCloudCustomer",
				"getCloudLimits",
				"getCloudProducts",
				"getClusterStatus",
				"getCommand",
				"getComplianceReport",
				"getComplianceReports",
				"getConfig",
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
				"removeTeamsFromPolicy",
				"requestCloudTrial",
				"requestRenewalLink",
				"requestTrialLicense",
				"requestTrialLicenseAndAckWarnMetric",
				"resetAuthDataToEmail",
				"resetPassword",
				"restart",
				"revokeAllSessionsAllUsers",
				"revokeAllSessionsForUser",
				"revokeSession",
				"revokeUserAccessToken",
				"saveUserTermsOfService",
				"searchChannelsInPolicy",
				"searchGroupChannels",
				"searchTeamsInPolicy",
				"searchUserAccessTokens",
				"sendPasswordReset",
				"sendVerificationEmail",
				"sendWarnMetricAckEmail",
				"setFirstAdminVisitMarketplaceStatus",
				"setServerBusy",
				"setUnreadThreadByPostId",
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
				"uploadPlugin",
				"uploadRemoteData",
				"validateBusinessEmail",
				"validateWorkspaceBusinessEmail",
				"verifyUserEmail",
				"verifyUserEmailWithoutToken",
			},
			"posts:create": {
				"createPost",
				"createEphemeralPost",
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
				"getBulkReactions",
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
			}, "teams:delete": {
				"deleteTeam",
				"softDeleteTeamsExcept",
			},
			"teams:join": {
				"addTeamMember",
				"addTeamMembers",
				"removeTeamMember",
			},
			"teams:read": {
				"autocompleteChannelsForTeamForSearch",
				"getAllTeams",
				"getChannelByNameForTeamName",
				"getChannelMembersForTeamForUser",
				"getChannelsForTeamForUser",
				"getDeletedChannelsForTeam",
				"getPrivateChannelsForTeam",
				"getPublicChannelsByIdsForTeam",
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
				"searchArchivedChannelsForTeam",
				"searchChannelsForTeam",
				"searchFilesInTeam",
				"searchPostsInTeam",
				"searchTeams",
				"teamExists",
			}, "teams:search": {
				"searchTeams",
			},
			"teams:update": {
				"updateTeam",
				"patchTeam",
				"restoreTeam",
				"updateTeamPrivacy",
				"setTeamIcon",
				"removeTeamIcon",
			},
			"users:create": {
				"createUser",
			}, "users:delete": {
				"deleteUser",
			},
			"users:read": {
				"getUsers",
				"getUsersByIds",
				"getUsersByNames",
				"getKnownUsers",
				"searchUsers",
				"getUser",
				"getDefaultProfileImage",
				"getProfileImage",
				"getUserByUsername",
				"getUserByEmail",
				"getUploadsForUser",
				"getChannelMembersForUser",
				"getRecentSearches",
				"getTeamsForUser",
				"getTeamsUnreadForUser",
				"getTeamMembers",
				"getTeamMembersByIds",
				"getTeamMembersForUser",
				"getTeamMember",
				"viewChannel",
				"getChannelsForTeamForUser",
				"getChannelsForUser",
				"getChannelMembersTimezones",
				"getChannelMembers",
				"getChannelMembersByIds",
				"getChannelMembersForTeamForUser",
				"getChannelMember",
				"getFlaggedPostsForUser",
				"searchFilesForUser",
				"getUserStatus",
				"getUserStatusesByIds",
			}, "users:search": {
				"searchUsers",
				"autocompleteUsers",
			},
			"users:update": {
				"setProfileImage",
				"setDefaultProfileImage",
				"updateUser",
				"patchUser",
				"updateUserActive",
				"promoteGuestToUser",
				"demoteUserToGuest",
				"publishUserTyping",
				"removeTeamMember",
				"removeChannelMember",
				"updateUserStatus",
				"updateUserCustomStatus",
				"removeUserCustomStatus",
				"removeUserRecentCustomStatus"},
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
