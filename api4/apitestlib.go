// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"io/ioutil"
	"math/rand"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v5/testlib"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/web"
	"github.com/mattermost/mattermost-server/v5/wsapi"

	s3 "github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/stretchr/testify/require"
)

type TestHelper struct {
	App         *app.App
	Server      *app.Server
	ConfigStore *config.Store

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

	LocalClient *model.Client4

	IncludeCacheLayer bool
}

var mainHelper *testlib.MainHelper

func SetMainHelper(mh *testlib.MainHelper) {
	mainHelper = mh
}

func setupTestHelper(dbStore store.Store, searchEngine *searchengine.Broker, enterprise bool, includeCache bool, updateConfig func(*model.Config)) *TestHelper {
	tempWorkspace, err := ioutil.TempDir("", "apptest")
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
	if updateConfig != nil {
		updateConfig(memoryConfig)
	}
	memoryStore.Set(memoryConfig)

	configStore, err := config.NewStoreFromBacking(memoryStore)
	if err != nil {
		panic(err)
	}

	var options []app.Option
	options = append(options, app.ConfigStore(configStore))
	options = append(options, app.StoreOverride(dbStore))

	s, err := app.NewServer(options...)
	if err != nil {
		panic(err)
	}
	if includeCache {
		// Adds the cache layer to the test store
		s.Store = localcachelayer.NewLocalCacheLayer(s.Store, s.Metrics, s.Cluster, s.CacheProvider)
	}

	th := &TestHelper{
		App:               app.New(app.ServerConnector(s)),
		Server:            s,
		ConfigStore:       configStore,
		IncludeCacheLayer: includeCache,
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
	})
	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	if err := th.Server.Start(); err != nil {
		panic(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })
	Init(th.Server, th.Server.AppOptions, th.App.Srv().Router)
	InitLocal(th.Server, th.Server.AppOptions, th.App.Srv().LocalRouter)
	web.New(th.Server, th.Server.AppOptions, th.App.Srv().Router)
	wsapi.Init(th.App.Srv())
	th.App.DoAppMigrations()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = true })

	// Disable strict password requirements for test
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PasswordSettings.MinimumLength = 5
		*cfg.PasswordSettings.Lowercase = false
		*cfg.PasswordSettings.Uppercase = false
		*cfg.PasswordSettings.Symbol = false
		*cfg.PasswordSettings.Number = false
	})

	if enterprise {
		th.App.Srv().SetLicense(model.NewTestLicense())
	} else {
		th.App.Srv().SetLicense(nil)
	}

	th.Client = th.CreateClient()
	th.SystemAdminClient = th.CreateClient()

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

	th.App.InitServer()

	return th
}

func SetupEnterprise(tb testing.TB) *TestHelper {
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
	th := setupTestHelper(dbStore, searchEngine, true, true, nil)
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
	searchEngine := mainHelper.GetSearchEngine()
	th := setupTestHelper(dbStore, searchEngine, false, true, nil)
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
	th := setupTestHelper(dbStore, searchEngine, false, true, updateConfig)
	th.InitLogin()
	return th
}

func SetupConfigWithStoreMock(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	th := setupTestHelper(testlib.GetMockStoreForSetupFunctions(), nil, false, false, updateConfig)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	th.App.Srv().Store = &emptyMockStore
	return th
}

