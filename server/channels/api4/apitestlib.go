// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	s3 "github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/channels/web"
	"github.com/mattermost/mattermost/server/v8/channels/wsapi"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type TestHelper struct {
	App         *app.App
	Server      *app.Server
	ConfigStore *config.Store
	Store       store.Store

	Context              *request.Context
	Client               *model.Client4
	BasicUser            *model.User
	BasicUser2           *model.User
	TeamAdminUser        *model.User
	BasicTeam            *model.Team
	BasicChannel         *model.Channel
	BasicPrivateChannel  *model.Channel
	BasicPrivateChannel2 *model.Channel
	BasicDeletedChannel  *model.Channel
	BasicChannel2        *model.Channel
	BasicPost            *model.Post
	Group                *model.Group

	SystemAdminClient *model.Client4
	SystemAdminUser   *model.User
	tempWorkspace     string

	SystemManagerClient *model.Client4
	SystemManagerUser   *model.User

	LocalClient *model.Client4

	IncludeCacheLayer bool

	LogBuffer  *mlog.Buffer
	TestLogger *mlog.Logger
}

var mainHelper *testlib.MainHelper

func SetMainHelper(mh *testlib.MainHelper) {
	mainHelper = mh
}

func setupTestHelper(tb testing.TB, dbStore store.Store, sqlSettings *model.SqlSettings, searchEngine *searchengine.Broker, enterprise bool, includeCache bool,
	updateConfig func(*model.Config), options []app.Option,
) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "apptest")
	require.NoError(tb, err)

	memoryStore, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{IgnoreEnvironmentOverrides: true})
	require.NoError(tb, err, "failed to initialize memory store")

	memoryConfig := &model.Config{
		SqlSettings: model.SafeDereference(sqlSettings),
	}
	memoryConfig.SetDefaults()
	*memoryConfig.ServiceSettings.LicenseFileLocation = filepath.Join(tempWorkspace, "license.json")
	*memoryConfig.FileSettings.Directory = filepath.Join(tempWorkspace, "data")
	*memoryConfig.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*memoryConfig.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*memoryConfig.FileSettings.Directory = filepath.Join(tempWorkspace, "data")
	*memoryConfig.ServiceSettings.EnableLocalMode = true
	*memoryConfig.ServiceSettings.LocalModeSocketLocation = filepath.Join(tempWorkspace, "mattermost_local.sock")
	*memoryConfig.LogSettings.EnableSentry = false // disable error reporting during tests

	// Check for environment variable override for console log level (useful for debugging tests)
	consoleLevel := os.Getenv("MM_LOGSETTINGS_CONSOLELEVEL")
	if consoleLevel == "" {
		consoleLevel = mlog.LvlStdLog.Name
	}
	*memoryConfig.LogSettings.ConsoleLevel = consoleLevel
	*memoryConfig.LogSettings.FileLocation = filepath.Join(tempWorkspace, "logs", "mattermost.log")
	*memoryConfig.AnnouncementSettings.AdminNoticesEnabled = false
	*memoryConfig.AnnouncementSettings.UserNoticesEnabled = false
	*memoryConfig.PluginSettings.AutomaticPrepackagedPlugins = false
	// Enabling Redis with Postgres.
	if *memoryConfig.SqlSettings.DriverName == model.DatabaseDriverPostgres && !mainHelper.Options.RunParallel {
		*memoryConfig.CacheSettings.CacheType = model.CacheTypeRedis
		redisHost := "localhost"
		if os.Getenv("IS_CI") == "true" {
			redisHost = "redis"
		}
		*memoryConfig.CacheSettings.RedisAddress = redisHost + ":6379"
		*memoryConfig.CacheSettings.DisableClientCache = true
		*memoryConfig.CacheSettings.RedisDB = 0
		*memoryConfig.CacheSettings.RedisCachePrefix = model.NewId()
		options = append(options, app.ForceEnableRedis())
	}
	if updateConfig != nil {
		updateConfig(memoryConfig)
	}
	err = memoryStore.Set(memoryConfig)
	require.NoError(tb, err)
	for _, signaturePublicKeyFile := range memoryConfig.PluginSettings.SignaturePublicKeyFiles {
		var signaturePublicKey []byte
		signaturePublicKey, err = os.ReadFile(signaturePublicKeyFile)
		require.NoError(tb, err, "failed to read signature public key file %s", signaturePublicKeyFile)
		err = memoryStore.SetFile(signaturePublicKeyFile, signaturePublicKey)
		require.NoError(tb, err)
	}

	configStore, err := config.NewStoreFromBacking(memoryStore, nil, false)
	require.NoError(tb, err)

	options = append(options, app.ConfigStore(configStore))
	if includeCache {
		// Adds the cache layer to the test store
		options = append(options, app.StoreOverrideWithCache(dbStore))
	} else {
		options = append(options, app.StoreOverride(dbStore))
	}

	buffer := &mlog.Buffer{}

	testLogger, err := mlog.NewLogger()
	require.NoError(tb, err)
	logCfg, err := config.MloggerConfigFromLoggerConfig(&memoryConfig.LogSettings, nil, config.GetLogFileLocation)
	require.NoError(tb, err)
	err = testLogger.ConfigureTargets(logCfg, nil)
	require.NoError(tb, err, "failed to configure test logger")
	err = mlog.AddWriterTarget(testLogger, buffer, true, mlog.StdAll...)
	require.NoError(tb, err, "failed to add writer target to test logger")
	// lock logger config so server init cannot override it during testing.
	testLogger.LockConfiguration()
	options = append(options, app.SetLogger(testLogger))

	s, err := app.NewServer(options...)
	require.NoError(tb, err)

	th := &TestHelper{
		App:               app.New(app.ServerConnector(s.Channels())),
		Server:            s,
		Context:           request.EmptyContext(testLogger),
		ConfigStore:       configStore,
		IncludeCacheLayer: includeCache,
		TestLogger:        testLogger,
		LogBuffer:         buffer,
		Store:             dbStore,
		tempWorkspace:     tempWorkspace,
	}

	if searchEngine != nil {
		th.App.SetSearchEngine(searchEngine)
	}

	th.App.Srv().SetLicense(getLicense(enterprise, memoryConfig))

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.MaxUsersPerTeam = 50
		*cfg.RateLimitSettings.Enable = false
		*cfg.EmailSettings.SendEmailNotifications = true
		*cfg.ServiceSettings.SiteURL = ""

		// Disable sniffing, otherwise elastic client fails to connect to docker node
		// More details: https://github.com/olivere/elastic/wiki/Sniffing
		*cfg.ElasticsearchSettings.Sniff = false

		*cfg.TeamSettings.EnableOpenServer = true

		// Disable strict password requirements for test
		*cfg.PasswordSettings.MinimumLength = 5
		*cfg.PasswordSettings.Lowercase = false
		*cfg.PasswordSettings.Uppercase = false
		*cfg.PasswordSettings.Symbol = false
		*cfg.PasswordSettings.Number = false

		*cfg.ServiceSettings.ListenAddress = "localhost:0"
	})

	// Support updating feature flags without resorting to os.Setenv which
	// isn't concurrently safe.
	if updateConfig != nil {
		configStore.SetReadOnlyFF(false)
		th.App.UpdateConfig(updateConfig)
	}

	err = th.Server.Start()
	require.NoError(tb, err)

	_, err = Init(th.App.Srv())
	require.NoError(tb, err)
	web.New(th.App.Srv())
	wsapi.Init(th.App.Srv())

	th.Client = th.CreateClient()
	th.SystemAdminClient = th.CreateClient()
	th.SystemManagerClient = th.CreateClient()

	// Verify handling of the supported true/false values by randomizing on each run.
	trueValues := []string{"1", "t", "T", "TRUE", "true", "True"}
	falseValues := []string{"0", "f", "F", "FALSE", "false", "False"}
	trueString := trueValues[rand.Intn(len(trueValues))]
	falseString := falseValues[rand.Intn(len(falseValues))]
	testLogger.Debug("Configured Client4 bool string values", mlog.String("true", trueString), mlog.String("false", falseString))
	th.Client.SetBoolString(true, trueString)
	th.Client.SetBoolString(false, falseString)

	th.LocalClient = th.CreateLocalClient(*memoryConfig.ServiceSettings.LocalModeSocketLocation)

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

