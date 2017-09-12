// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"

	l4g "github.com/alecthomas/log4go"
)

type TestHelper struct {
	App          *App
	BasicTeam    *model.Team
	BasicUser    *model.User
	BasicUser2   *model.User
	BasicChannel *model.Channel
	BasicPost    *model.Post
}

func setupTestHelper(enterprise bool) *TestHelper {
	th := &TestHelper{
		App: Global(),
	}

	if th.App.Srv == nil {
		utils.TranslationsPreInit()
		utils.LoadConfig("config.json")
		utils.InitTranslations(utils.Cfg.LocalizationSettings)
		*utils.Cfg.TeamSettings.MaxUsersPerTeam = 50
		*utils.Cfg.RateLimitSettings.Enable = false
		utils.DisableDebugLogForTest()
		th.App.NewServer()
		th.App.InitStores()
		th.App.StartServer()
		utils.InitHTML()
		utils.EnableDebugLogForTest()
		th.App.Srv.Store.MarkSystemRanUnitTests()

		*utils.Cfg.TeamSettings.EnableOpenServer = true
	}

	utils.SetIsLicensed(enterprise)
	if enterprise {
		utils.License().Features.SetDefaults()
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
	me.App.LinkUserToTeam(me.BasicUser, me.BasicTeam)
	me.BasicUser2 = me.CreateUser()
	me.App.LinkUserToTeam(me.BasicUser2, me.BasicTeam)
	me.BasicChannel = me.CreateChannel(me.BasicTeam)
	me.BasicPost = me.CreatePost(me.BasicChannel)

	return me
}

func (me *TestHelper) MakeUsername() string {
	return "un_" + model.NewId()
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
		l4g.Error(err.Error())
		l4g.Close()
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
		l4g.Error(err.Error())
		l4g.Close()
		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return user
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
		l4g.Error(err.Error())
		l4g.Close()
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
	}

	utils.DisableDebugLogForTest()
	var err *model.AppError
	if post, err = me.App.CreatePost(post, channel, false); err != nil {
		l4g.Error(err.Error())
		l4g.Close()
		time.Sleep(time.Second)
		panic(err)
	}
	utils.EnableDebugLogForTest()
	return post
}

func (a *App) LinkUserToTeam(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	err := a.JoinUserToTeam(team, user, "")
	if err != nil {
		l4g.Error(err.Error())
		l4g.Close()
		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (a *App) TearDown() {
	if a.Srv != nil {
		a.StopServer()
	}
}