func SetupWithStoreMock(tb testing.TB) *TestHelper {
	th := setupTestHelper(testlib.GetMockStoreForSetupFunctions(), nil, false, false, nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	th.App.Srv().Store = &emptyMockStore
	return th
}

func SetupEnterpriseWithStoreMock(tb testing.TB) *TestHelper {
	th := setupTestHelper(testlib.GetMockStoreForSetupFunctions(), nil, true, false, nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	th.App.Srv().Store = &emptyMockStore
	return th
}

func (me *TestHelper) ShutdownApp() {
	done := make(chan bool)
	go func() {
		me.Server.Shutdown()
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

func (me *TestHelper) TearDown() {
	utils.DisableDebugLogForTest()
	if me.IncludeCacheLayer {
		// Clean all the caches
		me.App.Srv().InvalidateAllCaches()
	}

	me.ShutdownApp()

	utils.EnableDebugLogForTest()
}

var initBasicOnce sync.Once
var userCache struct {
	SystemAdminUser *model.User
	TeamAdminUser   *model.User
	BasicUser       *model.User
	BasicUser2      *model.User
}

func (me *TestHelper) InitLogin() *TestHelper {
	me.waitForConnectivity()

	// create users once and cache them because password hashing is slow
	initBasicOnce.Do(func() {
		me.SystemAdminUser = me.CreateUser()
		me.App.UpdateUserRoles(me.SystemAdminUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_ADMIN_ROLE_ID, false)
		me.SystemAdminUser, _ = me.App.GetUser(me.SystemAdminUser.Id)
		userCache.SystemAdminUser = me.SystemAdminUser.DeepCopy()

		me.TeamAdminUser = me.CreateUser()
		me.App.UpdateUserRoles(me.TeamAdminUser.Id, model.SYSTEM_USER_ROLE_ID, false)
		me.TeamAdminUser, _ = me.App.GetUser(me.TeamAdminUser.Id)
		userCache.TeamAdminUser = me.TeamAdminUser.DeepCopy()

		me.BasicUser = me.CreateUser()
		me.BasicUser, _ = me.App.GetUser(me.BasicUser.Id)
		userCache.BasicUser = me.BasicUser.DeepCopy()

		me.BasicUser2 = me.CreateUser()
		me.BasicUser2, _ = me.App.GetUser(me.BasicUser2.Id)
		userCache.BasicUser2 = me.BasicUser2.DeepCopy()
	})
	// restore cached users
	me.SystemAdminUser = userCache.SystemAdminUser.DeepCopy()
	me.TeamAdminUser = userCache.TeamAdminUser.DeepCopy()
	me.BasicUser = userCache.BasicUser.DeepCopy()
	me.BasicUser2 = userCache.BasicUser2.DeepCopy()
	mainHelper.GetSQLSupplier().GetMaster().Insert(me.SystemAdminUser, me.TeamAdminUser, me.BasicUser, me.BasicUser2)
	// restore non hashed password for login
	me.SystemAdminUser.Password = "Pa$$word11"
	me.TeamAdminUser.Password = "Pa$$word11"
	me.BasicUser.Password = "Pa$$word11"
	me.BasicUser2.Password = "Pa$$word11"

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		me.LoginSystemAdmin()
		wg.Done()
	}()
	go func() {
		me.LoginTeamAdmin()
		wg.Done()
	}()
	wg.Wait()
	return me
}

func (me *TestHelper) InitBasic() *TestHelper {
	me.BasicTeam = me.CreateTeam()
	me.BasicChannel = me.CreatePublicChannel()
	me.BasicPrivateChannel = me.CreatePrivateChannel()
	me.BasicPrivateChannel2 = me.CreatePrivateChannel()
	me.BasicDeletedChannel = me.CreatePublicChannel()
	me.BasicChannel2 = me.CreatePublicChannel()
	me.BasicPost = me.CreatePost()
	me.LinkUserToTeam(me.BasicUser, me.BasicTeam)
	me.LinkUserToTeam(me.BasicUser2, me.BasicTeam)
	me.App.AddUserToChannel(me.BasicUser, me.BasicChannel)
	me.App.AddUserToChannel(me.BasicUser2, me.BasicChannel)
	me.App.AddUserToChannel(me.BasicUser, me.BasicChannel2)
	me.App.AddUserToChannel(me.BasicUser2, me.BasicChannel2)
	me.App.AddUserToChannel(me.BasicUser, me.BasicPrivateChannel)
	me.App.AddUserToChannel(me.BasicUser2, me.BasicPrivateChannel)
	me.App.AddUserToChannel(me.BasicUser, me.BasicDeletedChannel)
	me.App.AddUserToChannel(me.BasicUser2, me.BasicDeletedChannel)
	me.App.UpdateUserRoles(me.BasicUser.Id, model.SYSTEM_USER_ROLE_ID, false)
	me.Client.DeleteChannel(me.BasicDeletedChannel.Id)
	me.LoginBasic()
	me.Group = me.CreateGroup()

	return me
}

func (me *TestHelper) waitForConnectivity() {
	for i := 0; i < 1000; i++ {
		conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%v", me.App.Srv().ListenAddr.Port))
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(time.Millisecond * 20)
	}
	panic("unable to connect")
}

func (me *TestHelper) CreateClient() *model.Client4 {
	return model.NewAPIv4Client(fmt.Sprintf("http://localhost:%v", me.App.Srv().ListenAddr.Port))
}

// ToDo: maybe move this to NewAPIv4SocketClient and reuse it in mmctl
func (me *TestHelper) CreateLocalClient(socketPath string) *model.Client4 {
	httpClient := &http.Client{
		Transport: &http.Transport{
			Dial: func(network, addr string) (net.Conn, error) {
				return net.Dial("unix", socketPath)
			},
		},
	}

	return &model.Client4{
		ApiUrl:     "http://_" + model.API_URL_SUFFIX,
		HttpClient: httpClient,
	}
}

func (me *TestHelper) CreateWebSocketClient() (*model.WebSocketClient, *model.AppError) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", me.App.Srv().ListenAddr.Port), me.Client.AuthToken)
}

func (me *TestHelper) CreateWebSocketSystemAdminClient() (*model.WebSocketClient, *model.AppError) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", me.App.Srv().ListenAddr.Port), me.SystemAdminClient.AuthToken)
}

func (me *TestHelper) CreateWebSocketClientWithClient(client *model.Client4) (*model.WebSocketClient, *model.AppError) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", me.App.Srv().ListenAddr.Port), client.AuthToken)
}