func setupStores(tb testing.TB) (store.Store, *model.SqlSettings, *searchengine.Broker) {
	var dbStore store.Store
	var dbSettings *model.SqlSettings
	var searchEngine *searchengine.Broker
	if mainHelper.Options.RunParallel {
		dbStore, _, dbSettings, searchEngine = mainHelper.GetNewStores(tb)
		tb.Cleanup(func() {
			dbStore.Close()
		})
	} else {
		dbStore = mainHelper.GetStore()
		dbStore.DropAllTables()
		dbStore.MarkSystemRanUnitTests()
		mainHelper.PreloadMigrations()
		searchEngine = mainHelper.GetSearchEngine()
		dbSettings = mainHelper.Settings
	}

	return dbStore, dbSettings, searchEngine
}

func SetupEnterprise(tb testing.TB, options ...app.Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	removeSpuriousErrors := func(config *model.Config) {
		// If not set, you will receive an unactionable error in the console
		*config.ServiceSettings.SiteURL = "http://localhost:8065"
	}

	dbStore, dbSettings, searchEngine := setupStores(tb)
	th := setupTestHelper(tb, dbStore, dbSettings, searchEngine, true, true, removeSpuriousErrors, options)
	th.InitLogin(tb)

	return th
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore, dbSettings, searchEngine := setupStores(tb)
	th := setupTestHelper(tb, dbStore, dbSettings, searchEngine, false, true, nil, nil)
	th.InitLogin(tb)

	return th
}

func SetupAndApplyConfigBeforeLogin(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore, dbSettings, searchEngine := setupStores(tb)
	th := setupTestHelper(tb, dbStore, dbSettings, searchEngine, false, true, nil, nil)
	th.App.UpdateConfig(updateConfig)
	th.InitLogin(tb)

	return th
}

func SetupConfig(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore, dbSettings, searchEngine := setupStores(tb)
	th := setupTestHelper(tb, dbStore, dbSettings, searchEngine, false, true, updateConfig, nil)
	th.InitLogin(tb)

	return th
}

