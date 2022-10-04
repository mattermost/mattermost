// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	graphql "github.com/graph-gophers/graphql-go"
	s3 "github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/v6/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v6/testlib"
	"github.com/mattermost/mattermost-server/v6/web"
	"github.com/mattermost/mattermost-server/v6/wsapi"
)

type TestHelper struct {
	App         *app.App
	Server      *app.Server
	ConfigStore *config.Store

	Context              *request.Context
	Client               *model.Client4
	GraphQLClient        *graphQLClient
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

	TestLogger *mlog.Logger
}

var mainHelper *testlib.MainHelper

func SetMainHelper(mh *testlib.MainHelper) {
	mainHelper = mh
}

func setupTestHelper(dbStore store.Store, searchEngine *searchengine.Broker, enterprise bool, includeCache bool,
	updateConfig func(*model.Config), options []app.Option) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "apptest")
	if err != nil {
		panic(err)
	}

	memoryStore, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{IgnoreEnvironmentOverrides: true})
	if err != nil {
		panic("failed to initialize memory store: " + err.Error())
	}

	memoryConfig := &model.Config{}
	memoryConfig.SetDefaults()
	*memoryConfig.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*memoryConfig.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	memoryConfig.ServiceSettings.EnableLocalMode = model.NewBool(true)
	*memoryConfig.ServiceSettings.LocalModeSocketLocation = filepath.Join(tempWorkspace, "mattermost_local.sock")
	*memoryConfig.AnnouncementSettings.AdminNoticesEnabled = false
	*memoryConfig.AnnouncementSettings.UserNoticesEnabled = false
	*memoryConfig.PluginSettings.AutomaticPrepackagedPlugins = false
	if updateConfig != nil {
		updateConfig(memoryConfig)
	}
	memoryStore.Set(memoryConfig)

	configStore, err := config.NewStoreFromBacking(memoryStore, nil, false)
	if err != nil {
		panic(err)
	}

	options = append(options, app.ConfigStore(configStore))
	if includeCache {
		// Adds the cache layer to the test store
		options = append(options, app.StoreOverride(func(s *app.Server) store.Store {
			lcl, err2 := localcachelayer.NewLocalCacheLayer(dbStore, s.GetMetrics(), s.Cluster, s.CacheProvider)
			if err2 != nil {
				panic(err2)
			}
			return lcl
		}))
	} else {
		options = append(options, app.StoreOverride(dbStore))
	}

	testLogger, _ := mlog.NewLogger()
	logCfg, _ := config.MloggerConfigFromLoggerConfig(&memoryConfig.LogSettings, nil, config.GetLogFileLocation)
	if errCfg := testLogger.ConfigureTargets(logCfg, nil); errCfg != nil {
		panic("failed to configure test logger: " + errCfg.Error())
	}
	// lock logger config so server init cannot override it during testing.
	testLogger.LockConfiguration()
	options = append(options, app.SetLogger(testLogger))

	s, err := app.NewServer(options...)
	if err != nil {
		panic(err)
	}

	th := &TestHelper{
		App:               app.New(app.ServerConnector(s.Channels())),
		Server:            s,
		ConfigStore:       configStore,
		IncludeCacheLayer: includeCache,
		Context:           request.EmptyContext(testLogger),
		TestLogger:        testLogger,
	}
	th.Context.SetLogger(testLogger)

	if s.SearchEngine != nil && s.SearchEngine.BleveEngine != nil && searchEngine != nil {
		searchEngine.BleveEngine = s.SearchEngine.BleveEngine
	}

	if searchEngine != nil {
		th.App.SetSearchEngine(searchEngine)
	}

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

		*cfg.ServiceSettings.ListenAddress = ":0"
	})
	if err := th.Server.Start(); err != nil {
		panic(err)
	}

	Init(th.App.Srv())
	web.New(th.App.Srv())
	wsapi.Init(th.App.Srv())

	if enterprise {
		th.App.Srv().SetLicense(model.NewTestLicense())
	} else {
		th.App.Srv().SetLicense(nil)
	}

	th.Client = th.CreateClient()
	th.GraphQLClient = newGraphQLClient(fmt.Sprintf("http://localhost:%v", th.App.Srv().ListenAddr.Port))
	th.SystemAdminClient = th.CreateClient()
	th.SystemManagerClient = th.CreateClient()

	// Verify handling of the supported true/false values by randomizing on each run.
	rand.Seed(time.Now().UTC().UnixNano())
	trueValues := []string{"1", "t", "T", "TRUE", "true", "True"}
	falseValues := []string{"0", "f", "F", "FALSE", "false", "False"}
	trueString := trueValues[rand.Intn(len(trueValues))]
	falseString := falseValues[rand.Intn(len(falseValues))]
	mlog.Debug("Configured Client4 bool string values", mlog.String("true", trueString), mlog.String("false", falseString))
	th.Client.SetBoolString(true, trueString)
	th.Client.SetBoolString(false, falseString)

	th.LocalClient = th.CreateLocalClient(*memoryConfig.ServiceSettings.LocalModeSocketLocation)

	if th.tempWorkspace == "" {
		th.tempWorkspace = tempWorkspace
	}

	return th
}

