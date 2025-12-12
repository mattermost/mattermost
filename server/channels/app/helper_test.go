// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type TestHelper struct {
	App          *App
	Context      *request.Context
	Server       *Server
	Store        store.Store
	SQLStore     *sqlstore.SqlStore
	BasicTeam    *model.Team
	BasicUser    *model.User
	BasicUser2   *model.User
	BasicChannel *model.Channel
	BasicPost    *model.Post

	SystemAdminUser   *model.User
	LogBuffer         *mlog.Buffer
	TestLogger        *mlog.Logger
	IncludeCacheLayer bool
	ConfigStore       *config.Store

	tempWorkspace string
}

type PostOptions func(*model.Post)

type PostPatchOptions func(patch *model.PostPatch)

func setupTestHelper(dbStore store.Store, sqlStore *sqlstore.SqlStore, sqlSettings *model.SqlSettings, searchEngine *searchengine.Broker, enterprise bool, includeCacheLayer bool,
	updateConfig func(*model.Config), options []Option, tb testing.TB,
) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "apptest")
	require.NoError(tb, err)

	configStore := config.NewTestMemoryStore()
	memoryConfig := configStore.Get()

	memoryConfig.SqlSettings = model.SafeDereference(sqlSettings)
	*memoryConfig.ServiceSettings.LicenseFileLocation = filepath.Join(tempWorkspace, "license.json")
	*memoryConfig.FileSettings.Directory = filepath.Join(tempWorkspace, "data")
	*memoryConfig.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*memoryConfig.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*memoryConfig.PluginSettings.AutomaticPrepackagedPlugins = false
	*memoryConfig.LogSettings.EnableSentry = false // disable error reporting during tests

	// Check for environment variable override for console log level (useful for debugging tests)
	consoleLevel := os.Getenv("MM_LOGSETTINGS_CONSOLELEVEL")
	if consoleLevel == "" {
		consoleLevel = mlog.LvlStdLog.Name
	}
	*memoryConfig.LogSettings.ConsoleLevel = consoleLevel

	*memoryConfig.AnnouncementSettings.AdminNoticesEnabled = false
	*memoryConfig.AnnouncementSettings.UserNoticesEnabled = false
	*memoryConfig.LogSettings.FileLocation = filepath.Join(tempWorkspace, "logs", "mattermost.log")
	if updateConfig != nil {
		updateConfig(memoryConfig)
	}

	for _, signaturePublicKeyFile := range memoryConfig.PluginSettings.SignaturePublicKeyFiles {
		var signaturePublicKey []byte
		signaturePublicKey, err = os.ReadFile(signaturePublicKeyFile)
		require.NoError(tb, err, "failed to read signature public key file %s", signaturePublicKeyFile)
		err = configStore.SetFile(signaturePublicKeyFile, signaturePublicKey)
		require.NoError(tb, err)
	}
	_, _, err = configStore.Set(memoryConfig)
	require.NoError(tb, err)

	buffer := &mlog.Buffer{}

	options = append(options, ConfigStore(configStore))
	if includeCacheLayer {
		// Adds the cache layer to the test store
		options = append(options, StoreOverrideWithCache(dbStore))
	} else {
		options = append(options, StoreOverride(dbStore))
	}

	testLogger, err := mlog.NewLogger()
	require.NoError(tb, err)
	logCfg, err := config.MloggerConfigFromLoggerConfig(&memoryConfig.LogSettings, nil, config.GetLogFileLocation)
	require.NoError(tb, err)
	err = testLogger.ConfigureTargets(logCfg, nil)
	require.NoError(tb, err)

	err = mlog.AddWriterTarget(testLogger, buffer, true, mlog.StdAll...)
	require.NoError(tb, err)

	// lock logger config so server init cannot override it during testing.
	testLogger.LockConfiguration()
	options = append(options, SetLogger(testLogger))

	s, err := NewServer(options...)
	require.NoError(tb, err)

	th := &TestHelper{
		App:               New(ServerConnector(s.Channels())),
		Context:           request.EmptyContext(testLogger),
		Server:            s,
		LogBuffer:         buffer,
		TestLogger:        testLogger,
		IncludeCacheLayer: includeCacheLayer,
		ConfigStore:       configStore,
		Store:             dbStore,
		SQLStore:          sqlStore,
		tempWorkspace:     tempWorkspace,
	}

	th.App.Srv().SetLicense(getLicense(enterprise, memoryConfig))

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 50 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.RateLimitSettings.Enable = false })
	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = "localhost:0" })

	// Support updating feature flags without resorting to os.Setenv which
	// isn't concurrently safe.
	if updateConfig != nil {
		configStore.SetReadOnlyFF(false)
		th.App.UpdateConfig(updateConfig)
	}

	err = th.Server.Start()
	require.NoError(tb, err)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	th.App.Srv().Platform().SearchEngine = searchEngine

	th.App.Srv().Store().MarkSystemRanUnitTests()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = true })

	// Disable strict password requirements for test
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PasswordSettings.MinimumLength = 5
		*cfg.PasswordSettings.Lowercase = false
		*cfg.PasswordSettings.Uppercase = false
		*cfg.PasswordSettings.Symbol = false
		*cfg.PasswordSettings.Number = false
	})

	tb.Cleanup(func() {
		if th.IncludeCacheLayer {
			// Clean all the caches
			appErr := th.App.Srv().InvalidateAllCaches()
			require.Nil(tb, appErr)
		}

		th.ShutdownApp()

		if th.tempWorkspace != "" {
			err := os.RemoveAll(th.tempWorkspace)
			require.NoError(tb, err)
		}
	})

	return th
}