func SetupConfigWithStoreMock(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	th := setupTestHelper(tb, testlib.GetMockStoreForSetupFunctions(), nil, nil, false, false, updateConfig, nil)
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

func SetupWithStoreMock(tb testing.TB) *TestHelper {
	th := setupTestHelper(tb, testlib.GetMockStoreForSetupFunctions(), nil, nil, false, false, nil, nil)
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

func SetupEnterpriseWithStoreMock(tb testing.TB, options ...app.Option) *TestHelper {
	removeSpuriousErrors := func(config *model.Config) {
		// If not set, you will receive an unactionable error in the console
		*config.ServiceSettings.SiteURL = "http://localhost:8065"
	}

	th := setupTestHelper(tb, testlib.GetMockStoreForSetupFunctions(), nil, nil, true, false, removeSpuriousErrors, options)
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

func SetupWithServerOptions(tb testing.TB, options []app.Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore, dbSettings, searchEngine := setupStores(tb)
	th := setupTestHelper(tb, dbStore, dbSettings, searchEngine, false, true, nil, options)
	th.InitLogin(tb)

	return th
}

func SetupEnterpriseWithServerOptions(tb testing.TB, options []app.Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore, dbSettings, searchEngine := setupStores(tb)
	th := setupTestHelper(tb, dbStore, dbSettings, searchEngine, true, true, nil, options)
	th.InitLogin(tb)

	return th
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

func (th *TestHelper) RemoveLicense(tb testing.TB) {
	err := th.App.Srv().RemoveLicense()
	require.Nil(tb, err)
}

func closeBody(r *http.Response) {
	if r.Body != nil {
		_, _ = io.Copy(io.Discard, r.Body)
		_ = r.Body.Close()
	}
}

func (th *TestHelper) InitLogin(tb testing.TB) *TestHelper {
	th.waitForConnectivity(tb)

	th.SystemAdminUser = th.CreateUser(tb)
	_, appErr := th.App.UpdateUserRoles(th.Context, th.SystemAdminUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(tb, appErr)
	th.SystemAdminUser, appErr = th.App.GetUser(th.SystemAdminUser.Id)
	require.Nil(tb, appErr)

	th.SystemManagerUser = th.CreateUser(tb)
	_, appErr = th.App.UpdateUserRoles(th.Context, th.SystemManagerUser.Id, model.SystemUserRoleId+" "+model.SystemManagerRoleId, false)
	require.Nil(tb, appErr)
	th.SystemManagerUser, appErr = th.App.GetUser(th.SystemManagerUser.Id)
	require.Nil(tb, appErr)

	th.TeamAdminUser = th.CreateUser(tb)
	_, appErr = th.App.UpdateUserRoles(th.Context, th.TeamAdminUser.Id, model.SystemUserRoleId, false)
	require.Nil(tb, appErr)
	th.TeamAdminUser, appErr = th.App.GetUser(th.TeamAdminUser.Id)
	require.Nil(tb, appErr)

	th.BasicUser = th.CreateUser(tb)
	th.BasicUser, appErr = th.App.GetUser(th.BasicUser.Id)
	require.Nil(tb, appErr)

	th.BasicUser2 = th.CreateUser(tb)
	th.BasicUser2, appErr = th.App.GetUser(th.BasicUser2.Id)
	require.Nil(tb, appErr)

	// restore non hashed password for login
	th.SystemAdminUser.Password = "Pa$$word11"
	th.TeamAdminUser.Password = "Pa$$word11"
	th.BasicUser.Password = "Pa$$word11"
	th.BasicUser2.Password = "Pa$$word11"
	th.SystemManagerUser.Password = "Pa$$word11"

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		th.LoginSystemAdmin(tb)
		wg.Done()
	}()
	go func() {
		th.LoginTeamAdmin(tb)
		wg.Done()
	}()

	wg.Wait()

	return th
}

func (th *TestHelper) InitBasic(tb testing.TB) *TestHelper {
	th.BasicTeam = th.CreateTeam(tb)
	th.BasicChannel = th.CreatePublicChannel(tb)
	th.BasicPrivateChannel = th.CreatePrivateChannel(tb)
	th.BasicPrivateChannel2 = th.CreatePrivateChannel(tb)
	th.BasicDeletedChannel = th.CreatePublicChannel(tb)
	th.BasicChannel2 = th.CreatePublicChannel(tb)
	th.BasicPost = th.CreatePost(tb)
	th.LinkUserToTeam(tb, th.BasicUser, th.BasicTeam)
	th.LinkUserToTeam(tb, th.BasicUser2, th.BasicTeam)
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicChannel, false)
	require.Nil(tb, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(tb, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicChannel2, false)
	require.Nil(tb, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel2, false)
	require.Nil(tb, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicPrivateChannel, false)
	require.Nil(tb, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicPrivateChannel, false)
	require.Nil(tb, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicDeletedChannel, false)
	require.Nil(tb, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicDeletedChannel, false)
	require.Nil(tb, appErr)
	_, appErr = th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId, false)
	require.Nil(tb, appErr)
	_, err := th.Client.DeleteChannel(context.Background(), th.BasicDeletedChannel.Id)
	require.NoError(tb, err)
	th.LoginBasic(tb)
	th.Group = th.CreateGroup(tb)

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

func (th *TestHelper) waitForConnectivity(tb testing.TB) {
	for range 1000 {
		conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%v", th.App.Srv().ListenAddr.Port))
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(time.Millisecond * 20)
	}
	tb.Fatal("unable to connect")
}

func (th *TestHelper) CreateClient() *model.Client4 {
	return model.NewAPIv4Client(fmt.Sprintf("http://localhost:%v", th.App.Srv().ListenAddr.Port))
}

// ToDo: maybe move this to NewAPIv4SocketClient and reuse it in mmctl
func (th *TestHelper) CreateLocalClient(socketPath string) *model.Client4 {
	httpClient := &http.Client{
		Transport: &http.Transport{
			Dial: func(network, addr string) (net.Conn, error) {
				return net.Dial("unix", socketPath)
			},
		},
	}

	return &model.Client4{
		APIURL:     "http://_" + model.APIURLSuffix,
		HTTPClient: httpClient,
	}
}

func (th *TestHelper) createConnectedWebSocketClient(tb testing.TB, client *model.Client4) *model.WebSocketClient {
	tb.Helper()
	wsClient, err := th.CreateWebSocketClientWithClient(client)
	require.NoError(tb, err)
	require.NotNil(tb, wsClient, "webSocketClient should not be nil")
	wsClient.Listen()
	tb.Cleanup(wsClient.Close)

	// Ensure WS is connected. First event should be hello message.
	select {
	case ev := <-wsClient.EventChannel:
		require.Equal(tb, model.WebsocketEventHello, ev.EventType())
	case <-time.After(5 * time.Second):
		require.FailNow(tb, "hello event was not received within the timeout period")
	}

	return wsClient
}

func (th *TestHelper) CreateConnectedWebSocketClient(tb testing.TB) *model.WebSocketClient {
	return th.createConnectedWebSocketClient(tb, th.Client)
}

func (th *TestHelper) CreateConnectedWebSocketClientWithClient(tb testing.TB, client *model.Client4) *model.WebSocketClient {
	return th.createConnectedWebSocketClient(tb, client)
}

func (th *TestHelper) CreateWebSocketClient() (*model.WebSocketClient, error) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port), th.Client.AuthToken)
}

func (th *TestHelper) CreateReliableWebSocketClient(connID string, seqNo int) (*model.WebSocketClient, error) {
	return model.NewReliableWebSocketClientWithDialer(websocket.DefaultDialer, fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port), th.Client.AuthToken, connID, seqNo, true)
}