func SetupEnterprise(tb testing.TB, options ...app.Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()
	searchEngine := mainHelper.GetSearchEngine()
	th := setupTestHelper(dbStore, searchEngine, true, true, nil, options)
	th.InitLogin()
	return th
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()
	searchEngine := mainHelper.GetSearchEngine()
	th := setupTestHelper(dbStore, searchEngine, false, true, nil, nil)
	th.InitLogin()
	return th
}

func SetupAndApplyConfigBeforeLogin(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()
	searchEngine := mainHelper.GetSearchEngine()
	th := setupTestHelper(dbStore, searchEngine, false, true, nil, nil)
	th.App.UpdateConfig(updateConfig)
	th.InitLogin()
	return th
}

func SetupConfig(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	searchEngine := mainHelper.GetSearchEngine()
	th := setupTestHelper(dbStore, searchEngine, false, true, updateConfig, nil)
	th.InitLogin()
	return th
}

func SetupConfigWithStoreMock(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	th := setupTestHelper(testlib.GetMockStoreForSetupFunctions(), nil, false, false, updateConfig, nil)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	th.App.Srv().Store = &emptyMockStore
	return th
}

func SetupWithStoreMock(tb testing.TB) *TestHelper {
	th := setupTestHelper(testlib.GetMockStoreForSetupFunctions(), nil, false, false, nil, nil)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	th.App.Srv().Store = &emptyMockStore
	return th
}

func SetupEnterpriseWithStoreMock(tb testing.TB, options ...app.Option) *TestHelper {
	th := setupTestHelper(testlib.GetMockStoreForSetupFunctions(), nil, true, false, nil, options)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	th.App.Srv().Store = &emptyMockStore
	return th
}

