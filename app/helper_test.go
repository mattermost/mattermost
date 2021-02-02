// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v5/testlib"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type TestHelper struct {
	App          *App
	Server       *Server
	BasicTeam    *model.Team
	BasicUser    *model.User
	BasicUser2   *model.User
	BasicChannel *model.Channel
	BasicPost    *model.Post

	SystemAdminUser   *model.User
	LogBuffer         *bytes.Buffer
	IncludeCacheLayer bool

	tempWorkspace string
}

func setupTestHelper(dbStore store.Store, enterprise bool, includeCacheLayer bool, tb testing.TB, configSet func(*model.Config)) *TestHelper {
	tempWorkspace, err := ioutil.TempDir("", "apptest")
	if err != nil {
		panic(err)
	}

	configStore := config.NewTestMemoryStore()

	config := configStore.Get()
	if configSet != nil {
		configSet(config)
	}
	*config.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*config.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*config.PluginSettings.AutomaticPrepackagedPlugins = false
	*config.LogSettings.EnableSentry = false // disable error reporting during tests
	*config.AnnouncementSettings.AdminNoticesEnabled = false
	*config.AnnouncementSettings.UserNoticesEnabled = false
	configStore.Set(config)

	buffer := &bytes.Buffer{}

	var options []Option
	options = append(options, ConfigStore(configStore))
	if includeCacheLayer {
		// Adds the cache layer to the test store
		options = append(options, StoreOverride(func(s *Server) store.Store {
			lcl, err2 := localcachelayer.NewLocalCacheLayer(dbStore, s.Metrics, s.Cluster, s.CacheProvider)
			if err2 != nil {
				panic(err2)
			}
			return lcl
		}))
	} else {
		options = append(options, StoreOverride(dbStore))
	}
	options = append(options, SetLogger(mlog.NewTestingLogger(tb, buffer)))

	s, err := NewServer(options...)
	if err != nil {
		panic(err)
	}

	th := &TestHelper{
		App:               New(ServerConnector(s)),
		Server:            s,
		LogBuffer:         buffer,
		IncludeCacheLayer: includeCacheLayer,
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 50 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.RateLimitSettings.Enable = false })
	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	serverErr := th.Server.Start()
	if serverErr != nil {
		panic(serverErr)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	th.App.Srv().SearchEngine = mainHelper.SearchEngine

	th.App.Srv().Store.MarkSystemRanUnitTests()

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

	if th.tempWorkspace == "" {
		th.tempWorkspace = tempWorkspace
	}

	th.App.InitServer()

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

	return setupTestHelper(dbStore, false, true, tb, nil)
}

func SetupWithoutPreloadMigrations(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	return setupTestHelper(dbStore, false, true, tb, nil)
}

func SetupWithStoreMock(tb testing.TB) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, false, false, tb, nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	th.App.Srv().Store = &emptyMockStore
	return th
}

func SetupEnterpriseWithStoreMock(tb testing.TB) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, true, false, tb, nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	th.App.Srv().Store = &emptyMockStore
	return th
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
		th.App.UpdateUserRoles(th.SystemAdminUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_ADMIN_ROLE_ID, false)
		th.SystemAdminUser, _ = th.App.GetUser(th.SystemAdminUser.Id)
		userCache.SystemAdminUser = th.SystemAdminUser.DeepCopy()

		th.BasicUser = th.CreateUser()
		th.BasicUser, _ = th.App.GetUser(th.BasicUser.Id)
		userCache.BasicUser = th.BasicUser.DeepCopy()

		th.BasicUser2 = th.CreateUser()
		th.BasicUser2, _ = th.App.GetUser(th.BasicUser2.Id)
		userCache.BasicUser2 = th.BasicUser2.DeepCopy()
	})
	// restore cached users
	th.SystemAdminUser = userCache.SystemAdminUser.DeepCopy()
	th.BasicUser = userCache.BasicUser.DeepCopy()
	th.BasicUser2 = userCache.BasicUser2.DeepCopy()
	mainHelper.GetSQLStore().GetMaster().Insert(th.SystemAdminUser, th.BasicUser, th.BasicUser2)

	th.BasicTeam = th.CreateTeam()

	th.LinkUserToTeam(th.BasicUser, th.BasicTeam)
	th.LinkUserToTeam(th.BasicUser2, th.BasicTeam)
	th.BasicChannel = th.CreateChannel(th.BasicTeam)
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
		Type:        model.TEAM_OPEN,
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if team, err = th.App.CreateTeam(team); err != nil {
		panic(err)
	}
	utils.EnableDebugLogForTest()
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

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if guest {
		if user, err = th.App.CreateGuest(user); err != nil {
			panic(err)
		}
	} else {
		if user, err = th.App.CreateUser(user); err != nil {
			panic(err)
		}
	}
	utils.EnableDebugLogForTest()
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

	bot, err := th.App.CreateBot(bot)
	if err != nil {
		panic(err)
	}
	return bot
}

