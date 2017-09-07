package plugintest

import (
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type API struct {
	mock.Mock
}

var _ plugin.API = (*API)(nil)

func (m *API) LoadPluginConfiguration(dest interface{}) error {
	return m.Called(dest).Error(0)
}

func (m *API) GetTeamByName(name string) (*model.Team, *model.AppError) {
	ret := m.Called(name)
	if f, ok := ret.Get(0).(func(string) (*model.Team, *model.AppError)); ok {
		return f(name)
	}
	team, _ := ret.Get(0).(*model.Team)
	err, _ := ret.Get(1).(*model.AppError)
	return team, err
}

func (m *API) GetUserByUsername(name string) (*model.User, *model.AppError) {
	ret := m.Called(name)
	if f, ok := ret.Get(0).(func(string) (*model.User, *model.AppError)); ok {
		return f(name)
	}
	user, _ := ret.Get(0).(*model.User)
	err, _ := ret.Get(1).(*model.AppError)
	return user, err
}

func (m *API) GetChannelByName(name, teamId string) (*model.Channel, *model.AppError) {
	ret := m.Called(name, teamId)
	if f, ok := ret.Get(0).(func(_, _ string) (*model.Channel, *model.AppError)); ok {
		return f(name, teamId)
	}
	channel, _ := ret.Get(0).(*model.Channel)
	err, _ := ret.Get(1).(*model.AppError)
	return channel, err
}

func (m *API) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	ret := m.Called(post)
	if f, ok := ret.Get(0).(func(*model.Post) (*model.Post, *model.AppError)); ok {
		return f(post)
	}
	postOut, _ := ret.Get(0).(*model.Post)
	err, _ := ret.Get(1).(*model.AppError)
	return postOut, err
}