func SetupWithServerOptions(tb testing.TB, options []app.Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	if mainHelper == nil {
		tb.SkipNow()
	}

	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()
	searchEngine := mainHelper.GetSearchEngine()
	th := setupTestHelper(dbStore, searchEngine, false, true, nil, options)
	th.InitLogin()
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

func (th *TestHelper) TearDown() {
	if th.IncludeCacheLayer {
		// Clean all the caches
		th.App.Srv().InvalidateAllCaches()
	}
	th.ShutdownApp()
}

func closeBody(r *http.Response) {
	if r.Body != nil {
		_, _ = io.Copy(io.Discard, r.Body)
		_ = r.Body.Close()
	}
}

var initBasicOnce sync.Once
var userCache struct {
	SystemAdminUser   *model.User
	SystemManagerUser *model.User
	TeamAdminUser     *model.User
	BasicUser         *model.User
	BasicUser2        *model.User
}

func (th *TestHelper) InitLogin() *TestHelper {
	th.waitForConnectivity()

	// create users once and cache them because password hashing is slow
	initBasicOnce.Do(func() {
		th.SystemAdminUser = th.CreateUser()
		th.App.UpdateUserRoles(th.Context, th.SystemAdminUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
		th.SystemAdminUser, _ = th.App.GetUser(th.SystemAdminUser.Id)
		userCache.SystemAdminUser = th.SystemAdminUser.DeepCopy()

		th.SystemManagerUser = th.CreateUser()
		th.App.UpdateUserRoles(th.Context, th.SystemManagerUser.Id, model.SystemUserRoleId+" "+model.SystemManagerRoleId, false)
		th.SystemManagerUser, _ = th.App.GetUser(th.SystemManagerUser.Id)
		userCache.SystemManagerUser = th.SystemManagerUser.DeepCopy()

		th.TeamAdminUser = th.CreateUser()
		th.App.UpdateUserRoles(th.Context, th.TeamAdminUser.Id, model.SystemUserRoleId, false)
		th.TeamAdminUser, _ = th.App.GetUser(th.TeamAdminUser.Id)
		userCache.TeamAdminUser = th.TeamAdminUser.DeepCopy()

		th.BasicUser = th.CreateUser()
		th.BasicUser, _ = th.App.GetUser(th.BasicUser.Id)
		userCache.BasicUser = th.BasicUser.DeepCopy()

		th.BasicUser2 = th.CreateUser()
		th.BasicUser2, _ = th.App.GetUser(th.BasicUser2.Id)
		userCache.BasicUser2 = th.BasicUser2.DeepCopy()
	})
	// restore cached users
	th.SystemAdminUser = userCache.SystemAdminUser.DeepCopy()
	th.SystemManagerUser = userCache.SystemManagerUser.DeepCopy()
	th.TeamAdminUser = userCache.TeamAdminUser.DeepCopy()
	th.BasicUser = userCache.BasicUser.DeepCopy()
	th.BasicUser2 = userCache.BasicUser2.DeepCopy()

	users := []*model.User{th.SystemAdminUser, th.TeamAdminUser, th.BasicUser, th.BasicUser2, th.SystemManagerUser}
	mainHelper.GetSQLStore().User().InsertUsers(users)

	// restore non hashed password for login
	th.SystemAdminUser.Password = "Pa$$word11"
	th.TeamAdminUser.Password = "Pa$$word11"
	th.BasicUser.Password = "Pa$$word11"
	th.BasicUser2.Password = "Pa$$word11"
	th.SystemManagerUser.Password = "Pa$$word11"

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		th.LoginSystemAdmin()
		wg.Done()
	}()
	go func() {
		th.LoginTeamAdmin()
		wg.Done()
	}()
	wg.Wait()
	return th
}

func (th *TestHelper) InitBasic() *TestHelper {
	th.BasicTeam = th.CreateTeam()
	th.BasicChannel = th.CreatePublicChannel()
	th.BasicPrivateChannel = th.CreatePrivateChannel()
	th.BasicPrivateChannel2 = th.CreatePrivateChannel()
	th.BasicDeletedChannel = th.CreatePublicChannel()
	th.BasicChannel2 = th.CreatePublicChannel()
	th.BasicPost = th.CreatePost()
	th.LinkUserToTeam(th.BasicUser, th.BasicTeam)
	th.LinkUserToTeam(th.BasicUser2, th.BasicTeam)
	th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicChannel, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicChannel2, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel2, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicPrivateChannel, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicPrivateChannel, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicDeletedChannel, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicDeletedChannel, false)
	th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId, false)
	th.Client.DeleteChannel(th.BasicDeletedChannel.Id)
	th.LoginBasic()
	th.Group = th.CreateGroup()

	return th
}

