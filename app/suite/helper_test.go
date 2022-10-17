// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app/platform"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v6/testlib"
)

type TestHelper struct {
	Suite        *SuiteService
	Context      *request.Context
	BasicTeam    *model.Team
	BasicUser    *model.User
	BasicUser2   *model.User
	BasicChannel *model.Channel
	BasicPost    *model.Post

	SystemAdminUser   *model.User
	LogBuffer         *mlog.Buffer
	TestLogger        *mlog.Logger
	IncludeCacheLayer bool

	tempWorkspace string
}

func setupTestHelper(dbStore store.Store, enterprise bool, includeCacheLayer bool, options []platform.Option, tb testing.TB) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "apptest")
	if err != nil {
		panic(err)
	}

	configStore := config.NewTestMemoryStore()

	memoryConfig := configStore.Get()
	*memoryConfig.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*memoryConfig.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*memoryConfig.PluginSettings.AutomaticPrepackagedPlugins = false
	*memoryConfig.LogSettings.EnableSentry = false // disable error reporting during tests
	*memoryConfig.AnnouncementSettings.AdminNoticesEnabled = false
	*memoryConfig.AnnouncementSettings.UserNoticesEnabled = false
	configStore.Set(memoryConfig)

	buffer := &mlog.Buffer{}

	options = append(options, platform.ConfigStore(configStore))
	if includeCacheLayer {
		// Adds the cache layer to the test store
		options = append(options, platform.StoreOverrideWithCache(dbStore))
	} else {
		options = append(options, platform.StoreOverride(dbStore))
	}

	testLogger, _ := mlog.NewLogger()
	logCfg, _ := config.MloggerConfigFromLoggerConfig(&memoryConfig.LogSettings, nil, config.GetLogFileLocation)
	if errCfg := testLogger.ConfigureTargets(logCfg, nil); errCfg != nil {
		panic("failed to configure test logger: " + errCfg.Error())
	}
	if errW := mlog.AddWriterTarget(testLogger, buffer, true, mlog.StdAll...); errW != nil {
		panic("failed to add writer target to test logger: " + errW.Error())
	}
	// lock logger config so server init cannot override it during testing.
	testLogger.LockConfiguration()
	options = append(options, platform.SetLogger(testLogger))

	// p, err := platform.New(platform.ServiceConfig{}, options...)
	// if err != nil {
	// 	panic(err)
	// }

	th := &TestHelper{
		// Suite:             NewSuiteService(p),
		Context:           request.EmptyContext(testLogger),
		LogBuffer:         buffer,
		TestLogger:        testLogger,
		IncludeCacheLayer: includeCacheLayer,
	}
	th.Context.SetLogger(testLogger)

	th.Suite.platform.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 50 })
	th.Suite.platform.UpdateConfig(func(cfg *model.Config) { *cfg.RateLimitSettings.Enable = false })
	prevListenAddress := *th.Suite.platform.Config().ServiceSettings.ListenAddress
	th.Suite.platform.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	serverErr := th.Suite.platform.Start(th.Suite)
	if serverErr != nil {
		panic(serverErr)
	}

	th.Suite.platform.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	th.Suite.platform.SearchEngine = mainHelper.SearchEngine

	th.Suite.platform.Store.MarkSystemRanUnitTests()

	th.Suite.platform.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = true })

	// Disable strict password requirements for test
	th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.PasswordSettings.MinimumLength = 5
		*cfg.PasswordSettings.Lowercase = false
		*cfg.PasswordSettings.Uppercase = false
		*cfg.PasswordSettings.Symbol = false
		*cfg.PasswordSettings.Number = false
	})

	if enterprise {
		th.Suite.platform.SetLicense(model.NewTestLicense())
	} else {
		th.Suite.platform.SetLicense(nil)
	}

	if th.tempWorkspace == "" {
		th.tempWorkspace = tempWorkspace
	}

	return th
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	return setupTestHelper(dbStore, false, true, nil, tb)
}

func SetupWithoutPreloadMigrations(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	return setupTestHelper(dbStore, false, true, nil, tb)
}

func SetupWithStoreMock(tb testing.TB) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, false, false, nil, tb)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	th.Suite.platform.Store = &emptyMockStore
	return th
}