func getLicense(enterprise bool, cfg *model.Config) *model.License {
	if *cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService || *cfg.ConnectedWorkspacesSettings.EnableSharedChannels {
		return model.NewTestLicenseSKU(model.LicenseShortSkuProfessional)
	}
	if enterprise {
		return model.NewTestLicense()
	}
	return nil
}

func setupStores(tb testing.TB) (store.Store, *sqlstore.SqlStore, *model.SqlSettings, *searchengine.Broker) {
	var dbStore store.Store
	var sqlStore *sqlstore.SqlStore
	var dbSettings *model.SqlSettings
	var searchEngine *searchengine.Broker
	if mainHelper.Options.RunParallel {
		dbStore, sqlStore, dbSettings, searchEngine = mainHelper.GetNewStores(tb)
		tb.Cleanup(func() {
			dbStore.Close()
		})
	} else {
		dbStore = mainHelper.GetStore()
		dbStore.DropAllTables()
		dbStore.MarkSystemRanUnitTests()
		mainHelper.PreloadMigrations()
		searchEngine = mainHelper.GetSearchEngine()
		dbSettings = mainHelper.GetSQLSettings()
		sqlStore = mainHelper.GetSQLStore()
	}

	return dbStore, sqlStore, dbSettings, searchEngine
}

func Setup(tb testing.TB, options ...Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	dbStore, sqlStore, dbSettings, searchEngine := setupStores(tb)

	return setupTestHelper(dbStore, sqlStore, dbSettings, searchEngine, false, true, nil, options, tb)
}

func SetupEnterprise(tb testing.TB, options ...Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	dbStore, sqlStore, dbSettings, searchEngine := setupStores(tb)

	return setupTestHelper(dbStore, sqlStore, dbSettings, searchEngine, true, true, nil, options, tb)
}

func SetupConfig(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	dbStore, sqlStore, dbSettings, searchEngine := setupStores(tb)

	return setupTestHelper(dbStore, sqlStore, dbSettings, searchEngine, false, true, updateConfig, nil, tb)
}

func SetupWithoutPreloadMigrations(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	return setupTestHelper(dbStore, mainHelper.GetSQLStore(), mainHelper.GetSQLSettings(), mainHelper.GetSearchEngine(), false, true, nil, nil, tb)
}

func SetupWithStoreMock(tb testing.TB) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, mainHelper.GetSQLStore(), mainHelper.GetSQLSettings(), mainHelper.GetSearchEngine(), false, false, nil, nil, tb)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)

	pluginMock := mocks.PluginStore{}
	pluginMock.On("Get", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&model.PluginKeyValue{}, nil)

	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	emptyMockStore.On("Plugin").Return(&pluginMock).Maybe()
	th.App.Srv().SetStore(&emptyMockStore)

	return th
}