func (th *TestHelper) CreateWebSocketClientWithClient(client *model.Client4) (*model.WebSocketClient, error) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port), client.AuthToken)
}

func (th *TestHelper) CreateBotWithSystemAdminClient(tb testing.TB) *model.Bot {
	return th.CreateBotWithClient(tb, th.SystemAdminClient)
}

func (th *TestHelper) CreateBotWithClient(tb testing.TB, client *model.Client4) *model.Bot {
	bot := &model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "bot",
	}

	rbot, _, err := client.CreateBot(context.Background(), bot)
	require.NoError(tb, err)
	return rbot
}

func (th *TestHelper) CreateUser(tb testing.TB) *model.User {
	return th.CreateUserWithClient(tb, th.Client)
}

func (th *TestHelper) CreateGuestUser(tb testing.TB) *model.User {
	tb.Helper()

	guestUser := th.CreateUserWithClient(tb, th.Client)

	_, appErr := th.App.UpdateUserRoles(th.Context, guestUser.Id, model.SystemGuestRoleId, false)
	require.Nil(tb, appErr)

	return guestUser
}

func (th *TestHelper) CreateTeam(tb testing.TB) *model.Team {
	return th.CreateTeamWithClient(tb, th.Client)
}

func (th *TestHelper) CreateTeamWithClient(tb testing.TB, client *model.Client4) *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        GenerateTestTeamName(),
		Email:       th.GenerateTestEmail(),
		Type:        model.TeamOpen,
	}

	rteam, _, err := client.CreateTeam(context.Background(), team)
	require.NoError(tb, err)
	return rteam
}

func (th *TestHelper) CreateUserWithClient(tb testing.TB, client *model.Client4) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:     th.GenerateTestEmail(),
		Username:  GenerateTestUsername(),
		Nickname:  "nn_" + id,
		FirstName: "f_" + id,
		LastName:  "l_" + id,
		Password:  "Pa$$word11",
	}

	ruser, _, err := client.CreateUser(context.Background(), user)
	require.NoError(tb, err)

	ruser.Password = "Pa$$word11"
	_, err = th.App.Srv().Store().User().VerifyEmail(ruser.Id, ruser.Email)
	if err != nil {
		return nil
	}
	return ruser
}

func (th *TestHelper) CreateUserWithAuth(tb testing.TB, authService string) *model.User {
	id := model.NewId()
	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		EmailVerified: true,
		AuthService:   authService,
	}
	user, err := th.App.CreateUser(th.Context, user)
	require.Nil(tb, err)
	return user
}

// CreateGuestAndClient creates a guest user, adds them to the basic
// team, basic channel and basic private channel, and generates an API
// client ready to use
func (th *TestHelper) CreateGuestAndClient(tb testing.TB) (*model.User, *model.Client4) {
	tb.Helper()
	id := model.NewId()

	// create a guest user and add it to the basic team and public/private channels
	guest, cgErr := th.App.CreateGuest(th.Context, &model.User{
		Email:         "test_guest" + id + "@sample.com",
		Username:      "guest_" + id,
		Nickname:      "guest_" + id,
		Password:      "Password1",
		EmailVerified: true,
	})
	require.Nil(tb, cgErr)

	_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, guest.Id, th.SystemAdminUser.Id)
	require.Nil(tb, appErr)
	th.AddUserToChannel(tb, guest, th.BasicChannel)
	th.AddUserToChannel(tb, guest, th.BasicPrivateChannel)

	// create a client and login the guest
	guestClient := th.CreateClient()
	_, _, err := guestClient.Login(context.Background(), guest.Email, "Password1")
	require.NoError(tb, err)

	return guest, guestClient
}