func SetupEnterpriseWithStoreMock(tb testing.TB) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, true, false, nil, tb)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	th.Suite.platform.Store = &emptyMockStore
	return th
}

func SetupWithClusterMock(tb testing.TB, cluster einterfaces.ClusterInterface) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	return setupTestHelper(dbStore, true, true, []platform.Option{platform.SetCluster(cluster)}, tb)
}

var initBasicOnce sync.Once
var userCache struct {
	SystemAdminUser *model.User
	BasicUser       *model.User
	BasicUser2      *model.User
}

func (th *TestHelper) InitBasic() *TestHelper {
	// create users once and cache them because password hashing is slow
	initBasicOnce.Do(func() {
		th.SystemAdminUser = th.CreateUser()
		th.Suite.UpdateUserRoles(th.Context, th.SystemAdminUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
		th.SystemAdminUser, _ = th.Suite.GetUser(th.SystemAdminUser.Id)
		userCache.SystemAdminUser = th.SystemAdminUser.DeepCopy()

		th.BasicUser = th.CreateUser()
		th.BasicUser, _ = th.Suite.GetUser(th.BasicUser.Id)
		userCache.BasicUser = th.BasicUser.DeepCopy()

		th.BasicUser2 = th.CreateUser()
		th.BasicUser2, _ = th.Suite.GetUser(th.BasicUser2.Id)
		userCache.BasicUser2 = th.BasicUser2.DeepCopy()
	})
	// restore cached users
	th.SystemAdminUser = userCache.SystemAdminUser.DeepCopy()
	th.BasicUser = userCache.BasicUser.DeepCopy()
	th.BasicUser2 = userCache.BasicUser2.DeepCopy()

	users := []*model.User{th.SystemAdminUser, th.BasicUser, th.BasicUser2}
	mainHelper.GetSQLStore().User().InsertUsers(users)

	th.BasicTeam = th.CreateTeam()

	th.LinkUserToTeam(th.BasicUser, th.BasicTeam)
	th.LinkUserToTeam(th.BasicUser2, th.BasicTeam)
	th.BasicChannel = th.CreateChannel(th.Context, th.BasicTeam)
	th.BasicPost = th.CreatePost(th.BasicChannel)
	return th
}

func (*TestHelper) MakeEmail() string {
	return "success_" + model.NewId() + "@simulator.amazonses.com"
}

func (th *TestHelper) CreateTeam() *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	var err *model.AppError
	if team, err = th.Suite.CreateTeam(th.Context, team); err != nil {
		panic(err)
	}
	return team
}

func (th *TestHelper) CreateUser() *model.User {
	return th.CreateUserOrGuest(false)
}

func (th *TestHelper) CreateGuest() *model.User {
	return th.CreateUserOrGuest(true)
}

func (th *TestHelper) CreateUserOrGuest(guest bool) *model.User {
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
		if user, err = th.Suite.CreateGuest(th.Context, user); err != nil {
			panic(err)
		}
	} else {
		if user, err = th.Suite.CreateUser(th.Context, user); err != nil {
			panic(err)
		}
	}
	return user
}

func (th *TestHelper) CreateBot() *model.Bot {
	id := model.NewId()

	bot := &model.Bot{
		Username:    "bot" + id,
		DisplayName: "a bot",
		Description: "bot",
		OwnerId:     th.BasicUser.Id,
	}

	bot, err := th.Suite.CreateBot(th.Context, bot)
	if err != nil {
		panic(err)
	}
	return bot
}

type ChannelOption func(*model.Channel)

func WithCreateAt(v int64) ChannelOption {
	return func(channel *model.Channel) {
		channel.CreateAt = *model.NewInt64(v)
	}
}

func (th *TestHelper) CreateChannel(c request.CTX, team *model.Team, options ...ChannelOption) *model.Channel {
	return th.createChannel(c, team, model.ChannelTypeOpen, options...)
}

func (th *TestHelper) CreatePrivateChannel(c request.CTX, team *model.Team, options ...ChannelOption) *model.Channel {
	return th.createChannel(c, team, model.ChannelTypePrivate, options...)
}