func (th *TestHelper) CreateChannel(team *model.Team) *model.Channel {
	return th.createChannel(team, model.CHANNEL_OPEN)
}

func (th *TestHelper) CreatePrivateChannel(team *model.Team) *model.Channel {
	return th.createChannel(team, model.CHANNEL_PRIVATE)
}

func (th *TestHelper) createChannel(team *model.Team, channelType string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        "name_" + id,
		Type:        channelType,
		TeamId:      team.Id,
		CreatorId:   th.BasicUser.Id,
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if channel, err = th.App.CreateChannel(channel, true); err != nil {
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return channel
}

func (th *TestHelper) CreateDmChannel(user *model.User) *model.Channel {
	utils.DisableDebugLogForTest()
	var err *model.AppError
	var channel *model.Channel
	if channel, err = th.App.GetOrCreateDirectChannel(th.BasicUser.Id, user.Id); err != nil {
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return channel
}

func (th *TestHelper) CreateGroupChannel(user1 *model.User, user2 *model.User) *model.Channel {
	utils.DisableDebugLogForTest()
	var err *model.AppError
	var channel *model.Channel
	if channel, err = th.App.CreateGroupChannel([]string{th.BasicUser.Id, user1.Id, user2.Id}, th.BasicUser.Id); err != nil {
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return channel
}

func (th *TestHelper) CreatePost(channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "message_" + id,
		CreateAt:  model.GetMillis() - 10000,
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if post, err = th.App.CreatePost(post, channel, false, true); err != nil {
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return post
}

func (th *TestHelper) CreateMessagePost(channel *model.Channel, message string) *model.Post {
	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   message,
		CreateAt:  model.GetMillis() - 10000,
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if post, err = th.App.CreatePost(post, channel, false, true); err != nil {
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return post
}

func (th *TestHelper) LinkUserToTeam(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	err := th.App.JoinUserToTeam(team, user, "")
	if err != nil {
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (th *TestHelper) RemoveUserFromTeam(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	err := th.App.RemoveUserFromTeam(team.Id, user.Id, "")
	if err != nil {
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (th *TestHelper) AddUserToChannel(user *model.User, channel *model.Channel) *model.ChannelMember {
	utils.DisableDebugLogForTest()

	member, err := th.App.AddUserToChannel(user, channel)
	if err != nil {
		panic(err)
	}

	utils.EnableDebugLogForTest()

	return member
}

func (th *TestHelper) CreateRole(roleName string) *model.Role {
	role, _ := th.App.CreateRole(&model.Role{Name: roleName, DisplayName: roleName, Description: roleName, Permissions: []string{}})
	return role
}

func (th *TestHelper) CreateScheme() (*model.Scheme, []*model.Role) {
	utils.DisableDebugLogForTest()

	scheme, err := th.App.CreateScheme(&model.Scheme{
		DisplayName: "Test Scheme Display Name",
		Name:        model.NewId(),
		Description: "Test scheme description",
		Scope:       model.SCHEME_SCOPE_TEAM,
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
		role, err := th.App.GetRoleByName(roleName)
		if err != nil {
			panic(err)
		}
		roles = append(roles, role)
	}

	utils.EnableDebugLogForTest()

	return scheme, roles
}

func (th *TestHelper) CreateGroup() *model.Group {
	id := model.NewId()
	group := &model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if group, err = th.App.CreateGroup(group); err != nil {
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return group
}

func (th *TestHelper) CreateEmoji() *model.Emoji {
	utils.DisableDebugLogForTest()

	emoji, err := th.App.Srv().Store.Emoji().Save(&model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewRandomString(10),
	})
	if err != nil {
		panic(err)
	}

	utils.EnableDebugLogForTest()

	return emoji
}

func (th *TestHelper) AddReactionToPost(post *model.Post, user *model.User, emojiName string) *model.Reaction {
	utils.DisableDebugLogForTest()

	reaction, err := th.App.SaveReactionForPost(&model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: emojiName,
	})
	if err != nil {
		panic(err)
	}

	utils.EnableDebugLogForTest()

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

func (th *TestHelper) TearDown() {
	if th.IncludeCacheLayer {
		// Clean all the caches
		th.App.Srv().InvalidateAllCaches()
	}
	th.ShutdownApp()
	if th.tempWorkspace != "" {
		os.RemoveAll(th.tempWorkspace)
	}
}

func (*TestHelper) GetSqlStore() *sqlstore.SqlStore {
	return mainHelper.GetSQLStore()
}

func (*TestHelper) ResetRoleMigration() {
	sqlStore := mainHelper.GetSQLStore()
	if _, err := sqlStore.GetMaster().Exec("DELETE from Roles"); err != nil {
		panic(err)
	}

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	if _, err := sqlStore.GetMaster().Exec("DELETE from Systems where Name = :Name", map[string]interface{}{"Name": model.ADVANCED_PERMISSIONS_MIGRATION_KEY}); err != nil {
		panic(err)
	}
}

func (*TestHelper) ResetEmojisMigration() {
	sqlStore := mainHelper.GetSQLStore()
	if _, err := sqlStore.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' create_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	if _, err := sqlStore.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' delete_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	if _, err := sqlStore.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' delete_others_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	if _, err := sqlStore.GetMaster().Exec("DELETE from Systems where Name = :Name", map[string]interface{}{"Name": EmojisPermissionsMigrationKey}); err != nil {
		panic(err)
	}
}

func (th *TestHelper) CheckTeamCount(t *testing.T, expected int64) {
	teamCount, err := th.App.Srv().Store.Team().AnalyticsTeamCount(false)
	require.Nil(t, err, "Failed to get team count.")
	require.Equalf(t, teamCount, expected, "Unexpected number of teams. Expected: %v, found: %v", expected, teamCount)
}

func (th *TestHelper) CheckChannelsCount(t *testing.T, expected int64) {
	count, err := th.App.Srv().Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN)
	require.Nilf(t, err, "Failed to get channel count.")
	require.Equalf(t, count, expected, "Unexpected number of channels. Expected: %v, found: %v", expected, count)
}

func (th *TestHelper) SetupTeamScheme() *model.Scheme {
	scheme, err := th.App.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	})
	if err != nil {
		panic(err)
	}
	return scheme
}

func (th *TestHelper) SetupChannelScheme() *model.Scheme {
	scheme, err := th.App.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SCHEME_SCOPE_CHANNEL,
	})
	if err != nil {
		panic(err)
	}
	return scheme
}

func (th *TestHelper) SetupPluginAPI() *PluginAPI {
	manifest := &model.Manifest{
		Id: "pluginid",
	}

	return NewPluginAPI(th.App, manifest)
}

func (th *TestHelper) RemovePermissionFromRole(permission string, roleName string) {
	utils.DisableDebugLogForTest()

	role, err1 := th.App.GetRoleByName(roleName)
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

	_, err2 := th.App.UpdateRole(role)
	if err2 != nil {
		utils.EnableDebugLogForTest()
		panic(err2)
	}

	utils.EnableDebugLogForTest()
}

func (th *TestHelper) AddPermissionToRole(permission string, roleName string) {
	utils.DisableDebugLogForTest()

	role, err1 := th.App.GetRoleByName(roleName)
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

	_, err2 := th.App.UpdateRole(role)
	if err2 != nil {
		utils.EnableDebugLogForTest()
		panic(err2)
	}

	utils.EnableDebugLogForTest()
}