func (th *TestHelper) SetupLdapConfig() {
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
		*cfg.LdapSettings.Enable = true
		*cfg.LdapSettings.EnableSync = true
		*cfg.LdapSettings.LdapServer = "dockerhost"
		*cfg.LdapSettings.BaseDN = "dc=mm,dc=test,dc=com"
		*cfg.LdapSettings.BindUsername = "cn=admin,dc=mm,dc=test,dc=com"
		*cfg.LdapSettings.BindPassword = "mostest"
		*cfg.LdapSettings.FirstNameAttribute = "cn"
		*cfg.LdapSettings.LastNameAttribute = "sn"
		*cfg.LdapSettings.NicknameAttribute = "cn"
		*cfg.LdapSettings.EmailAttribute = "mail"
		*cfg.LdapSettings.UsernameAttribute = "uid"
		*cfg.LdapSettings.IdAttribute = "cn"
		*cfg.LdapSettings.LoginIdAttribute = "uid"
		*cfg.LdapSettings.SkipCertificateVerification = true
		*cfg.LdapSettings.GroupFilter = ""
		*cfg.LdapSettings.GroupDisplayNameAttribute = "cN"
		*cfg.LdapSettings.GroupIdAttribute = "entRyUuId"
		*cfg.LdapSettings.MaxPageSize = 0
	})
	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))
}

func (th *TestHelper) SetupSamlConfig() {
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.SamlSettings.Enable = true
		*cfg.SamlSettings.Verify = false
		*cfg.SamlSettings.Encrypt = false
		*cfg.SamlSettings.IdpURL = "https://does.notmatter.example"
		*cfg.SamlSettings.IdpDescriptorURL = "https://localhost/adfs/services/trust"
		*cfg.SamlSettings.AssertionConsumerServiceURL = "https://localhost/login/sso/saml"
		*cfg.SamlSettings.ServiceProviderIdentifier = "https://localhost/login/sso/saml"
		*cfg.SamlSettings.IdpCertificateFile = app.SamlIdpCertificateName
		*cfg.SamlSettings.PrivateKeyFile = app.SamlPrivateKeyName
		*cfg.SamlSettings.PublicCertificateFile = app.SamlPublicCertificateName
		*cfg.SamlSettings.EmailAttribute = "Email"
		*cfg.SamlSettings.UsernameAttribute = "Username"
		*cfg.SamlSettings.FirstNameAttribute = "FirstName"
		*cfg.SamlSettings.LastNameAttribute = "LastName"
		*cfg.SamlSettings.NicknameAttribute = ""
		*cfg.SamlSettings.PositionAttribute = ""
		*cfg.SamlSettings.LocaleAttribute = ""
		*cfg.SamlSettings.SignatureAlgorithm = model.SamlSettingsSignatureAlgorithmSha256
		*cfg.SamlSettings.CanonicalAlgorithm = model.SamlSettingsCanonicalAlgorithmC14n11
	})
	th.App.Srv().SetLicense(model.NewTestLicense("saml"))
}

func (th *TestHelper) CreatePublicChannel(tb testing.TB) *model.Channel {
	return th.CreateChannelWithClient(tb, th.Client, model.ChannelTypeOpen)
}

func (th *TestHelper) CreatePrivateChannel(tb testing.TB) *model.Channel {
	return th.CreateChannelWithClient(tb, th.Client, model.ChannelTypePrivate)
}

func (th *TestHelper) CreateChannelWithClient(tb testing.TB, client *model.Client4, channelType model.ChannelType) *model.Channel {
	return th.CreateChannelWithClientAndTeam(tb, client, channelType, th.BasicTeam.Id)
}

func (th *TestHelper) CreateChannelWithClientAndTeam(tb testing.TB, client *model.Client4, channelType model.ChannelType, teamID string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        GenerateTestChannelName(),
		Type:        channelType,
		TeamId:      teamID,
	}

	rchannel, _, err := client.CreateChannel(context.Background(), channel)
	require.NoError(tb, err)
	return rchannel
}

func (th *TestHelper) CreatePost(tb testing.TB) *model.Post {
	return th.CreatePostWithClient(tb, th.Client, th.BasicChannel)
}

func (th *TestHelper) CreatePinnedPost(tb testing.TB) *model.Post {
	return th.CreatePinnedPostWithClient(tb, th.Client, th.BasicChannel)
}

func (th *TestHelper) CreateMessagePost(tb testing.TB, message string) *model.Post {
	return th.CreateMessagePostWithClient(tb, th.Client, th.BasicChannel, message)
}

func (th *TestHelper) CreatePostWithFiles(tb testing.TB, files ...*model.FileInfo) *model.Post {
	return th.CreatePostWithFilesWithClient(tb, th.Client, th.BasicChannel, files...)
}

func (th *TestHelper) CreatePostInChannelWithFiles(tb testing.TB, channel *model.Channel, files ...*model.FileInfo) *model.Post {
	return th.CreatePostWithFilesWithClient(tb, th.Client, channel, files...)
}

