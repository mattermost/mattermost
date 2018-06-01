// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package migrations

import (
	"io"
	"io/ioutil"
	"os"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

type TestHelper struct {
	App          *app.App
	BasicTeam    *model.Team
	BasicUser    *model.User
	BasicUser2   *model.User
	BasicChannel *model.Channel
	BasicPost    *model.Post

	SystemAdminUser *model.User

	tempConfigPath string
	tempWorkspace  string
}

type persistentTestStore struct {
	store.Store
}

func (*persistentTestStore) Close() {}

var testStoreContainer *storetest.RunningContainer
var testStore *persistentTestStore
var testStoreSqlSupplier *sqlstore.SqlSupplier
var testClusterInterface *FakeClusterInterface

// UseTestStore sets the container and corresponding settings to use for tests. Once the tests are
// complete (e.g. at the end of your TestMain implementation), you should call StopTestStore.
func UseTestStore(container *storetest.RunningContainer, settings *model.SqlSettings) {
	testClusterInterface = &FakeClusterInterface{}
	testStoreContainer = container
	testStoreSqlSupplier = sqlstore.NewSqlSupplier(*settings, nil)
	testStore = &persistentTestStore{store.NewLayeredStore(testStoreSqlSupplier, nil, testClusterInterface)}
}

func StopTestStore() {
	if testStoreContainer != nil {
		testStoreContainer.Stop()
		testStoreContainer = nil
	}
}

func setupTestHelper(enterprise bool) *TestHelper {
	permConfig, err := os.Open(utils.FindConfigFile("config.json"))
	if err != nil {
		panic(err)
	}
	defer permConfig.Close()
	tempConfig, err := ioutil.TempFile("", "")
	if err != nil {
		panic(err)
	}
	_, err = io.Copy(tempConfig, permConfig)
	tempConfig.Close()
	if err != nil {
		panic(err)
	}

	options := []app.Option{app.ConfigFile(tempConfig.Name()), app.DisableConfigWatch}
	if testStore != nil {
		options = append(options, app.StoreOverride(testStore))
	}

	a, err := app.New(options...)
	if err != nil {
		panic(err)
	}

	th := &TestHelper{
		App:            a,
		tempConfigPath: tempConfig.Name(),
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 50 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.RateLimitSettings.Enable = false })
	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	if testStore != nil {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	}
	serverErr := th.App.StartServer()
	if serverErr != nil {
		panic(serverErr)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	th.App.DoAdvancedPermissionsMigration()
	th.App.DoEmojisPermissionsMigration()

	th.App.Srv.Store.MarkSystemRanUnitTests()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = true })

	if enterprise {
		th.App.SetLicense(model.NewTestLicense())
	} else {
		th.App.SetLicense(nil)
	}

	return th
}

func SetupEnterprise() *TestHelper {
	return setupTestHelper(true)
}

func Setup() *TestHelper {
	return setupTestHelper(false)
}

func (me *TestHelper) InitBasic() *TestHelper {
	me.BasicTeam = me.CreateTeam()
	me.BasicUser = me.CreateUser()
	me.LinkUserToTeam(me.BasicUser, me.BasicTeam)
	me.BasicUser2 = me.CreateUser()
	me.LinkUserToTeam(me.BasicUser2, me.BasicTeam)
	me.BasicChannel = me.CreateChannel(me.BasicTeam)
	me.BasicPost = me.CreatePost(me.BasicChannel)

	return me
}

func (me *TestHelper) InitSystemAdmin() *TestHelper {
	me.SystemAdminUser = me.CreateUser()
	me.App.UpdateUserRoles(me.SystemAdminUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_ADMIN_ROLE_ID, false)
	me.SystemAdminUser, _ = me.App.GetUser(me.SystemAdminUser.Id)

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
	if user, err = me.App.CreateUser(user); err != nil {
		mlog.Error(err.Error())

		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return user
}

func (me *TestHelper) CreateChannel(team *model.Team) *model.Channel {
	return me.createChannel(team, model.CHANNEL_OPEN)
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
	if channel, err = me.App.CreateDirectChannel(me.BasicUser.Id, user.Id); err != nil {
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
	if post, err = me.App.CreatePost(post, channel, false); err != nil {
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

func (me *TestHelper) TearDown() {
	me.App.Shutdown()
	os.Remove(me.tempConfigPath)
	if err := recover(); err != nil {
		StopTestStore()
		panic(err)
	}
	if me.tempWorkspace != "" {
		os.RemoveAll(me.tempWorkspace)
	}
}

func (me *TestHelper) ResetRoleMigration() {
	if _, err := testStoreSqlSupplier.GetMaster().Exec("DELETE from Roles"); err != nil {
		panic(err)
	}

	testClusterInterface.sendClearRoleCacheMessage()

	if _, err := testStoreSqlSupplier.GetMaster().Exec("DELETE from Systems where Name = :Name", map[string]interface{}{"Name": app.ADVANCED_PERMISSIONS_MIGRATION_KEY}); err != nil {
		panic(err)
	}
}

func (me *TestHelper) DeleteAllJobsByTypeAndMigrationKey(jobType string, migrationKey string) {
	if res := <-me.App.Srv.Store.Job().GetAllByType(model.JOB_TYPE_MIGRATIONS); res.Err != nil {
		panic(res.Err)
	} else {
		jobs := res.Data.([]*model.Job)

		for _, job := range jobs {
			if key, ok := job.Data[JOB_DATA_KEY_MIGRATION]; ok && key == migrationKey {
				if res := <-me.App.Srv.Store.Job().Delete(job.Id); res.Err != nil {
					panic(res.Err)
				}
			}
		}
	}
}

type FakeClusterInterface struct {
	clusterMessageHandler einterfaces.ClusterMessageHandler
}

func (me *FakeClusterInterface) StartInterNodeCommunication() {}
func (me *FakeClusterInterface) StopInterNodeCommunication()  {}
func (me *FakeClusterInterface) RegisterClusterMessageHandler(event string, crm einterfaces.ClusterMessageHandler) {
	me.clusterMessageHandler = crm
}
func (me *FakeClusterInterface) GetClusterId() string                             { return "" }
func (me *FakeClusterInterface) IsLeader() bool                                   { return false }
func (me *FakeClusterInterface) GetMyClusterInfo() *model.ClusterInfo             { return nil }
func (me *FakeClusterInterface) GetClusterInfos() []*model.ClusterInfo            { return nil }
func (me *FakeClusterInterface) SendClusterMessage(cluster *model.ClusterMessage) {}
func (me *FakeClusterInterface) NotifyMsg(buf []byte)                             {}
func (me *FakeClusterInterface) GetClusterStats() ([]*model.ClusterStats, *model.AppError) {
	return nil, nil
}
func (me *FakeClusterInterface) GetLogs(page, perPage int) ([]string, *model.AppError) {
	return []string{}, nil
}
func (me *FakeClusterInterface) ConfigChanged(previousConfig *model.Config, newConfig *model.Config, sendToOtherServer bool) *model.AppError {
	return nil
}
func (me *FakeClusterInterface) sendClearRoleCacheMessage() {
	me.clusterMessageHandler(&model.ClusterMessage{
		Event: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES,
	})
}
func (me *FakeClusterInterface) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	return nil, nil
}