func (me *TestHelper) CreateBotWithSystemAdminClient() *model.Bot {
	return me.CreateBotWithClient((me.SystemAdminClient))
}

func (me *TestHelper) CreateBotWithClient(client *model.Client4) *model.Bot {
	bot := &model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "bot",
	}

	utils.DisableDebugLogForTest()
	rbot, resp := client.CreateBot(bot)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rbot
}

func (me *TestHelper) CreateUser() *model.User {
	return me.CreateUserWithClient(me.Client)
}

func (me *TestHelper) CreateTeam() *model.Team {
	return me.CreateTeamWithClient(me.Client)
}

func (me *TestHelper) CreateTeamWithClient(client *model.Client4) *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        GenerateTestTeamName(),
		Email:       me.GenerateTestEmail(),
		Type:        model.TEAM_OPEN,
	}

	utils.DisableDebugLogForTest()
	rteam, resp := client.CreateTeam(team)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rteam
}

func (me *TestHelper) CreateUserWithClient(client *model.Client4) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:     me.GenerateTestEmail(),
		Username:  GenerateTestUsername(),
		Nickname:  "nn_" + id,
		FirstName: "f_" + id,
		LastName:  "l_" + id,
		Password:  "Pa$$word11",
	}

	utils.DisableDebugLogForTest()
	ruser, response := client.CreateUser(user)
	if response.Error != nil {
		panic(response.Error)
	}

	ruser.Password = "Pa$$word11"
	_, err := me.App.Srv().Store.User().VerifyEmail(ruser.Id, ruser.Email)
	if err != nil {
		return nil
	}
	utils.EnableDebugLogForTest()
	return ruser
}

func (me *TestHelper) CreatePublicChannel() *model.Channel {
	return me.CreateChannelWithClient(me.Client, model.CHANNEL_OPEN)
}

func (me *TestHelper) CreatePrivateChannel() *model.Channel {
	return me.CreateChannelWithClient(me.Client, model.CHANNEL_PRIVATE)
}

func (me *TestHelper) CreateChannelWithClient(client *model.Client4, channelType string) *model.Channel {
	return me.CreateChannelWithClientAndTeam(client, channelType, me.BasicTeam.Id)
}

func (me *TestHelper) CreateChannelWithClientAndTeam(client *model.Client4, channelType string, teamId string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        GenerateTestChannelName(),
		Type:        channelType,
		TeamId:      teamId,
	}

	utils.DisableDebugLogForTest()
	rchannel, resp := client.CreateChannel(channel)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rchannel
}

func (me *TestHelper) CreatePost() *model.Post {
	return me.CreatePostWithClient(me.Client, me.BasicChannel)
}