func (th *TestHelper) waitForConnectivity() {
	for i := 0; i < 1000; i++ {
		conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%v", th.App.Srv().ListenAddr.Port))
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(time.Millisecond * 20)
	}
	panic("unable to connect")
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

func (th *TestHelper) CreateWebSocketClient() (*model.WebSocketClient, error) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port), th.Client.AuthToken)
}

func (th *TestHelper) CreateReliableWebSocketClient(connID string, seqNo int) (*model.WebSocketClient, error) {
	return model.NewReliableWebSocketClientWithDialer(websocket.DefaultDialer, fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port), th.Client.AuthToken, connID, seqNo, true)
}

func (th *TestHelper) CreateWebSocketSystemAdminClient() (*model.WebSocketClient, error) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port), th.SystemAdminClient.AuthToken)
}

func (th *TestHelper) CreateWebSocketClientWithClient(client *model.Client4) (*model.WebSocketClient, error) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port), client.AuthToken)
}

func (th *TestHelper) CreateBotWithSystemAdminClient() *model.Bot {
	return th.CreateBotWithClient((th.SystemAdminClient))
}

func (th *TestHelper) CreateBotWithClient(client *model.Client4) *model.Bot {
	bot := &model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "bot",
	}

	rbot, _, err := client.CreateBot(bot)
	if err != nil {
		panic(err)
	}
	return rbot
}

func (th *TestHelper) CreateUser() *model.User {
	return th.CreateUserWithClient(th.Client)
}

func (th *TestHelper) CreateTeam() *model.Team {
	return th.CreateTeamWithClient(th.Client)
}

func (th *TestHelper) CreateTeamWithClient(client *model.Client4) *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        GenerateTestTeamName(),
		Email:       th.GenerateTestEmail(),
		Type:        model.TeamOpen,
	}

	rteam, _, err := client.CreateTeam(team)
	if err != nil {
		panic(err)
	}
	return rteam
}

func (th *TestHelper) CreateUserWithClient(client *model.Client4) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:     th.GenerateTestEmail(),
		Username:  GenerateTestUsername(),
		Nickname:  "nn_" + id,
		FirstName: "f_" + id,
		LastName:  "l_" + id,
		Password:  "Pa$$word11",
	}

	ruser, _, err := client.CreateUser(user)
	if err != nil {
		panic(err)
	}

	ruser.Password = "Pa$$word11"
	_, err = th.App.Srv().Store.User().VerifyEmail(ruser.Id, ruser.Email)
	if err != nil {
		return nil
	}
	return ruser
}

func (th *TestHelper) CreateUserWithAuth(authService string) *model.User {
	id := model.NewId()
	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		EmailVerified: true,
		AuthService:   authService,
	}
	user, err := th.App.CreateUser(th.Context, user)
	if err != nil {
		panic(err)
	}
	return user
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

func (th *TestHelper) CreatePublicChannel() *model.Channel {
	return th.CreateChannelWithClient(th.Client, model.ChannelTypeOpen)
}

func (th *TestHelper) CreatePrivateChannel() *model.Channel {
	return th.CreateChannelWithClient(th.Client, model.ChannelTypePrivate)
}

func (th *TestHelper) CreateChannelWithClient(client *model.Client4, channelType model.ChannelType) *model.Channel {
	return th.CreateChannelWithClientAndTeam(client, channelType, th.BasicTeam.Id)
}

func (th *TestHelper) CreateChannelWithClientAndTeam(client *model.Client4, channelType model.ChannelType, teamId string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        GenerateTestChannelName(),
		Type:        channelType,
		TeamId:      teamId,
	}

	rchannel, _, err := client.CreateChannel(channel)
	if err != nil {
		panic(err)
	}
	return rchannel
}

func (th *TestHelper) CreatePost() *model.Post {
	return th.CreatePostWithClient(th.Client, th.BasicChannel)
}

func (th *TestHelper) CreatePinnedPost() *model.Post {
	return th.CreatePinnedPostWithClient(th.Client, th.BasicChannel)
}

