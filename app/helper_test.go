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
	"time"

	"testing"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v5/testlib"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/stretchr/testify/require"
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
	*config.LogSettings.EnableSentry = false // disable error reporting during tests
	*config.AnnouncementSettings.AdminNoticesEnabled = false
	*config.AnnouncementSettings.UserNoticesEnabled = false
	configStore.Set(config)

	buffer := &bytes.Buffer{}

	var options []Option
	options = append(options, ConfigStore(configStore))
	options = append(options, StoreOverride(dbStore))
	options = append(options, SetLogger(mlog.NewTestingLogger(tb, buffer)))

	s, err := NewServer(options...)
	if err != nil {
		panic(err)
	}

	if includeCacheLayer {
		// Adds the cache layer to the test store
		s.Store = localcachelayer.NewLocalCacheLayer(s.Store, s.Metrics, s.Cluster, s.CacheProvider)
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

func SetupEnterprise(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	return setupTestHelper(dbStore, true, true, tb, nil)
}

func Setup(tb testing.TB) *TestHelper {
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

func (me *TestHelper) InitBasic() *TestHelper {
	// create users once and cache them because password hashing is slow
	initBasicOnce.Do(func() {
		me.SystemAdminUser = me.CreateUser()
		me.App.UpdateUserRoles(me.SystemAdminUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_ADMIN_ROLE_ID, false)
		me.SystemAdminUser, _ = me.App.GetUser(me.SystemAdminUser.Id)
		userCache.SystemAdminUser = me.SystemAdminUser.DeepCopy()

		me.BasicUser = me.CreateUser()
		me.BasicUser, _ = me.App.GetUser(me.BasicUser.Id)
		userCache.BasicUser = me.BasicUser.DeepCopy()

		me.BasicUser2 = me.CreateUser()
		me.BasicUser2, _ = me.App.GetUser(me.BasicUser2.Id)
		userCache.BasicUser2 = me.BasicUser2.DeepCopy()
	})
	// restore cached users
	me.SystemAdminUser = userCache.SystemAdminUser.DeepCopy()
	me.BasicUser = userCache.BasicUser.DeepCopy()
	me.BasicUser2 = userCache.BasicUser2.DeepCopy()
	mainHelper.GetSQLSupplier().GetMaster().Insert(me.SystemAdminUser, me.BasicUser, me.BasicUser2)

	me.BasicTeam = me.CreateTeam()

	me.LinkUserToTeam(me.BasicUser, me.BasicTeam)
	me.LinkUserToTeam(me.BasicUser2, me.BasicTeam)
	me.BasicChannel = me.CreateChannel(me.BasicTeam)
	me.BasicPost = me.CreatePost(me.BasicChannel)
	return me
}

func (me *TestHelper) MakeEmail() string {
	return "success_" + model.NewId() + "@simulator.amazonses.com"
}

func (me *TestHelper) CreateTeam() *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if team, err = me.App.CreateTeam(team); err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return team
}

func (me *TestHelper) CreateUser() *model.User {
	return me.CreateUserOrGuest(false)
}

func (me *TestHelper) CreateGuest() *model.User {
	return me.CreateUserOrGuest(true)
}

func (me *TestHelper) CreateUserOrGuest(guest bool) *model.User {
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
		if user, err = me.App.CreateGuest(user); err != nil {
			mlog.Error(err.Error())

			time.Sleep(time.Second)
			panic(err)
		}
	} else {
		if user, err = me.App.CreateUser(user); err != nil {
			mlog.Error(err.Error())

			time.Sleep(time.Second)
			panic(err)
		}
	}
	utils.EnableDebugLogForTest()
	return user
}

func (me *TestHelper) CreateBot() *model.Bot {
	id := model.NewId()

	bot := &model.Bot{
		Username:    "bot" + id,
		DisplayName: "a bot",
		Description: "bot",
		OwnerId:     me.BasicUser.Id,
	}

	me.App.Log().SetConsoleLevel(mlog.LevelError)
	bot, err := me.App.CreateBot(bot)
	if err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	me.App.Log().SetConsoleLevel(mlog.LevelDebug)
	return bot
}

func (me *TestHelper) CreateChannel(team *model.Team) *model.Channel {
	return me.createChannel(team, model.CHANNEL_OPEN)
}

func (me *TestHelper) CreatePrivateChannel(team *model.Team) *model.Channel {
	return me.createChannel(team, model.CHANNEL_PRIVATE)
}