func (th *TestHelper) createChannel(c request.CTX, team *model.Team, channelType model.ChannelType, options ...ChannelOption) *model.Channel {
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

	var appErr *model.AppError
	if channel, appErr = th.Suite.channels.CreateChannel(th.Context, channel, true); appErr != nil {
		panic(appErr)
	}

	return channel
}

func (th *TestHelper) CreateDmChannel(user *model.User) *model.Channel {
	var err *model.AppError
	var channel *model.Channel
	if channel, err = th.Suite.channels.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, user.Id); err != nil {
		panic(err)
	}
	return channel
}

// func (th *TestHelper) CreateGroupChannel(c request.CTX, user1 *model.User, user2 *model.User) *model.Channel {
// 	var err *model.AppError
// 	var channel *model.Channel
// 	if channel, err = th.Suite.channels.CreateGroupChannel(c, []string{th.BasicUser.Id, user1.Id, user2.Id}, th.BasicUser.Id); err != nil {
// 		panic(err)
// 	}
// 	return channel
// }

func (th *TestHelper) CreatePost(channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "message_" + id,
		CreateAt:  model.GetMillis() - 10000,
	}

	var err *model.AppError
	if post, err = th.Suite.channels.CreatePost(th.Context, post, channel, false, true); err != nil {
		panic(err)
	}
	return post
}

func (th *TestHelper) CreateMessagePost(channel *model.Channel, message string) *model.Post {
	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   message,
		CreateAt:  model.GetMillis() - 10000,
	}

	var err *model.AppError
	if post, err = th.Suite.channels.CreatePost(th.Context, post, channel, false, true); err != nil {
		panic(err)
	}
	return post
}

func (th *TestHelper) LinkUserToTeam(user *model.User, team *model.Team) {
	_, err := th.Suite.JoinUserToTeam(th.Context, team, user, "")
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) RemoveUserFromTeam(user *model.User, team *model.Team) {
	err := th.Suite.RemoveUserFromTeam(th.Context, team.Id, user.Id, "")
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) AddUserToChannel(user *model.User, channel *model.Channel) *model.ChannelMember {
	member, err := th.Suite.channels.AddUserToChannel(th.Context, user, channel, false)
	if err != nil {
		panic(err)
	}
	return member
}

func (th *TestHelper) CreateRole(roleName string) *model.Role {
	role, _ := th.Suite.CreateRole(&model.Role{Name: roleName, DisplayName: roleName, Description: roleName, Permissions: []string{}})
	return role
}

func (th *TestHelper) CreateScheme() (*model.Scheme, []*model.Role) {
	scheme, err := th.Suite.CreateScheme(&model.Scheme{
		DisplayName: "Test Scheme Display Name",
		Name:        model.NewId(),
		Description: "Test scheme description",
		Scope:       model.SchemeScopeTeam,
	})
	if err != nil {
		panic(err)
	}

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
		role, err := th.Suite.GetRoleByName(context.Background(), roleName)
		if err != nil {
			panic(err)
		}
		roles = append(roles, role)
	}
	return scheme, roles
}

func (th *TestHelper) CreateGroup() *model.Group {
	id := model.NewId()
	group := &model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	}

	var err *model.AppError
	if group, err = th.Suite.CreateGroup(group); err != nil {
		panic(err)
	}
	return group
}

func (th *TestHelper) CreateEmoji() *model.Emoji {
	emoji, err := th.Suite.platform.Store.Emoji().Save(&model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewRandomString(10),
	})
	if err != nil {
		panic(err)
	}
	return emoji
}

// func (th *TestHelper) AddReactionToPost(post *model.Post, user *model.User, emojiName string) *model.Reaction {
// 	reaction, err := th.Suite.SaveReactionForPost(th.Context, &model.Reaction{
// 		UserId:    user.Id,
// 		PostId:    post.Id,
// 		EmojiName: emojiName,
// 	})
// 	if err != nil {
// 		panic(err)
// 	}
// 	return reaction
// }

func (th *TestHelper) ShutdownApp() {
	done := make(chan bool)
	go func() {
		th.Suite.platform.Shutdown()
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
		th.Suite.platform.InvalidateAllCaches()
	}
	th.ShutdownApp()
	if th.tempWorkspace != "" {
		os.RemoveAll(th.tempWorkspace)
	}
}

