// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"bytes"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"testing"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type TestHelper struct {
	App          *app.App
	Server       *app.Server
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

	memoryStore := config.NewTestMemoryStore()

	config := memoryStore.Get()
	if configSet != nil {
		configSet(config)
	}
	*config.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*config.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*config.LogSettings.EnableSentry = false // disable error reporting during tests
	memoryStore.Set(config)

	buffer := &bytes.Buffer{}

	var options []app.Option
	options = append(options, app.ConfigStore(memoryStore))
	options = append(options, app.StoreOverride(dbStore))
	options = append(options, app.SetLogger(mlog.NewTestingLogger(tb, buffer)))

	s, err := app.NewServer(options...)
	if err != nil {
		panic(err)
	}

	if includeCacheLayer {
		// Adds the cache layer to the test store
		s.Store = localcachelayer.NewLocalCacheLayer(s.Store, s.Metrics, s.Cluster, s.CacheProvider)
	}

	th := &TestHelper{
		App:               app.New(app.ServerConnector(s)),
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

func setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	return setupTestHelper(dbStore, false, true, tb, nil)
}

var initBasicOnce sync.Once
var userCache struct {
	SystemAdminUser *model.User
	BasicUser       *model.User
	BasicUser2      *model.User
}

func (me *TestHelper) initBasic() *TestHelper {
	// create users once and cache them because password hashing is slow
	initBasicOnce.Do(func() {
		me.SystemAdminUser = me.createUser()
		me.App.UpdateUserRoles(me.SystemAdminUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_ADMIN_ROLE_ID, false)
		me.SystemAdminUser, _ = me.App.GetUser(me.SystemAdminUser.Id)
		userCache.SystemAdminUser = me.SystemAdminUser.DeepCopy()

		me.BasicUser = me.createUser()
		me.BasicUser, _ = me.App.GetUser(me.BasicUser.Id)
		userCache.BasicUser = me.BasicUser.DeepCopy()

		me.BasicUser2 = me.createUser()
		me.BasicUser2, _ = me.App.GetUser(me.BasicUser2.Id)
		userCache.BasicUser2 = me.BasicUser2.DeepCopy()
	})
	// restore cached users
	me.SystemAdminUser = userCache.SystemAdminUser.DeepCopy()
	me.BasicUser = userCache.BasicUser.DeepCopy()
	me.BasicUser2 = userCache.BasicUser2.DeepCopy()
	mainHelper.GetSQLSupplier().GetMaster().Insert(me.SystemAdminUser, me.BasicUser, me.BasicUser2)

	me.BasicTeam = me.createTeam()

	me.linkUserToTeam(me.BasicUser, me.BasicTeam)
	me.linkUserToTeam(me.BasicUser2, me.BasicTeam)
	me.BasicChannel = me.CreateChannel(me.BasicTeam)
	me.BasicPost = me.createPost(me.BasicChannel)
	return me
}

func (me *TestHelper) createTeam() *model.Team {
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

func (me *TestHelper) createUser() *model.User {
	return me.createUserOrGuest(false)
}

func (me *TestHelper) createGuest() *model.User {
	return me.createUserOrGuest(true)
}

func (me *TestHelper) createUserOrGuest(guest bool) *model.User {
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

func (me *TestHelper) CreateChannel(team *model.Team) *model.Channel {
	return me.createChannel(team, model.CHANNEL_OPEN)
}

func (me *TestHelper) createPrivateChannel(team *model.Team) *model.Channel {
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

func (me *TestHelper) createChannelWithAnotherUser(team *model.Team, channelType, userId string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        "name_" + id,
		Type:        channelType,
		TeamId:      team.Id,
		CreatorId:   userId,
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

func (me *TestHelper) createDmChannel(user *model.User) *model.Channel {
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

func (me *TestHelper) createGroupChannel(user1 *model.User, user2 *model.User) *model.Channel {
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

func (me *TestHelper) createPost(channel *model.Channel) *model.Post {
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

func (me *TestHelper) linkUserToTeam(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	err := me.App.JoinUserToTeam(team, user, "")
	if err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) addUserToChannel(user *model.User, channel *model.Channel) *model.ChannelMember {
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

func (me *TestHelper) shutdownApp() {
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

func (me *TestHelper) tearDown() {
	if me.IncludeCacheLayer {
		// Clean all the caches
		me.App.Srv().InvalidateAllCaches()
	}
	me.shutdownApp()
	if me.tempWorkspace != "" {
		os.RemoveAll(me.tempWorkspace)
	}
}

func (me *TestHelper) removePermissionFromRole(permission string, roleName string) {
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

func (me *TestHelper) addPermissionToRole(permission string, roleName string) {
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