func (me *TestHelper) CreatePinnedPost() *model.Post {
	return me.CreatePinnedPostWithClient(me.Client, me.BasicChannel)
}

func (me *TestHelper) CreateMessagePost(message string) *model.Post {
	return me.CreateMessagePostWithClient(me.Client, me.BasicChannel, message)
}

func (me *TestHelper) CreatePostWithClient(client *model.Client4, channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + id,
	}

	utils.DisableDebugLogForTest()
	rpost, resp := client.CreatePost(post)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rpost
}

func (me *TestHelper) CreatePinnedPostWithClient(client *model.Client4, channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + id,
		IsPinned:  true,
	}

	utils.DisableDebugLogForTest()
	rpost, resp := client.CreatePost(post)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rpost
}

func (me *TestHelper) CreateMessagePostWithClient(client *model.Client4, channel *model.Channel, message string) *model.Post {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
	}

	utils.DisableDebugLogForTest()
	rpost, resp := client.CreatePost(post)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rpost
}

func (me *TestHelper) CreateMessagePostNoClient(channel *model.Channel, message string, createAtTime int64) *model.Post {
	post, err := me.App.Srv().Store.Post().Save(&model.Post{
		UserId:    me.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   message,
		CreateAt:  createAtTime,
	})

	if err != nil {
		panic(err)
	}

	return post
}

func (me *TestHelper) CreateDmChannel(user *model.User) *model.Channel {
	utils.DisableDebugLogForTest()
	var err *model.AppError
	var channel *model.Channel
	if channel, err = me.App.GetOrCreateDirectChannel(me.BasicUser.Id, user.Id); err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return channel
}

func (me *TestHelper) LoginBasic() {
	me.LoginBasicWithClient(me.Client)
}

func (me *TestHelper) LoginBasic2() {
	me.LoginBasic2WithClient(me.Client)
}

func (me *TestHelper) LoginTeamAdmin() {
	me.LoginTeamAdminWithClient(me.Client)
}

func (me *TestHelper) LoginSystemAdmin() {
	me.LoginSystemAdminWithClient(me.SystemAdminClient)
}