func SetupEnterpriseWithStoreMock(tb testing.TB) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, mainHelper.GetSQLStore(), mainHelper.GetSQLSettings(), mainHelper.GetSearchEngine(), true, false, nil, nil, tb)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	th.App.Srv().SetStore(&emptyMockStore)
	return th
}

func SetupWithClusterMock(tb testing.TB, cluster einterfaces.ClusterInterface) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	dbStore, sqlStore, dbSettings, searchEngine := setupStores(tb)

	return setupTestHelper(dbStore, sqlStore, dbSettings, searchEngine, true, true, nil, []Option{SetCluster(cluster)}, tb)
}

func (th *TestHelper) InitBasic(tb testing.TB) *TestHelper {
	th.SystemAdminUser = th.CreateUser(tb)
	_, appErr := th.App.UpdateUserRoles(th.Context, th.SystemAdminUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(tb, appErr)
	th.SystemAdminUser, appErr = th.App.GetUser(th.SystemAdminUser.Id)
	require.Nil(tb, appErr)

	th.BasicUser = th.CreateUser(tb)
	th.BasicUser, appErr = th.App.GetUser(th.BasicUser.Id)
	require.Nil(tb, appErr)

	th.BasicUser2 = th.CreateUser(tb)
	th.BasicUser2, appErr = th.App.GetUser(th.BasicUser2.Id)
	require.Nil(tb, appErr)

	th.BasicTeam = th.CreateTeam(tb)

	th.LinkUserToTeam(tb, th.BasicUser, th.BasicTeam)
	th.LinkUserToTeam(tb, th.BasicUser2, th.BasicTeam)
	th.BasicChannel = th.CreateChannel(tb, th.BasicTeam)
	th.BasicPost = th.CreatePost(tb, th.BasicChannel)
	return th
}

func (th *TestHelper) DeleteBots(tb testing.TB) *TestHelper {
	preexistingBots, _ := th.App.GetBots(th.Context, &model.BotGetOptions{Page: 0, PerPage: 100})
	for _, bot := range preexistingBots {
		appErr := th.App.PermanentDeleteBot(th.Context, bot.UserId)
		require.Nil(tb, appErr)
	}
	return th
}

func (*TestHelper) MakeEmail() string {
	return "success_" + model.NewId() + "@simulator.amazonses.com"
}

func (th *TestHelper) CreateTeam(tb testing.TB) *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	team, err := th.App.CreateTeam(th.Context, team)
	require.Nil(tb, err)
	return team
}

func (th *TestHelper) CreateUser(tb testing.TB) *model.User {
	return th.CreateUserOrGuest(tb, false)
}

func (th *TestHelper) CreateGuest(tb testing.TB) *model.User {
	return th.CreateUserOrGuest(tb, true)
}

func (th *TestHelper) CreateUserOrGuest(tb testing.TB, guest bool) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}

	var err *model.AppError
	if guest {
		user, err = th.App.CreateGuest(th.Context, user)
		require.Nil(tb, err)
	} else {
		user, err = th.App.CreateUser(th.Context, user)
		require.Nil(tb, err)
	}
	return user
}

func (th *TestHelper) CreateBot(tb testing.TB) *model.Bot {
	id := model.NewId()

	bot := &model.Bot{
		Username:    "bot" + id,
		DisplayName: "a bot",
		Description: "bot",
		OwnerId:     th.BasicUser.Id,
	}

	bot, err := th.App.CreateBot(th.Context, bot)
	require.Nil(tb, err)
	return bot
}

type ChannelOption func(*model.Channel)

func WithShared(v bool) ChannelOption {
	return func(channel *model.Channel) {
		channel.Shared = model.NewPointer(v)
	}
}

func WithCreateAt(v int64) ChannelOption {
	return func(channel *model.Channel) {
		channel.CreateAt = *model.NewPointer(v)
	}
}

