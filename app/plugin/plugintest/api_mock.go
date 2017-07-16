package plugintest

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app/plugin"
	"github.com/mattermost/platform/model"
	"github.com/stretchr/testify/mock"
)

type APIMock struct {
	mock.Mock
	plugin.API

	router *mux.Router
}

func (m *APIMock) LoadPluginConfiguration(dest interface{}) error {
	return m.Called(dest).Error(0)
}

func (m *APIMock) PluginRouter() *mux.Router {
	if m.router == nil {
		m.router = mux.NewRouter()
	}
	return m.router
}

func (m *APIMock) GetTeamByName(name string) (*model.Team, *model.AppError) {
	ret := m.Called(name)
	if f, ok := ret.Get(0).(func(string) (*model.Team, *model.AppError)); ok {
		return f(name)
	}
	return ret.Get(0).(*model.Team), ret.Get(1).(*model.AppError)
}

func (m *APIMock) GetUserByName(name string) (*model.User, *model.AppError) {
	ret := m.Called(name)
	if f, ok := ret.Get(0).(func(string) (*model.User, *model.AppError)); ok {
		return f(name)
	}
	return ret.Get(0).(*model.User), ret.Get(1).(*model.AppError)
}

func (m *APIMock) GetChannelByName(teamId, name string) (*model.Channel, *model.AppError) {
	ret := m.Called(teamId, name)
	if f, ok := ret.Get(0).(func(string, string) (*model.Channel, *model.AppError)); ok {
		return f(teamId, name)
	}
	return ret.Get(0).(*model.Channel), ret.Get(1).(*model.AppError)
}

func (m *APIMock) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	ret := m.Called(userId1, userId2)
	if f, ok := ret.Get(0).(func(string, string) (*model.Channel, *model.AppError)); ok {
		return f(userId1, userId2)
	}
	return ret.Get(0).(*model.Channel), ret.Get(1).(*model.AppError)
}

func (m *APIMock) CreatePost(teamId, userId, channelId, text string) (*model.Post, *model.AppError) {
	ret := m.Called(teamId, userId, channelId, text)
	if f, ok := ret.Get(0).(func(string, string, string, string) (*model.Post, *model.AppError)); ok {
		return f(teamId, userId, channelId, text)
	}
	return ret.Get(0).(*model.Post), ret.Get(1).(*model.AppError)
}

func (m *APIMock) I18n(id string, r *http.Request) string {
	return id
}