func (me *TestHelper) LoginBasicWithClient(client *model.Client4) {
	utils.DisableDebugLogForTest()
	_, resp := client.Login(me.BasicUser.Email, me.BasicUser.Password)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LoginBasic2WithClient(client *model.Client4) {
	utils.DisableDebugLogForTest()
	_, resp := client.Login(me.BasicUser2.Email, me.BasicUser2.Password)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LoginTeamAdminWithClient(client *model.Client4) {
	utils.DisableDebugLogForTest()
	_, resp := client.Login(me.TeamAdminUser.Email, me.TeamAdminUser.Password)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LoginSystemAdminWithClient(client *model.Client4) {
	utils.DisableDebugLogForTest()
	_, resp := client.Login(me.SystemAdminUser.Email, me.SystemAdminUser.Password)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) UpdateActiveUser(user *model.User, active bool) {
	utils.DisableDebugLogForTest()

	_, err := me.App.UpdateActive(user, active)
	if err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LinkUserToTeam(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	err := me.App.JoinUserToTeam(team, user, "")
	if err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) AddUserToChannel(user *model.User, channel *model.Channel) *model.ChannelMember {
	utils.DisableDebugLogForTest()

	member, err := me.App.AddUserToChannel(user, channel)
	if err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()

	return member
}

func (me *TestHelper) GenerateTestEmail() string {
	if *me.App.Config().EmailSettings.SMTPServer != "localhost" && os.Getenv("CI_INBUCKET_PORT") == "" {
		return strings.ToLower("success+" + model.NewId() + "@simulator.amazonses.com")
	}
	return strings.ToLower(model.NewId() + "@localhost")
}

func (me *TestHelper) CreateGroup() *model.Group {
	id := model.NewId()
	group := &model.Group{
		Name:        model.NewString("n-" + id),
		DisplayName: "dn_" + id,
		Source:      model.GroupSourceLdap,
		RemoteId:    "ri_" + id,
	}

	utils.DisableDebugLogForTest()
	group, err := me.App.CreateGroup(group)
	if err != nil {
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return group
}

// TestForSystemAdminAndLocal runs a test function for both
// SystemAdmin and Local clients. Several endpoints work in the same
// way when used by a fully privileged user and through the local
// mode, so this helper facilitates checking both
func (me *TestHelper) TestForSystemAdminAndLocal(t *testing.T, f func(*testing.T, *model.Client4), name ...string) {
	var testName string
	if len(name) > 0 {
		testName = name[0] + "/"
	}

	t.Run(testName+"SystemAdminClient", func(t *testing.T) {
		f(t, me.SystemAdminClient)
	})

	t.Run(testName+"LocalClient", func(t *testing.T) {
		f(t, me.LocalClient)
	})
}

// TestForAllClients runs a test function for all the clients
// registered in the TestHelper
func (me *TestHelper) TestForAllClients(t *testing.T, f func(*testing.T, *model.Client4), name ...string) {
	var testName string
	if len(name) > 0 {
		testName = name[0] + "/"
	}

	t.Run(testName+"Client", func(t *testing.T) {
		f(t, me.Client)
	})

	t.Run(testName+"SystemAdminClient", func(t *testing.T) {
		f(t, me.SystemAdminClient)
	})

	t.Run(testName+"LocalClient", func(t *testing.T) {
		f(t, me.LocalClient)
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

func CheckUserSanitization(t *testing.T, user *model.User) {
	t.Helper()

	require.Equal(t, "", user.Password, "password wasn't blank")
	require.Empty(t, user.AuthData, "auth data wasn't blank")
	require.Equal(t, "", user.MfaSecret, "mfa secret wasn't blank")
}

func CheckEtag(t *testing.T, data interface{}, resp *model.Response) {
	t.Helper()

	require.Empty(t, data)
	require.Equal(t, resp.StatusCode, http.StatusNotModified, "wrong status code for etag")
}

func CheckNoError(t *testing.T, resp *model.Response) {
	t.Helper()

	require.Nil(t, resp.Error, "expected no error")
}

func checkHTTPStatus(t *testing.T, resp *model.Response, expectedStatus int, expectError bool) {
	t.Helper()

	require.NotNilf(t, resp, "Unexpected nil response, expected http:%v, expectError:%v", expectedStatus, expectError)
	if expectError {
		require.NotNil(t, resp.Error, "Expected a non-nil error and http status:%v, got nil, %v", expectedStatus, resp.StatusCode)
	} else {
		require.Nil(t, resp.Error, "Expected no error and http status:%v, got %q, http:%v", expectedStatus, resp.Error, resp.StatusCode)
	}
	require.Equalf(t, expectedStatus, resp.StatusCode, "Expected http status:%v, got %v (err: %q)", expectedStatus, resp.StatusCode, resp.Error)
}

func CheckOKStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusOK, false)
}

func CheckCreatedStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusCreated, false)
}

func CheckForbiddenStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusForbidden, true)
}

func CheckUnauthorizedStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusUnauthorized, true)
}

func CheckNotFoundStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusNotFound, true)
}

func CheckBadRequestStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusBadRequest, true)
}

func CheckNotImplementedStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusNotImplemented, true)
}

func CheckRequestEntityTooLargeStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusRequestEntityTooLarge, true)
}

func CheckInternalErrorStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusInternalServerError, true)
}

func CheckServiceUnavailableStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusServiceUnavailable, true)
}

func CheckErrorMessage(t *testing.T, resp *model.Response, errorId string) {
	t.Helper()

	require.NotNilf(t, resp.Error, "should have errored with message: %s", errorId)
	require.Equalf(t, errorId, resp.Error.Id, "incorrect error message, actual: %s, expected: %s", resp.Error.Id, errorId)
}