func (th *TestHelper) CreateMessagePost(message string) *model.Post {
	return th.CreateMessagePostWithClient(th.Client, th.BasicChannel, message)
}

func (th *TestHelper) CreatePostWithFiles(files ...*model.FileInfo) *model.Post {
	return th.CreatePostWithFilesWithClient(th.Client, th.BasicChannel, files...)
}

func (th *TestHelper) CreatePostInChannelWithFiles(channel *model.Channel, files ...*model.FileInfo) *model.Post {
	return th.CreatePostWithFilesWithClient(th.Client, channel, files...)
}

func (th *TestHelper) CreatePostWithFilesWithClient(client *model.Client4, channel *model.Channel, files ...*model.FileInfo) *model.Post {
	var fileIds model.StringArray
	for i := range files {
		fileIds = append(fileIds, files[i].Id)
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + model.NewId(),
		FileIds:   fileIds,
	}

	rpost, _, err := client.CreatePost(post)
	if err != nil {
		panic(err)
	}
	return rpost
}

func (th *TestHelper) CreatePostWithClient(client *model.Client4, channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + id,
	}

	rpost, _, err := client.CreatePost(post)
	if err != nil {
		panic(err)
	}
	return rpost
}

func (th *TestHelper) CreatePinnedPostWithClient(client *model.Client4, channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + id,
		IsPinned:  true,
	}

	rpost, _, err := client.CreatePost(post)
	if err != nil {
		panic(err)
	}
	return rpost
}

func (th *TestHelper) CreateMessagePostWithClient(client *model.Client4, channel *model.Channel, message string) *model.Post {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
	}

	rpost, _, err := client.CreatePost(post)
	if err != nil {
		panic(err)
	}
	return rpost
}

func (th *TestHelper) CreateMessagePostNoClient(channel *model.Channel, message string, createAtTime int64) *model.Post {
	post, err := th.App.Srv().Store.Post().Save(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   message,
		CreateAt:  createAtTime,
	})

	if err != nil {
		panic(err)
	}

	return post
}

func (th *TestHelper) CreateDmChannel(user *model.User) *model.Channel {
	var err *model.AppError
	var channel *model.Channel
	if channel, err = th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, user.Id); err != nil {
		panic(err)
	}
	return channel
}

func (th *TestHelper) LoginBasic() {
	th.LoginBasicWithClient(th.Client)
	if os.Getenv("MM_FEATUREFLAGS_GRAPHQL") == "true" {
		th.LoginBasicWithGraphQL()
	}
}

func (th *TestHelper) LoginBasic2() {
	th.LoginBasic2WithClient(th.Client)
	if os.Getenv("MM_FEATUREFLAGS_GRAPHQL") == "true" {
		th.LoginBasicWithGraphQL()
	}
}

func (th *TestHelper) LoginTeamAdmin() {
	th.LoginTeamAdminWithClient(th.Client)
}

func (th *TestHelper) LoginSystemAdmin() {
	th.LoginSystemAdminWithClient(th.SystemAdminClient)
}

func (th *TestHelper) LoginSystemManager() {
	th.LoginSystemManagerWithClient(th.SystemManagerClient)
}