func (th *TestHelper) CreateChannel(tb testing.TB, team *model.Team, options ...ChannelOption) *model.Channel {
	return th.createChannel(tb, team, model.ChannelTypeOpen, options...)
}

func (th *TestHelper) CreatePrivateChannel(tb testing.TB, team *model.Team, options ...ChannelOption) *model.Channel {
	return th.createChannel(tb, team, model.ChannelTypePrivate, options...)
}

func (th *TestHelper) createChannel(tb testing.TB, team *model.Team, channelType model.ChannelType, options ...ChannelOption) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        "name_" + id,
		Type:        channelType,
		TeamId:      team.Id,
		CreatorId:   th.BasicUser.Id,
	}

	for _, option := range options {
		option(channel)
	}

	channel, appErr := th.App.CreateChannel(th.Context, channel, true)
	require.Nil(tb, appErr)

	if channel.IsShared() {
		id := model.NewId()
		_, err := th.App.ShareChannel(th.Context, &model.SharedChannel{
			ChannelId:        channel.Id,
			TeamId:           channel.TeamId,
			Home:             false,
			ReadOnly:         false,
			ShareName:        "shared-" + id,
			ShareDisplayName: "shared-" + id,
			CreatorId:        th.BasicUser.Id,
			RemoteId:         model.NewId(),
		})
		require.NoError(tb, err)
	}
	return channel
}

func (th *TestHelper) CreateDmChannel(tb testing.TB, user *model.User) *model.Channel {
	channel, err := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, user.Id)
	require.Nil(tb, err)
	return channel
}

func (th *TestHelper) CreateGroupChannel(tb testing.TB, user1 *model.User, user2 *model.User) *model.Channel {
	channel, err := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, user1.Id, user2.Id}, th.BasicUser.Id)
	require.Nil(tb, err)
	return channel
}

func (th *TestHelper) CreatePost(tb testing.TB, channel *model.Channel, postOptions ...PostOptions) *model.Post {
	id := model.NewId()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "message_" + id,
		CreateAt:  model.GetMillis() - 10000,
	}

	for _, option := range postOptions {
		option(post)
	}

	post, err := th.App.CreatePost(th.Context, post, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(tb, err)
	return post
}

func (th *TestHelper) CreateMessagePost(tb testing.TB, channel *model.Channel, message string) *model.Post {
	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   message,
		CreateAt:  model.GetMillis() - 10000,
	}

	post, err := th.App.CreatePost(th.Context, post, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(tb, err)
	return post
}

func (th *TestHelper) CreatePostReply(tb testing.TB, root *model.Post) *model.Post {
	id := model.NewId()
	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: root.ChannelId,
		RootId:    root.Id,
		Message:   "message_" + id,
		CreateAt:  model.GetMillis() - 10000,
	}

	ch, err := th.App.GetChannel(th.Context, root.ChannelId)
	require.Nil(tb, err)
	post, err = th.App.CreatePost(th.Context, post, ch, model.CreatePostFlags{SetOnline: true})
	require.Nil(tb, err)
	return post
}

func (th *TestHelper) LinkUserToTeam(tb testing.TB, user *model.User, team *model.Team) {
	_, err := th.App.JoinUserToTeam(th.Context, team, user, "")
	require.Nil(tb, err)
}

func (th *TestHelper) RemoveUserFromTeam(tb testing.TB, user *model.User, team *model.Team) {
	err := th.App.RemoveUserFromTeam(th.Context, team.Id, user.Id, "")
	require.Nil(tb, err)
}

func (th *TestHelper) AddUserToChannel(tb testing.TB, user *model.User, channel *model.Channel) *model.ChannelMember {
	member, err := th.App.AddUserToChannel(th.Context, user, channel, false)
	require.Nil(tb, err)
	return member
}

func (th *TestHelper) RemoveUserFromChannel(tb testing.TB, user *model.User, channel *model.Channel) *model.AppError {
	appErr := th.App.RemoveUserFromChannel(th.Context, user.Id, user.Id, channel)
	require.Nil(tb, appErr)
	return appErr
}

func (th *TestHelper) CreateRole(tb testing.TB, roleName string) *model.Role {
	role, err := th.App.CreateRole(&model.Role{Name: roleName, DisplayName: roleName, Description: roleName, Permissions: []string{}})
	require.Nil(tb, err)
	return role
}