func CheckStartsWith(t *testing.T, value, prefix, message string) {
	require.True(t, strings.HasPrefix(value, prefix), message, value)
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

func (me *TestHelper) cleanupTestFile(info *model.FileInfo) error {
	cfg := me.App.Config()
	if *cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
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
	} else if *cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
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

func (me *TestHelper) MakeUserChannelAdmin(user *model.User, channel *model.Channel) {
	utils.DisableDebugLogForTest()

	if cm, err := me.App.Srv().Store.Channel().GetMember(channel.Id, user.Id); err == nil {
		cm.SchemeAdmin = true
		if _, err = me.App.Srv().Store.Channel().UpdateMember(cm); err != nil {
			utils.EnableDebugLogForTest()
			panic(err)
		}
	} else {
		utils.EnableDebugLogForTest()
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) UpdateUserToTeamAdmin(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	if tm, err := me.App.Srv().Store.Team().GetMember(team.Id, user.Id); err == nil {
		tm.SchemeAdmin = true
		if _, err = me.App.Srv().Store.Team().UpdateMember(tm); err != nil {
			utils.EnableDebugLogForTest()
			panic(err)
		}
	} else {
		utils.EnableDebugLogForTest()
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) UpdateUserToNonTeamAdmin(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	if tm, err := me.App.Srv().Store.Team().GetMember(team.Id, user.Id); err == nil {
		tm.SchemeAdmin = false
		if _, err = me.App.Srv().Store.Team().UpdateMember(tm); err != nil {
			utils.EnableDebugLogForTest()
			panic(err)
		}
	} else {
		utils.EnableDebugLogForTest()
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) SaveDefaultRolePermissions() map[string][]string {
	utils.DisableDebugLogForTest()

	results := make(map[string][]string)

	for _, roleName := range []string{
		"system_user",
		"system_admin",
		"team_user",
		"team_admin",
		"channel_user",
		"channel_admin",
	} {
		role, err1 := me.App.GetRoleByName(roleName)
		if err1 != nil {
			utils.EnableDebugLogForTest()
			panic(err1)
		}

		results[roleName] = role.Permissions
	}

	utils.EnableDebugLogForTest()
	return results
}

func (me *TestHelper) RestoreDefaultRolePermissions(data map[string][]string) {
	utils.DisableDebugLogForTest()

	for roleName, permissions := range data {
		role, err1 := me.App.GetRoleByName(roleName)
		if err1 != nil {
			utils.EnableDebugLogForTest()
			panic(err1)
		}

		if strings.Join(role.Permissions, " ") == strings.Join(permissions, " ") {
			continue
		}

		role.Permissions = permissions

		_, err2 := me.App.UpdateRole(role)
		if err2 != nil {
			utils.EnableDebugLogForTest()
			panic(err2)
		}
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) RemovePermissionFromRole(permission string, roleName string) {
	utils.DisableDebugLogForTest()

	role, err1 := me.App.GetRoleByName(roleName)
	if err1 != nil {
		utils.EnableDebugLogForTest()
		panic(err1)
	}

	var newPermissions []string
	for _, p := range role.Permissions {
		if p != permission {
			newPermissions = append(newPermissions, p)
		}
	}

	if strings.Join(role.Permissions, " ") == strings.Join(newPermissions, " ") {
		utils.EnableDebugLogForTest()
		return
	}

	role.Permissions = newPermissions

	_, err2 := me.App.UpdateRole(role)
	if err2 != nil {
		utils.EnableDebugLogForTest()
		panic(err2)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) AddPermissionToRole(permission string, roleName string) {
	utils.DisableDebugLogForTest()

	role, err1 := me.App.GetRoleByName(roleName)
	if err1 != nil {
		utils.EnableDebugLogForTest()
		panic(err1)
	}

	for _, existingPermission := range role.Permissions {
		if existingPermission == permission {
			utils.EnableDebugLogForTest()
			return
		}
	}

	role.Permissions = append(role.Permissions, permission)

	_, err2 := me.App.UpdateRole(role)
	if err2 != nil {
		utils.EnableDebugLogForTest()
		panic(err2)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) SetupTeamScheme() *model.Scheme {
	return me.SetupScheme(model.SCHEME_SCOPE_TEAM)
}

func (me *TestHelper) SetupChannelScheme() *model.Scheme {
	return me.SetupScheme(model.SCHEME_SCOPE_CHANNEL)
}

func (me *TestHelper) SetupScheme(scope string) *model.Scheme {
	scheme := model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       scope,
	}

	if scheme, err := me.App.CreateScheme(&scheme); err == nil {
		return scheme
	} else {
		panic(err)
	}
}