func (*TestHelper) GetSqlStore() *sqlstore.SqlStore {
	return mainHelper.GetSQLStore()
}

// func (th *TestHelper) ConfigureInbucketMail() {
// 	inbucket_host := os.Getenv("CI_INBUCKET_HOST")
// 	if inbucket_host == "" {
// 		inbucket_host = "localhost"
// 	}
// 	inbucket_port := os.Getenv("CI_INBUCKET_SMTP_PORT")
// 	if inbucket_port == "" {
// 		inbucket_port = "10025"
// 	}
// 	th.Suite.UpdateConfig(func(cfg *model.Config) {
// 		*cfg.EmailSettings.SMTPServer = inbucket_host
// 		*cfg.EmailSettings.SMTPPort = inbucket_port
// 	})
// }

func (*TestHelper) ResetRoleMigration() {
	sqlStore := mainHelper.GetSQLStore()
	if _, err := sqlStore.GetMasterX().Exec("DELETE from Roles"); err != nil {
		panic(err)
	}

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	if _, err := sqlStore.GetMasterX().Exec("DELETE from Systems where Name = ?", model.AdvancedPermissionsMigrationKey); err != nil {
		panic(err)
	}
}

func (*TestHelper) ResetEmojisMigration() {
	sqlStore := mainHelper.GetSQLStore()
	if _, err := sqlStore.GetMasterX().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' create_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	if _, err := sqlStore.GetMasterX().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' delete_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	if _, err := sqlStore.GetMasterX().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' delete_others_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	if _, err := sqlStore.GetMasterX().Exec("DELETE from Systems where Name = ?", EmojisPermissionsMigrationKey); err != nil {
		panic(err)
	}
}

func (th *TestHelper) CheckTeamCount(t *testing.T, expected int64) {
	teamCount, err := th.Suite.platform.Store.Team().AnalyticsTeamCount(nil)
	require.NoError(t, err, "Failed to get team count.")
	require.Equalf(t, teamCount, expected, "Unexpected number of teams. Expected: %v, found: %v", expected, teamCount)
}

func (th *TestHelper) CheckChannelsCount(t *testing.T, expected int64) {
	count, err := th.Suite.platform.Store.Channel().AnalyticsTypeCount("", model.ChannelTypeOpen)
	require.NoError(t, err, "Failed to get channel count.")
	require.Equalf(t, count, expected, "Unexpected number of channels. Expected: %v, found: %v", expected, count)
}

func (th *TestHelper) SetupTeamScheme() *model.Scheme {
	scheme, err := th.Suite.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	})
	if err != nil {
		panic(err)
	}
	return scheme
}

func (th *TestHelper) SetupChannelScheme() *model.Scheme {
	scheme, err := th.Suite.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	})
	if err != nil {
		panic(err)
	}
	return scheme
}

// func (th *TestHelper) SetupPluginAPI() *PluginAPI {
// 	manifest := &model.Manifest{
// 		Id: "pluginid",
// 	}

// 	return NewPluginAPI(th.App, th.Context, manifest)
// }

func (th *TestHelper) RemovePermissionFromRole(permission string, roleName string) {
	role, err1 := th.Suite.GetRoleByName(context.Background(), roleName)
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

	_, err2 := th.Suite.UpdateRole(role)
	if err2 != nil {
		panic(err2)
	}
}

func (th *TestHelper) AddPermissionToRole(permission string, roleName string) {
	role, err1 := th.Suite.GetRoleByName(context.Background(), roleName)
	if err1 != nil {
		panic(err1)
	}

	for _, existingPermission := range role.Permissions {
		if existingPermission == permission {
			return
		}
	}

	role.Permissions = append(role.Permissions, permission)

	_, err2 := th.Suite.UpdateRole(role)
	if err2 != nil {
		panic(err2)
	}
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

// func (th *TestHelper) NewPluginAPI(manifest *model.Manifest) plugin.API {
// 	return th.Suite.NewPluginAPI(th.Context, manifest)
// }

func checkError(t *testing.T, err *model.AppError) {
	require.NotNil(t, err, "Should have returned an error.")
}

func checkNoError(t *testing.T, err *model.AppError) {
	require.Nil(t, err, "Unexpected Error: %v", err)
}