func (th *TestHelper) LoginBasicWithClient(client *model.Client4) {
	_, _, err := client.Login(th.BasicUser.Email, th.BasicUser.Password)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) LoginBasicWithGraphQL() {
	_, _, err := th.GraphQLClient.login(th.BasicUser.Email, th.BasicUser.Password)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) LoginBasic2WithClient(client *model.Client4) {
	_, _, err := client.Login(th.BasicUser2.Email, th.BasicUser2.Password)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) LoginTeamAdminWithClient(client *model.Client4) {
	_, _, err := client.Login(th.TeamAdminUser.Email, th.TeamAdminUser.Password)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) LoginSystemManagerWithClient(client *model.Client4) {
	_, _, err := client.Login(th.SystemManagerUser.Email, th.SystemManagerUser.Password)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) LoginSystemAdminWithClient(client *model.Client4) {
	_, _, err := client.Login(th.SystemAdminUser.Email, th.SystemAdminUser.Password)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) UpdateActiveUser(user *model.User, active bool) {
	_, err := th.App.UpdateActive(th.Context, user, active)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) LinkUserToTeam(user *model.User, team *model.Team) {
	_, err := th.App.JoinUserToTeam(th.Context, team, user, "")
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) UnlinkUserFromTeam(user *model.User, team *model.Team) {
	err := th.App.RemoveUserFromTeam(th.Context, team.Id, user.Id, "")
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) AddUserToChannel(user *model.User, channel *model.Channel) *model.ChannelMember {
	member, err := th.App.AddUserToChannel(th.Context, user, channel, false)
	if err != nil {
		panic(err)
	}
	return member
}

func (th *TestHelper) RemoveUserFromChannel(user *model.User, channel *model.Channel) {
	err := th.App.RemoveUserFromChannel(th.Context, user.Id, "", channel)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) GenerateTestEmail() string {
	if *th.App.Config().EmailSettings.SMTPServer != "localhost" && os.Getenv("CI_INBUCKET_PORT") == "" {
		return strings.ToLower("success+" + model.NewId() + "@simulator.amazonses.com")
	}
	return strings.ToLower(model.NewId() + "@localhost")
}

