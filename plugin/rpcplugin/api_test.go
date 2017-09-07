package rpcplugin

import (
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

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
	var api plugintest.API
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

	testTeam := &model.Team{
		Id: "theteamid",
	}
	teamNotFoundError := model.NewAppError("SqlTeamStore.GetByName", "store.sql_team.get_by_name.app_error", nil, "name=notateam", http.StatusNotFound)

	testUser := &model.User{
		Id: "theuserid",
	}

	testPost := &model.Post{
		Message: "hello",
	}

	api.On("GetChannelByName", "foo", "theteamid").Return(testChannel, nil)
	api.On("GetTeamByName", "foo").Return(testTeam, nil)
	api.On("GetTeamByName", "notateam").Return(nil, teamNotFoundError)
	api.On("GetUserByUsername", "foo").Return(testUser, nil)
	api.On("CreatePost", mock.AnythingOfType("*model.Post")).Return(func(p *model.Post) (*model.Post, *model.AppError) {
		p.Id = "thepostid"
		return p, nil
	})

	testAPIRPC(&api, func(remote plugin.API) {
		var config Config
		assert.NoError(t, remote.LoadPluginConfiguration(&config))
		assert.Equal(t, "foo", config.Foo)
		assert.Equal(t, "baz", config.Bar.Baz)

		channel, err := remote.GetChannelByName("foo", "theteamid")
		assert.Equal(t, testChannel, channel)
		assert.Nil(t, err)

		user, err := remote.GetUserByUsername("foo")
		assert.Equal(t, testUser, user)
		assert.Nil(t, err)

		team, err := remote.GetTeamByName("foo")
		assert.Equal(t, testTeam, team)
		assert.Nil(t, err)

		team, err = remote.GetTeamByName("notateam")
		assert.Nil(t, team)
		assert.Equal(t, teamNotFoundError, err)

		post, err := remote.CreatePost(testPost)
		assert.NotEmpty(t, post.Id)
		assert.Equal(t, testPost.Message, post.Message)
		assert.Nil(t, err)
	})
}