func (me *TestHelper) createChannel(team *model.Team, channelType string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        "name_" + id,
		Type:        channelType,
		TeamId:      team.Id,
		CreatorId:   me.BasicUser.Id,
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if channel, err = me.App.CreateChannel(channel, true); err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return channel
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

func (me *TestHelper) CreateGroupChannel(user1 *model.User, user2 *model.User) *model.Channel {
	utils.DisableDebugLogForTest()
	var err *model.AppError
	var channel *model.Channel
	if channel, err = me.App.CreateGroupChannel([]string{me.BasicUser.Id, user1.Id, user2.Id}, me.BasicUser.Id); err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return channel
}

func (me *TestHelper) CreatePost(channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		UserId:    me.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "message_" + id,
		CreateAt:  model.GetMillis() - 10000,
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if post, err = me.App.CreatePost(post, channel, false, true); err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return post
}

func (me *TestHelper) CreateMessagePost(channel *model.Channel, message string) *model.Post {
	post := &model.Post{
		UserId:    me.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   message,
		CreateAt:  model.GetMillis() - 10000,
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if post, err = me.App.CreatePost(post, channel, false, true); err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return post
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

func (me *TestHelper) RemoveUserFromTeam(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	err := me.App.RemoveUserFromTeam(team.Id, user.Id, "")
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

func (me *TestHelper) CreateRole(roleName string) *model.Role {
	role, _ := me.App.CreateRole(&model.Role{Name: roleName, DisplayName: roleName, Description: roleName, Permissions: []string{}})
	return role
}

func (me *TestHelper) CreateScheme() (*model.Scheme, []*model.Role) {
	utils.DisableDebugLogForTest()

	scheme, err := me.App.CreateScheme(&model.Scheme{
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
		role, err := me.App.GetRoleByName(roleName)
		if err != nil {
			panic(err)
		}
		roles = append(roles, role)
	}

	utils.EnableDebugLogForTest()

	return scheme, roles
}

func (me *TestHelper) CreateGroup() *model.Group {
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
	if group, err = me.App.CreateGroup(group); err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return group
}

func (me *TestHelper) CreateEmoji() *model.Emoji {
	utils.DisableDebugLogForTest()

	emoji, err := me.App.Srv().Store.Emoji().Save(&model.Emoji{
		CreatorId: me.BasicUser.Id,
		Name:      model.NewRandomString(10),
	})
	if err != nil {
		panic(err)
	}

	utils.EnableDebugLogForTest()

	return emoji
}

func (me *TestHelper) AddReactionToPost(post *model.Post, user *model.User, emojiName string) *model.Reaction {
	utils.DisableDebugLogForTest()

	reaction, err := me.App.SaveReactionForPost(&model.Reaction{
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
	if me.IncludeCacheLayer {
		// Clean all the caches
		me.App.Srv().InvalidateAllCaches()
	}
	me.ShutdownApp()
	if me.tempWorkspace != "" {
		os.RemoveAll(me.tempWorkspace)
	}
}

func (me *TestHelper) GetSqlSupplier() *sqlstore.SqlSupplier {
	return mainHelper.GetSQLSupplier()
}

func (me *TestHelper) ResetRoleMigration() {
	sqlSupplier := mainHelper.GetSQLSupplier()
	if _, err := sqlSupplier.GetMaster().Exec("DELETE from Roles"); err != nil {
		panic(err)
	}

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	if _, err := sqlSupplier.GetMaster().Exec("DELETE from Systems where Name = :Name", map[string]interface{}{"Name": model.ADVANCED_PERMISSIONS_MIGRATION_KEY}); err != nil {
		panic(err)
	}
}

func (me *TestHelper) ResetEmojisMigration() {
	sqlSupplier := mainHelper.GetSQLSupplier()
	if _, err := sqlSupplier.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' create_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	if _, err := sqlSupplier.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' delete_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	if _, err := sqlSupplier.GetMaster().Exec("UPDATE Roles SET Permissions=REPLACE(Permissions, ' delete_others_emojis', '') WHERE builtin=True"); err != nil {
		panic(err)
	}

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	if _, err := sqlSupplier.GetMaster().Exec("DELETE from Systems where Name = :Name", map[string]interface{}{"Name": EMOJIS_PERMISSIONS_MIGRATION_KEY}); err != nil {
		panic(err)
	}
}

func (me *TestHelper) CheckTeamCount(t *testing.T, expected int64) {
	teamCount, err := me.App.Srv().Store.Team().AnalyticsTeamCount(false)
	require.Nil(t, err, "Failed to get team count.")
	require.Equalf(t, teamCount, expected, "Unexpected number of teams. Expected: %v, found: %v", expected, teamCount)
}

func (me *TestHelper) CheckChannelsCount(t *testing.T, expected int64) {
	count, err := me.App.Srv().Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN)
	require.Nilf(t, err, "Failed to get channel count.")
	require.Equalf(t, count, expected, "Unexpected number of channels. Expected: %v, found: %v", expected, count)
}

func (me *TestHelper) SetupTeamScheme() *model.Scheme {
	scheme := model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	if scheme, err := me.App.CreateScheme(&scheme); err == nil {
		return scheme
	} else {
		panic(err)
	}
}

func (me *TestHelper) SetupChannelScheme() *model.Scheme {
	scheme := model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SCHEME_SCOPE_CHANNEL,
	}

	if scheme, err := me.App.CreateScheme(&scheme); err == nil {
		return scheme
	} else {
		panic(err)
	}
}

func (me *TestHelper) SetupPluginAPI() *PluginAPI {
	manifest := &model.Manifest{
		Id: "pluginid",
	}

	return NewPluginAPI(me.App, manifest)
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