func (th *TestHelper) CreatePostWithFilesWithClient(tb testing.TB, client *model.Client4, channel *model.Channel, files ...*model.FileInfo) *model.Post {
	var fileIds model.StringArray
	for i := range files {
		fileIds = append(fileIds, files[i].Id)
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + model.NewId(),
		FileIds:   fileIds,
	}

	rpost, _, err := client.CreatePost(context.Background(), post)
	require.NoError(tb, err)
	return rpost
}

func (th *TestHelper) CreatePostWithClient(tb testing.TB, client *model.Client4, channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + id,
	}

	rpost, _, err := client.CreatePost(context.Background(), post)
	require.NoError(tb, err)
	return rpost
}

func (th *TestHelper) CreatePinnedPostWithClient(tb testing.TB, client *model.Client4, channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + id,
		IsPinned:  true,
	}

	rpost, _, err := client.CreatePost(context.Background(), post)
	require.NoError(tb, err)
	return rpost
}

func (th *TestHelper) CreateMessagePostWithClient(tb testing.TB, client *model.Client4, channel *model.Channel, message string) *model.Post {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
	}

	rpost, _, err := client.CreatePost(context.Background(), post)
	require.NoError(tb, err)
	return rpost
}

func (th *TestHelper) CreateMessagePostNoClient(tb testing.TB, channel *model.Channel, message string, createAtTime int64) *model.Post {
	post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   message,
		CreateAt:  createAtTime,
	})
	require.NoError(tb, err)

	return post
}

func (th *TestHelper) CreateDmChannel(tb testing.TB, user *model.User) *model.Channel {
	channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, user.Id)
	require.Nil(tb, appErr)
	return channel
}

func (th *TestHelper) PatchChannelModerationsForMembers(tb testing.TB, channelId, name string, val bool) {
	patch := []*model.ChannelModerationPatch{{
		Name:  &name,
		Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(val)},
	}}

	channel, err := th.App.GetChannel(th.Context, channelId)
	require.Nil(tb, err)

	_, err = th.App.PatchChannelModerationsForChannel(th.Context, channel, patch)
	require.Nil(tb, err)
}

func (th *TestHelper) LoginBasic(tb testing.TB) {
	th.LoginBasicWithClient(tb, th.Client)
}

func (th *TestHelper) LoginBasic2(tb testing.TB) {
	th.LoginBasic2WithClient(tb, th.Client)
}

func (th *TestHelper) LoginTeamAdmin(tb testing.TB) {
	th.LoginTeamAdminWithClient(tb, th.Client)
}

func (th *TestHelper) LoginSystemAdmin(tb testing.TB) {
	th.LoginSystemAdminWithClient(tb, th.SystemAdminClient)
}

func (th *TestHelper) LoginSystemManager(tb testing.TB) {
	th.LoginSystemManagerWithClient(tb, th.SystemManagerClient)
}

func (th *TestHelper) LoginBasicWithClient(tb testing.TB, client *model.Client4) {
	_, _, err := client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(tb, err)
}

func (th *TestHelper) LoginBasic2WithClient(tb testing.TB, client *model.Client4) {
	_, _, err := client.Login(context.Background(), th.BasicUser2.Email, th.BasicUser2.Password)
	require.NoError(tb, err)
}

func (th *TestHelper) LoginTeamAdminWithClient(tb testing.TB, client *model.Client4) {
	_, _, err := client.Login(context.Background(), th.TeamAdminUser.Email, th.TeamAdminUser.Password)
	require.NoError(tb, err)
}

func (th *TestHelper) LoginSystemManagerWithClient(tb testing.TB, client *model.Client4) {
	_, _, err := client.Login(context.Background(), th.SystemManagerUser.Email, th.SystemManagerUser.Password)
	require.NoError(tb, err)
}

func (th *TestHelper) LoginSystemAdminWithClient(tb testing.TB, client *model.Client4) {
	_, _, err := client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
	require.NoError(tb, err)
}

func (th *TestHelper) UpdateActiveUser(tb testing.TB, user *model.User, active bool) {
	_, err := th.App.UpdateActive(th.Context, user, active)
	require.Nil(tb, err)
}

func (th *TestHelper) LinkUserToTeam(tb testing.TB, user *model.User, team *model.Team) {
	_, err := th.App.JoinUserToTeam(th.Context, team, user, "")
	require.Nil(tb, err)
}

func (th *TestHelper) UnlinkUserFromTeam(tb testing.TB, user *model.User, team *model.Team) {
	err := th.App.RemoveUserFromTeam(th.Context, team.Id, user.Id, "")
	require.Nil(tb, err)
}

func (th *TestHelper) AddUserToChannel(tb testing.TB, user *model.User, channel *model.Channel) *model.ChannelMember {
	member, err := th.App.AddUserToChannel(th.Context, user, channel, false)
	require.Nil(tb, err)
	return member
}

func (th *TestHelper) RemoveUserFromChannel(tb testing.TB, user *model.User, channel *model.Channel) {
	err := th.App.RemoveUserFromChannel(th.Context, user.Id, "", channel)
	require.Nil(tb, err)
}