func (th *TestHelper) CreateGroup() *model.Group {
	id := model.NewId()
	group := &model.Group{
		Name:        model.NewString("n-" + id),
		DisplayName: "dn_" + id,
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString("ri_" + model.NewId()),
	}

	group, err := th.App.CreateGroup(group)
	if err != nil {
		panic(err)
	}
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

func GenerateTestId() string {
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

func CheckStartsWith(tb testing.TB, value, prefix, message string) {
	tb.Helper()

	require.True(tb, strings.HasPrefix(value, prefix), message, value)
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

func (th *TestHelper) MakeUserChannelAdmin(user *model.User, channel *model.Channel) {
	if cm, err := th.App.Srv().Store.Channel().GetMember(context.Background(), channel.Id, user.Id); err == nil {
		cm.SchemeAdmin = true
		if _, err = th.App.Srv().Store.Channel().UpdateMember(cm); err != nil {
			panic(err)
		}
	} else {
		panic(err)
	}
}

func (th *TestHelper) UpdateUserToTeamAdmin(user *model.User, team *model.Team) {
	if tm, err := th.App.Srv().Store.Team().GetMember(context.Background(), team.Id, user.Id); err == nil {
		tm.SchemeAdmin = true
		if _, err = th.App.Srv().Store.Team().UpdateMember(tm); err != nil {
			panic(err)
		}
	} else {
		panic(err)
	}
}

func (th *TestHelper) UpdateUserToNonTeamAdmin(user *model.User, team *model.Team) {
	if tm, err := th.App.Srv().Store.Team().GetMember(context.Background(), team.Id, user.Id); err == nil {
		tm.SchemeAdmin = false
		if _, err = th.App.Srv().Store.Team().UpdateMember(tm); err != nil {
			panic(err)
		}
	} else {
		panic(err)
	}
}

func (th *TestHelper) SaveDefaultRolePermissions() map[string][]string {
	results := make(map[string][]string)

	for _, roleName := range []string{
		"system_user",
		"system_admin",
		"team_user",
		"team_admin",
		"channel_user",
		"channel_admin",
	} {
		role, err1 := th.App.GetRoleByName(context.Background(), roleName)
		if err1 != nil {
			panic(err1)
		}

		results[roleName] = role.Permissions
	}
	return results
}

func (th *TestHelper) RestoreDefaultRolePermissions(data map[string][]string) {
	for roleName, permissions := range data {
		role, err1 := th.App.GetRoleByName(context.Background(), roleName)
		if err1 != nil {
			panic(err1)
		}

		if strings.Join(role.Permissions, " ") == strings.Join(permissions, " ") {
			continue
		}

		role.Permissions = permissions

		_, err2 := th.App.UpdateRole(role)
		if err2 != nil {
			panic(err2)
		}
	}
}

func (th *TestHelper) RemovePermissionFromRole(permission string, roleName string) {
	role, err1 := th.App.GetRoleByName(context.Background(), roleName)
	if err1 != nil {
		panic(err1)
	}

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
	if err2 != nil {
		panic(err2)
	}
}

func (th *TestHelper) AddPermissionToRole(permission string, roleName string) {
	role, err1 := th.App.GetRoleByName(context.Background(), roleName)
	if err1 != nil {
		panic(err1)
	}

	for _, existingPermission := range role.Permissions {
		if existingPermission == permission {
			return
		}
	}

	role.Permissions = append(role.Permissions, permission)

	_, err2 := th.App.UpdateRole(role)
	if err2 != nil {
		panic(err2)
	}
}

func (th *TestHelper) SetupTeamScheme() *model.Scheme {
	return th.SetupScheme(model.SchemeScopeTeam)
}

func (th *TestHelper) GetMockCloudSubscription(productId string, freeTrial string) *model.Subscription {
	deliquencySince := int64(2000000000)

	return &model.Subscription{
		ID:              "MySubscriptionID",
		CustomerID:      "MyCustomer",
		ProductID:       productId,
		AddOns:          []string{},
		StartAt:         1000000000,
		EndAt:           2000000000,
		CreateAt:        1000000000,
		Seats:           10,
		IsFreeTrial:     freeTrial,
		DNS:             "some.dns.server",
		IsPaidTier:      "false",
		TrialEndAt:      2000000000,
		LastInvoice:     &model.Invoice{},
		DelinquentSince: &deliquencySince,
	}
}

func (th *TestHelper) GetMockCloudProducts() []*model.Product {
	return []*model.Product{
		{
			ID:                "prod_test1",
			Name:              "name",
			Description:       "description",
			PricePerSeat:      10,
			SKU:               "starter",
			PriceID:           "price_id",
			Family:            "family",
			RecurringInterval: "recurring_interval",
			BillingScheme:     "billing_scheme",
		},
		{
			ID:                "prod_test2",
			Name:              "name2",
			Description:       "description2",
			PricePerSeat:      100,
			SKU:               "professional",
			PriceID:           "price_id2",
			Family:            "family2",
			RecurringInterval: "recurring_interval2",
			BillingScheme:     "billing_scheme2",
		},
		{
			ID:                "prod_test3",
			Name:              "name3",
			Description:       "description3",
			PricePerSeat:      1000,
			SKU:               "enterprise",
			PriceID:           "price_id3",
			Family:            "family3",
			RecurringInterval: "recurring_interval3",
			BillingScheme:     "billing_scheme3",
		},
	}
}

func (th *TestHelper) SetupChannelScheme() *model.Scheme {
	return th.SetupScheme(model.SchemeScopeChannel)
}

func (th *TestHelper) SetupScheme(scope string) *model.Scheme {
	scheme, err := th.App.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       scope,
	})
	if err != nil {
		panic(err)
	}
	return scheme
}

func (th *TestHelper) MakeGraphQLRequest(input *graphQLInput) (*graphql.Response, error) {
	url := fmt.Sprintf("http://localhost:%v", th.App.Srv().ListenAddr.Port) + model.APIURLSuffixV5 + "/graphql"

	buf, err := json.Marshal(input)
	if err != nil {
		panic(err)
	}

	resp, err := th.GraphQLClient.doAPIRequest("POST", url, bytes.NewReader(buf), map[string]string{})
	if err != nil {
		panic(err)
	}
	defer closeBody(resp)

	var gqlResp *graphql.Response
	err = json.NewDecoder(resp.Body).Decode(&gqlResp)
	return gqlResp, err
}
