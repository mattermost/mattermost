package rpcplugin

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
)

func testAPIRPC(api plugin.API, f func(plugin.API)) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	c1 := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer c1.Close()

	c2 := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer c2.Close()

	id, server := c1.Serve()
	go ServeAPI(api, server, c1)

	remote := ConnectAPI(c2.Connect(id), c2)
	defer remote.Close()

	f(remote)
}

func TestAPI(t *testing.T) {
	keyValueStore := &plugintest.KeyValueStore{}
	api := plugintest.API{Store: keyValueStore}
	defer api.AssertExpectations(t)

	type Config struct {
		Foo string
		Bar struct {
			Baz string
		}
	}

	api.On("LoadPluginConfiguration", mock.MatchedBy(func(x interface{}) bool { return true })).Run(func(args mock.Arguments) {
		dest := args.Get(0).(interface{})
		json.Unmarshal([]byte(`{"Foo": "foo", "Bar": {"Baz": "baz"}}`), dest)
	}).Return(nil)

	testChannel := &model.Channel{
		Id: "thechannelid",
	}

	testChannelMember := &model.ChannelMember{
		ChannelId: "thechannelid",
		UserId:    "theuserid",
	}

	testTeam := &model.Team{
		Id: "theteamid",
	}
	teamNotFoundError := model.NewAppError("SqlTeamStore.GetByName", "store.sql_team.get_by_name.app_error", nil, "name=notateam", http.StatusNotFound)

	testUser := &model.User{
		Id: "theuserid",
	}

	testPost := &model.Post{
		Message: "hello",
		Props: map[string]interface{}{
			"attachments": []*model.SlackAttachment{
				&model.SlackAttachment{},
			},
		},
	}

	testAPIRPC(&api, func(remote plugin.API) {
		var config Config
		assert.NoError(t, remote.LoadPluginConfiguration(&config))
		assert.Equal(t, "foo", config.Foo)
		assert.Equal(t, "baz", config.Bar.Baz)

		api.On("RegisterCommand", mock.AnythingOfType("*model.Command")).Return(fmt.Errorf("foo")).Once()
		assert.Error(t, remote.RegisterCommand(&model.Command{}))
		api.On("RegisterCommand", mock.AnythingOfType("*model.Command")).Return(nil).Once()
		assert.NoError(t, remote.RegisterCommand(&model.Command{}))

		api.On("UnregisterCommand", "team", "trigger").Return(fmt.Errorf("foo")).Once()
		assert.Error(t, remote.UnregisterCommand("team", "trigger"))
		api.On("UnregisterCommand", "team", "trigger").Return(nil).Once()
		assert.NoError(t, remote.UnregisterCommand("team", "trigger"))

		api.On("CreateChannel", mock.AnythingOfType("*model.Channel")).Return(func(c *model.Channel) (*model.Channel, *model.AppError) {
			c.Id = "thechannelid"
			return c, nil
		}).Once()
		channel, err := remote.CreateChannel(testChannel)
		assert.Equal(t, "thechannelid", channel.Id)
		assert.Nil(t, err)

		api.On("DeleteChannel", "thechannelid").Return(nil).Once()
		assert.Nil(t, remote.DeleteChannel("thechannelid"))

		api.On("GetChannel", "thechannelid").Return(testChannel, nil).Once()
		channel, err = remote.GetChannel("thechannelid")
		assert.Equal(t, testChannel, channel)
		assert.Nil(t, err)

		api.On("GetChannelByName", "foo", "theteamid").Return(testChannel, nil).Once()
		channel, err = remote.GetChannelByName("foo", "theteamid")
		assert.Equal(t, testChannel, channel)
		assert.Nil(t, err)

		api.On("GetDirectChannel", "user1", "user2").Return(testChannel, nil).Once()
		channel, err = remote.GetDirectChannel("user1", "user2")
		assert.Equal(t, testChannel, channel)
		assert.Nil(t, err)

		api.On("GetGroupChannel", []string{"user1", "user2", "user3"}).Return(testChannel, nil).Once()
		channel, err = remote.GetGroupChannel([]string{"user1", "user2", "user3"})
		assert.Equal(t, testChannel, channel)
		assert.Nil(t, err)

		api.On("UpdateChannel", mock.AnythingOfType("*model.Channel")).Return(func(c *model.Channel) (*model.Channel, *model.AppError) {
			return c, nil
		}).Once()
		channel, err = remote.UpdateChannel(testChannel)
		assert.Equal(t, testChannel, channel)
		assert.Nil(t, err)

		api.On("GetChannelMember", "thechannelid", "theuserid").Return(testChannelMember, nil).Once()
		member, err := remote.GetChannelMember("thechannelid", "theuserid")
		assert.Equal(t, testChannelMember, member)
		assert.Nil(t, err)

		api.On("CreateUser", mock.AnythingOfType("*model.User")).Return(func(u *model.User) (*model.User, *model.AppError) {
			u.Id = "theuserid"
			return u, nil
		}).Once()
		user, err := remote.CreateUser(testUser)
		assert.Equal(t, "theuserid", user.Id)
		assert.Nil(t, err)

		api.On("DeleteUser", "theuserid").Return(nil).Once()
		assert.Nil(t, remote.DeleteUser("theuserid"))

		api.On("GetUser", "theuserid").Return(testUser, nil).Once()
		user, err = remote.GetUser("theuserid")
		assert.Equal(t, testUser, user)
		assert.Nil(t, err)

		api.On("GetUserByEmail", "foo@foo").Return(testUser, nil).Once()
		user, err = remote.GetUserByEmail("foo@foo")
		assert.Equal(t, testUser, user)
		assert.Nil(t, err)

		api.On("GetUserByUsername", "foo").Return(testUser, nil).Once()
		user, err = remote.GetUserByUsername("foo")
		assert.Equal(t, testUser, user)
		assert.Nil(t, err)

		api.On("UpdateUser", mock.AnythingOfType("*model.User")).Return(func(u *model.User) (*model.User, *model.AppError) {
			return u, nil
		}).Once()
		user, err = remote.UpdateUser(testUser)
		assert.Equal(t, testUser, user)
		assert.Nil(t, err)

		api.On("CreateTeam", mock.AnythingOfType("*model.Team")).Return(func(t *model.Team) (*model.Team, *model.AppError) {
			t.Id = "theteamid"
			return t, nil
		}).Once()
		team, err := remote.CreateTeam(testTeam)
		assert.Equal(t, "theteamid", team.Id)
		assert.Nil(t, err)

		api.On("DeleteTeam", "theteamid").Return(nil).Once()
		assert.Nil(t, remote.DeleteTeam("theteamid"))

		api.On("GetTeam", "theteamid").Return(testTeam, nil).Once()
		team, err = remote.GetTeam("theteamid")
		assert.Equal(t, testTeam, team)
		assert.Nil(t, err)

		api.On("GetTeamByName", "foo").Return(testTeam, nil).Once()
		team, err = remote.GetTeamByName("foo")
		assert.Equal(t, testTeam, team)
		assert.Nil(t, err)

		api.On("GetTeamByName", "notateam").Return(nil, teamNotFoundError).Once()
		team, err = remote.GetTeamByName("notateam")
		assert.Nil(t, team)
		assert.Equal(t, teamNotFoundError, err)

		api.On("UpdateTeam", mock.AnythingOfType("*model.Team")).Return(func(t *model.Team) (*model.Team, *model.AppError) {
			return t, nil
		}).Once()
		team, err = remote.UpdateTeam(testTeam)
		assert.Equal(t, testTeam, team)
		assert.Nil(t, err)

		api.On("CreatePost", mock.AnythingOfType("*model.Post")).Return(func(p *model.Post) (*model.Post, *model.AppError) {
			p.Id = "thepostid"
			return p, nil
		}).Once()
		post, err := remote.CreatePost(testPost)
		require.Nil(t, err)
		assert.NotEmpty(t, post.Id)
		assert.Equal(t, testPost.Message, post.Message)

		api.On("DeletePost", "thepostid").Return(nil).Once()
		assert.Nil(t, remote.DeletePost("thepostid"))

		api.On("GetPost", "thepostid").Return(testPost, nil).Once()
		post, err = remote.GetPost("thepostid")
		assert.Equal(t, testPost, post)
		assert.Nil(t, err)

		api.On("UpdatePost", mock.AnythingOfType("*model.Post")).Return(func(p *model.Post) (*model.Post, *model.AppError) {
			return p, nil
		}).Once()
		post, err = remote.UpdatePost(testPost)
		assert.Equal(t, testPost, post)
		assert.Nil(t, err)

		api.KeyValueStore().(*plugintest.KeyValueStore).On("Set", "thekey", []byte("thevalue")).Return(nil).Once()
		err = remote.KeyValueStore().Set("thekey", []byte("thevalue"))
		assert.Nil(t, err)

		api.KeyValueStore().(*plugintest.KeyValueStore).On("Get", "thekey").Return(func(key string) ([]byte, *model.AppError) {
			return []byte("thevalue"), nil
		}).Once()
		ret, err := remote.KeyValueStore().Get("thekey")
		assert.Nil(t, err)
		assert.Equal(t, []byte("thevalue"), ret)

		api.KeyValueStore().(*plugintest.KeyValueStore).On("Delete", "thekey").Return(nil).Once()
		err = remote.KeyValueStore().Delete("thekey")
		assert.Nil(t, err)
	})
}