func (th *TestHelper) GenerateTestEmail() string {
	if *th.App.Config().EmailSettings.SMTPServer != "localhost" && os.Getenv("CI_INBUCKET_PORT") == "" {
		return strings.ToLower("success+" + model.NewId() + "@simulator.amazonses.com")
	}
	return strings.ToLower(model.NewId() + "@localhost")
}

func (th *TestHelper) CreateGroup(tb testing.TB) *model.Group {
	id := model.NewId()
	group := &model.Group{
		Name:        model.NewPointer("n-" + id),
		DisplayName: "dn_" + id,
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewPointer("ri_" + model.NewId()),
	}

	group, err := th.App.CreateGroup(group)
	require.Nil(tb, err)
	return group
}

// TestForSystemAdminAndLocal runs a test function for both
// SystemAdmin and Local clients. Several endpoints work in the same
// way when used by a fully privileged user and through the local
// mode, so this helper facilitates checking both
func (th *TestHelper) TestForSystemAdminAndLocal(t *testing.T, f func(*testing.T, *model.Client4), name ...string) {
	var testName string
	if len(name) > 0 {
		testName = name[0] + "/"
	}

	t.Run(testName+"SystemAdminClient", func(t *testing.T) {
		f(t, th.SystemAdminClient)
	})

	t.Run(testName+"LocalClient", func(t *testing.T) {
		f(t, th.LocalClient)
	})
}

// TestForAllClients runs a test function for all the clients
// registered in the TestHelper
func (th *TestHelper) TestForAllClients(t *testing.T, f func(*testing.T, *model.Client4), name ...string) {
	var testName string
	if len(name) > 0 {
		testName = name[0] + "/"
	}

	t.Run(testName+"Client", func(t *testing.T) {
		f(t, th.Client)
	})

	t.Run(testName+"SystemAdminClient", func(t *testing.T) {
		f(t, th.SystemAdminClient)
	})

	t.Run(testName+"LocalClient", func(t *testing.T) {
		f(t, th.LocalClient)
	})
}

func GenerateTestUsername() string {
	return "fakeuser" + model.NewRandomString(10)
}

func GenerateTestTeamName() string {
	return "faketeam" + model.NewRandomString(6)
}

func GenerateTestChannelName() string {
	return "fakechannel" + model.NewRandomString(10)
}

func GenerateTestAppName() string {
	return "fakeoauthapp" + model.NewRandomString(10)
}

func GenerateTestID() string {
	return model.NewId()
}

func CheckUserSanitization(tb testing.TB, user *model.User) {
	tb.Helper()

	require.Equal(tb, "", user.Password, "password wasn't blank")
	require.Empty(tb, user.AuthData, "auth data wasn't blank")
	require.Equal(tb, "", user.MfaSecret, "mfa secret wasn't blank")
}

func CheckEtag(tb testing.TB, data any, resp *model.Response) {
	tb.Helper()

	require.Empty(tb, data)
	require.Equal(tb, http.StatusNotModified, resp.StatusCode, "wrong status code for etag")
}

func checkHTTPStatus(tb testing.TB, resp *model.Response, expectedStatus int) {
	tb.Helper()

	require.NotNilf(tb, resp, "Unexpected nil response, expected http status:%v", expectedStatus)
	require.Equalf(tb, expectedStatus, resp.StatusCode, "Expected http status:%v, got %v", expectedStatus, resp.StatusCode)
}

func CheckOKStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusOK)
}

func CheckCreatedStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusCreated)
}

func CheckNoContentStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusNoContent)
}

func CheckForbiddenStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusForbidden)
}

func CheckUnauthorizedStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusUnauthorized)
}

func CheckNotFoundStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusNotFound)
}

func CheckBadRequestStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusBadRequest)
}

func CheckUnprocessableEntityStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusUnprocessableEntity)
}

func CheckNotImplementedStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusNotImplemented)
}

func CheckRequestEntityTooLargeStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusRequestEntityTooLarge)
}

func CheckInternalErrorStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusInternalServerError)
}

func CheckServiceUnavailableStatus(tb testing.TB, resp *model.Response) {
	tb.Helper()
	checkHTTPStatus(tb, resp, http.StatusServiceUnavailable)
}

func CheckErrorID(tb testing.TB, err error, errorId string) {
	tb.Helper()

	require.Error(tb, err, "should have errored with id: %s", errorId)

	var appError *model.AppError
	ok := errors.As(err, &appError)
	require.True(tb, ok, "should have been a model.AppError")

	require.Equalf(tb, errorId, appError.Id, "incorrect error id, actual: %s, expected: %s", appError.Id, errorId)
}

func CheckErrorMessage(tb testing.TB, err error, message string) {
	tb.Helper()

	require.Error(tb, err, "should have errored with message: %s", message)

	var appError *model.AppError
	ok := errors.As(err, &appError)
	require.True(tb, ok, "should have been a model.AppError")

	require.Equalf(tb, message, appError.Message, "incorrect error message, actual: %s, expected: %s", appError.Id, message)
}

// Similar to s3.New() but allows initialization of signature v2 or signature v4 client.
// If signV2 input is false, function always returns signature v4.
//
// Additionally this function also takes a user defined region, if set
// disables automatic region lookup.
func s3New(endpoint, accessKey, secretKey string, secure bool, signV2 bool, region string) (*s3.Client, error) {
	var creds *credentials.Credentials
	if signV2 {
		creds = credentials.NewStatic(accessKey, secretKey, "", credentials.SignatureV2)
	} else {
		creds = credentials.NewStatic(accessKey, secretKey, "", credentials.SignatureV4)
	}

	opts := s3.Options{
		Creds:  creds,
		Secure: secure,
		Region: region,
	}
	return s3.New(endpoint, &opts)
}