func (th *TestHelper) CreateScheme(tb testing.TB) (*model.Scheme, []*model.Role) {
	scheme, err := th.App.CreateScheme(&model.Scheme{
		DisplayName: "Test Scheme Display Name",
		Name:        model.NewId(),
		Description: "Test scheme description",
		Scope:       model.SchemeScopeTeam,
	})
	require.Nil(tb, err)

	roleNames := []string{
		scheme.DefaultTeamAdminRole,
		scheme.DefaultTeamUserRole,
		scheme.DefaultTeamGuestRole,
		scheme.DefaultChannelAdminRole,
		scheme.DefaultChannelUserRole,
		scheme.DefaultChannelGuestRole,
	}

	var roles []*model.Role
	for _, roleName := range roleNames {
		role, err := th.App.GetRoleByName(th.Context, roleName)
		require.Nil(tb, err)
		roles = append(roles, role)
	}
	return scheme, roles
}

func (th *TestHelper) CreateGroup(tb testing.TB) *model.Group {
	id := model.NewId()
	group := &model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	}

	group, err := th.App.CreateGroup(group)
	require.Nil(tb, err)
	return group
}

func (th *TestHelper) CreateEmoji(tb testing.TB) *model.Emoji {
	emoji, err := th.App.Srv().Store().Emoji().Save(&model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewRandomString(10),
	})
	require.NoError(tb, err)
	return emoji
}

func (th *TestHelper) AddReactionToPost(tb testing.TB, post *model.Post, user *model.User, emojiName string) *model.Reaction {
	reaction, err := th.App.SaveReactionForPost(th.Context, &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: emojiName,
	})
	require.Nil(tb, err)
	return reaction
}

func (th *TestHelper) ShutdownApp() {
	done := make(chan bool)
	go func() {
		th.Server.Shutdown()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(30 * time.Second):
		// panic instead of fatal to terminate all tests in this package, otherwise the
		// still running App could spuriously fail subsequent tests.
		panic("failed to shutdown App within 30 seconds")
	}
}

func (th *TestHelper) GetSqlStore() *sqlstore.SqlStore {
	return th.SQLStore
}

func (th *TestHelper) ConfigureInbucketMail() {
	inbucket_host := os.Getenv("CI_INBUCKET_HOST")
	if inbucket_host == "" {
		inbucket_host = "localhost"
	}
	inbucket_port := os.Getenv("CI_INBUCKET_SMTP_PORT")
	if inbucket_port == "" {
		inbucket_port = "10025"
	}
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SMTPServer = inbucket_host
		*cfg.EmailSettings.SMTPPort = inbucket_port
	})
}

func (th *TestHelper) ResetRoleMigration(tb testing.TB) {
	sqlStore := th.SQLStore
	_, err := sqlStore.GetMaster().Exec("DELETE from Roles")
	require.NoError(tb, err)

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	_, err = sqlStore.GetMaster().Exec("DELETE from Systems where Name = ?", model.AdvancedPermissionsMigrationKey)
	require.NoError(tb, err)
}

func (th *TestHelper) ResetEmojisMigration(tb testing.TB) {
	sqlStore := th.SQLStore
	_, err := sqlStore.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' create_emojis', '') WHERE builtin=True")
	require.NoError(tb, err)

	_, err = sqlStore.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' delete_emojis', '') WHERE builtin=True")
	require.NoError(tb, err)

	_, err = sqlStore.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' delete_others_emojis', '') WHERE builtin=True")
	require.NoError(tb, err)

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	_, err = sqlStore.GetMaster().Exec("DELETE from Systems where Name = ?", EmojisPermissionsMigrationKey)
	require.NoError(tb, err)
}

func (th *TestHelper) CheckTeamCount(t *testing.T, expected int64) {
	teamCount, err := th.App.Srv().Store().Team().AnalyticsTeamCount(nil)
	require.NoError(t, err, "Failed to get team count.")
	require.Equalf(t, teamCount, expected, "Unexpected number of teams. Expected: %v, found: %v", expected, teamCount)
}

func (th *TestHelper) CheckChannelsCount(t *testing.T, expected int64) {
	count, err := th.App.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypeOpen)
	require.NoError(t, err, "Failed to get channel count.")
	require.Equalf(t, count, expected, "Unexpected number of channels. Expected: %v, found: %v", expected, count)
}

func (th *TestHelper) SetupTeamScheme(tb testing.TB) *model.Scheme {
	scheme, err := th.App.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	})
	require.Nil(tb, err)
	return scheme
}

func (th *TestHelper) SetupChannelScheme(tb testing.TB) *model.Scheme {
	scheme, err := th.App.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	})
	require.Nil(tb, err)
	return scheme
}

func (th *TestHelper) SetupPluginAPI() *PluginAPI {
	manifest := &model.Manifest{
		Id: "pluginid",
	}

	return NewPluginAPI(th.App, th.Context, manifest)
}

func (th *TestHelper) RemovePermissionFromRole(tb testing.TB, permission string, roleName string) {
	role, err1 := th.App.GetRoleByName(th.Context, roleName)
	require.Nil(tb, err1)

	var newPermissions []string
	for _, p := range role.Permissions {
		if p != permission {
			newPermissions = append(newPermissions, p)
		}
	}

	if strings.Join(role.Permissions, " ") == strings.Join(newPermissions, " ") {
		return
	}

	role.Permissions = newPermissions

	_, err2 := th.App.UpdateRole(role)
	require.Nil(tb, err2)
}

func (th *TestHelper) AddPermissionToRole(tb testing.TB, permission string, roleName string) {
	role, appErr := th.App.GetRoleByName(th.Context, roleName)
	require.Nil(tb, appErr)

	if slices.Contains(role.Permissions, permission) {
		return
	}

	role.Permissions = append(role.Permissions, permission)

	_, err2 := th.App.UpdateRole(role)
	require.Nil(tb, err2)
}

func (th *TestHelper) CreateFileInfo(tb testing.TB, userId, postId, channelId string) *model.FileInfo {
	fileInfo := &model.FileInfo{
		Id:        model.NewId(),
		CreatorId: userId,
		PostId:    postId,
		ChannelId: channelId,
		CreateAt:  model.GetMillis(),
		Name:      model.NewRandomString(10),
		Path:      model.NewRandomString(50),
	}

	createdFileInfo, err := th.App.Srv().Store().FileInfo().Save(th.Context, fileInfo)
	require.NoError(tb, err)

	return createdFileInfo
}

func (th *TestHelper) PostPatch(tb testing.TB, post *model.Post, message string, options ...PostPatchOptions) *model.Post {
	postPatch := &model.PostPatch{
		Message: model.NewPointer(message),
	}
	for _, optionFunc := range options {
		optionFunc(postPatch)
	}

	updatedPost, appErr := th.App.PatchPost(th.Context, post.Id, postPatch, nil)
	require.Nil(tb, appErr)

	return updatedPost
}

// This function is copy of storetest/NewTestId
// NewTestId is used for testing as a replacement for model.NewId(). It is a [A-Z0-9] string 26
// characters long. It replaces every odd character with a digit.
func NewTestId() string {
	newId := []byte(model.NewId())

	for i := 1; i < len(newId); i = i + 2 {
		newId[i] = 48 + newId[i-1]%10
	}

	return string(newId)
}

func (th *TestHelper) NewPluginAPI(manifest *model.Manifest) plugin.API {
	return th.App.NewPluginAPI(th.Context, manifest)
}

func decodeJSON[T any](tb testing.TB, o any, result *T) *T {
	var r io.Reader
	switch v := o.(type) {
	case string:
		r = strings.NewReader(v)
	case []byte:
		r = bytes.NewReader(v)
	case io.Reader:
		r = v
	default:
		require.Fail(tb, fmt.Sprintf("Unable to decode JSON from %T (%v)", v, v))
	}

	err := json.NewDecoder(r).Decode(result)
	require.NoError(tb, err)

	return result
}

func (th *TestHelper) Parallel(t *testing.T) {
	mainHelper.Parallel(t)
}