func (th *TestHelper) cleanupTestFile(info *model.FileInfo) error {
	cfg := th.App.Config()
	if *cfg.FileSettings.DriverName == model.ImageDriverS3 {
		endpoint := *cfg.FileSettings.AmazonS3Endpoint
		accessKey := *cfg.FileSettings.AmazonS3AccessKeyId
		secretKey := *cfg.FileSettings.AmazonS3SecretAccessKey
		secure := *cfg.FileSettings.AmazonS3SSL
		signV2 := *cfg.FileSettings.AmazonS3SignV2
		region := *cfg.FileSettings.AmazonS3Region
		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return err
		}
		bucket := *cfg.FileSettings.AmazonS3Bucket
		if err := s3Clnt.RemoveObject(context.Background(), bucket, info.Path, s3.RemoveObjectOptions{}); err != nil {
			return err
		}

		if info.ThumbnailPath != "" {
			if err := s3Clnt.RemoveObject(context.Background(), bucket, info.ThumbnailPath, s3.RemoveObjectOptions{}); err != nil {
				return err
			}
		}

		if info.PreviewPath != "" {
			if err := s3Clnt.RemoveObject(context.Background(), bucket, info.PreviewPath, s3.RemoveObjectOptions{}); err != nil {
				return err
			}
		}
	} else if *cfg.FileSettings.DriverName == model.ImageDriverLocal {
		if err := os.Remove(*cfg.FileSettings.Directory + info.Path); err != nil {
			return err
		}

		if info.ThumbnailPath != "" {
			if err := os.Remove(*cfg.FileSettings.Directory + info.ThumbnailPath); err != nil {
				return err
			}
		}

		if info.PreviewPath != "" {
			if err := os.Remove(*cfg.FileSettings.Directory + info.PreviewPath); err != nil {
				return err
			}
		}
	}

	return nil
}

func (th *TestHelper) MakeUserChannelAdmin(tb testing.TB, user *model.User, channel *model.Channel) {
	cm, err := th.App.Srv().Store().Channel().GetMember(th.Context, channel.Id, user.Id)
	require.NoError(tb, err)
	cm.SchemeAdmin = true
	_, err = th.App.Srv().Store().Channel().UpdateMember(th.Context, cm)
	require.NoError(tb, err)
}

func (th *TestHelper) UpdateUserToTeamAdmin(tb testing.TB, user *model.User, team *model.Team) {
	tm, err := th.App.Srv().Store().Team().GetMember(th.Context, team.Id, user.Id)
	require.NoError(tb, err)
	tm.SchemeAdmin = true
	_, err = th.App.Srv().Store().Team().UpdateMember(th.Context, tm)
	require.NoError(tb, err)
}

func (th *TestHelper) UpdateUserToNonTeamAdmin(tb testing.TB, user *model.User, team *model.Team) {
	tm, err := th.App.Srv().Store().Team().GetMember(th.Context, team.Id, user.Id)
	require.NoError(tb, err)
	tm.SchemeAdmin = false
	_, err = th.App.Srv().Store().Team().UpdateMember(th.Context, tm)
	require.NoError(tb, err)
}

func (th *TestHelper) SaveDefaultRolePermissions(tb testing.TB) map[string][]string {
	results := make(map[string][]string)

	for _, roleName := range []string{
		"system_user",
		"system_admin",
		"team_user",
		"team_admin",
		"channel_user",
		"channel_admin",
	} {
		role, err1 := th.App.GetRoleByName(th.Context, roleName)
		require.Nil(tb, err1)

		results[roleName] = role.Permissions
	}
	return results
}

func (th *TestHelper) RestoreDefaultRolePermissions(tb testing.TB, data map[string][]string) {
	for roleName, permissions := range data {
		role, err1 := th.App.GetRoleByName(th.Context, roleName)
		require.Nil(tb, err1)

		if strings.Join(role.Permissions, " ") == strings.Join(permissions, " ") {
			continue
		}

		role.Permissions = permissions

		_, err2 := th.App.UpdateRole(role)
		require.Nil(tb, err2)
	}
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
	role, err1 := th.App.GetRoleByName(th.Context, roleName)
	require.Nil(tb, err1)

	if slices.Contains(role.Permissions, permission) {
		return
	}

	role.Permissions = append(role.Permissions, permission)

	_, err2 := th.App.UpdateRole(role)
	require.Nil(tb, err2)
}

func (th *TestHelper) SetupTeamScheme(tb testing.TB) *model.Scheme {
	return th.SetupScheme(tb, model.SchemeScopeTeam)
}

func (th *TestHelper) SetupChannelScheme(tb testing.TB) *model.Scheme {
	return th.SetupScheme(tb, model.SchemeScopeChannel)
}

func (th *TestHelper) SetupScheme(tb testing.TB, scope string) *model.Scheme {
	scheme, err := th.App.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       scope,
	})
	require.Nil(tb, err)
	return scheme
}

func (th *TestHelper) Parallel(t *testing.T) {
	mainHelper.Parallel(t)
}
