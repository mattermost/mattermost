// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugintest

import (
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type API struct {
	mock.Mock
	Store *KeyValueStore
}

type KeyValueStore struct {
	mock.Mock
}

var _ plugin.API = (*API)(nil)
var _ plugin.KeyValueStore = (*KeyValueStore)(nil)

func (m *API) LoadPluginConfiguration(dest interface{}) error {
	ret := m.Called(dest)
	if f, ok := ret.Get(0).(func(interface{}) error); ok {
		return f(dest)
	}
	return ret.Error(0)
}

func (m *API) RegisterCommand(command *model.Command) error {
	ret := m.Called(command)
	if f, ok := ret.Get(0).(func(*model.Command) error); ok {
		return f(command)
	}
	return ret.Error(0)
}

func (m *API) UnregisterCommand(teamId, trigger string) error {
	ret := m.Called(teamId, trigger)
	if f, ok := ret.Get(0).(func(string, string) error); ok {
		return f(teamId, trigger)
	}
	return ret.Error(0)
}

func (m *API) CreateUser(user *model.User) (*model.User, *model.AppError) {
	ret := m.Called(user)
	if f, ok := ret.Get(0).(func(*model.User) (*model.User, *model.AppError)); ok {
		return f(user)
	}
	userOut, _ := ret.Get(0).(*model.User)
	err, _ := ret.Get(1).(*model.AppError)
	return userOut, err
}

func (m *API) DeleteUser(userId string) *model.AppError {
	ret := m.Called(userId)
	if f, ok := ret.Get(0).(func(string) *model.AppError); ok {
		return f(userId)
	}
	err, _ := ret.Get(0).(*model.AppError)
	return err
}

func (m *API) GetUser(userId string) (*model.User, *model.AppError) {
	ret := m.Called(userId)
	if f, ok := ret.Get(0).(func(string) (*model.User, *model.AppError)); ok {
		return f(userId)
	}
	user, _ := ret.Get(0).(*model.User)
	err, _ := ret.Get(1).(*model.AppError)
	return user, err
}

func (m *API) GetUserByEmail(email string) (*model.User, *model.AppError) {
	ret := m.Called(email)
	if f, ok := ret.Get(0).(func(string) (*model.User, *model.AppError)); ok {
		return f(email)
	}
	user, _ := ret.Get(0).(*model.User)
	err, _ := ret.Get(1).(*model.AppError)
	return user, err
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

func (m *API) UpdateUser(user *model.User) (*model.User, *model.AppError) {
	ret := m.Called(user)
	if f, ok := ret.Get(0).(func(*model.User) (*model.User, *model.AppError)); ok {
		return f(user)
	}
	userOut, _ := ret.Get(0).(*model.User)
	err, _ := ret.Get(1).(*model.AppError)
	return userOut, err
}

func (m *API) CreateTeam(team *model.Team) (*model.Team, *model.AppError) {
	ret := m.Called(team)
	if f, ok := ret.Get(0).(func(*model.Team) (*model.Team, *model.AppError)); ok {
		return f(team)
	}
	teamOut, _ := ret.Get(0).(*model.Team)
	err, _ := ret.Get(1).(*model.AppError)
	return teamOut, err
}

func (m *API) DeleteTeam(teamId string) *model.AppError {
	ret := m.Called(teamId)
	if f, ok := ret.Get(0).(func(string) *model.AppError); ok {
		return f(teamId)
	}
	err, _ := ret.Get(0).(*model.AppError)
	return err
}

func (m *API) GetTeam(teamId string) (*model.Team, *model.AppError) {
	ret := m.Called(teamId)
	if f, ok := ret.Get(0).(func(string) (*model.Team, *model.AppError)); ok {
		return f(teamId)
	}
	team, _ := ret.Get(0).(*model.Team)
	err, _ := ret.Get(1).(*model.AppError)
	return team, err
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

func (m *API) UpdateTeam(team *model.Team) (*model.Team, *model.AppError) {
	ret := m.Called(team)
	if f, ok := ret.Get(0).(func(*model.Team) (*model.Team, *model.AppError)); ok {
		return f(team)
	}
	teamOut, _ := ret.Get(0).(*model.Team)
	err, _ := ret.Get(1).(*model.AppError)
	return teamOut, err
}

func (m *API) CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	ret := m.Called(channel)
	if f, ok := ret.Get(0).(func(*model.Channel) (*model.Channel, *model.AppError)); ok {
		return f(channel)
	}
	channelOut, _ := ret.Get(0).(*model.Channel)
	err, _ := ret.Get(1).(*model.AppError)
	return channelOut, err
}

func (m *API) DeleteChannel(channelId string) *model.AppError {
	ret := m.Called(channelId)
	if f, ok := ret.Get(0).(func(string) *model.AppError); ok {
		return f(channelId)
	}
	err, _ := ret.Get(0).(*model.AppError)
	return err
}

func (m *API) GetChannel(channelId string) (*model.Channel, *model.AppError) {
	ret := m.Called(channelId)
	if f, ok := ret.Get(0).(func(string) (*model.Channel, *model.AppError)); ok {
		return f(channelId)
	}
	channel, _ := ret.Get(0).(*model.Channel)
	err, _ := ret.Get(1).(*model.AppError)
	return channel, err
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

func (m *API) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	ret := m.Called(userId1, userId2)
	if f, ok := ret.Get(0).(func(_, _ string) (*model.Channel, *model.AppError)); ok {
		return f(userId1, userId2)
	}
	channel, _ := ret.Get(0).(*model.Channel)
	err, _ := ret.Get(1).(*model.AppError)
	return channel, err
}

func (m *API) GetGroupChannel(userIds []string) (*model.Channel, *model.AppError) {
	ret := m.Called(userIds)
	if f, ok := ret.Get(0).(func([]string) (*model.Channel, *model.AppError)); ok {
		return f(userIds)
	}
	channel, _ := ret.Get(0).(*model.Channel)
	err, _ := ret.Get(1).(*model.AppError)
	return channel, err
}

func (m *API) UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	ret := m.Called(channel)
	if f, ok := ret.Get(0).(func(*model.Channel) (*model.Channel, *model.AppError)); ok {
		return f(channel)
	}
	channelOut, _ := ret.Get(0).(*model.Channel)
	err, _ := ret.Get(1).(*model.AppError)
	return channelOut, err
}

func (m *API) GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	ret := m.Called(channelId, userId)
	if f, ok := ret.Get(0).(func(_, _ string) (*model.ChannelMember, *model.AppError)); ok {
		return f(channelId, userId)
	}
	member, _ := ret.Get(0).(*model.ChannelMember)
	err, _ := ret.Get(1).(*model.AppError)
	return member, err
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

func (m *API) DeletePost(postId string) *model.AppError {
	ret := m.Called(postId)
	if f, ok := ret.Get(0).(func(string) *model.AppError); ok {
		return f(postId)
	}
	err, _ := ret.Get(0).(*model.AppError)
	return err
}

func (m *API) GetPost(postId string) (*model.Post, *model.AppError) {
	ret := m.Called(postId)
	if f, ok := ret.Get(0).(func(string) (*model.Post, *model.AppError)); ok {
		return f(postId)
	}
	post, _ := ret.Get(0).(*model.Post)
	err, _ := ret.Get(1).(*model.AppError)
	return post, err
}

func (m *API) UpdatePost(post *model.Post) (*model.Post, *model.AppError) {
	ret := m.Called(post)
	if f, ok := ret.Get(0).(func(*model.Post) (*model.Post, *model.AppError)); ok {
		return f(post)
	}
	postOut, _ := ret.Get(0).(*model.Post)
	err, _ := ret.Get(1).(*model.AppError)
	return postOut, err
}

func (m *API) KeyValueStore() plugin.KeyValueStore {
	return m.Store
}

func (m *KeyValueStore) Set(key string, value []byte) *model.AppError {
	ret := m.Called(key, value)
	if f, ok := ret.Get(0).(func(string, []byte) *model.AppError); ok {
		return f(key, value)
	}
	err, _ := ret.Get(0).(*model.AppError)
	return err
}

func (m *KeyValueStore) Get(key string) ([]byte, *model.AppError) {
	ret := m.Called(key)
	if f, ok := ret.Get(0).(func(string) ([]byte, *model.AppError)); ok {
		return f(key)
	}
	psv, _ := ret.Get(0).([]byte)
	err, _ := ret.Get(1).(*model.AppError)
	return psv, err
}

func (m *KeyValueStore) Delete(key string) *model.AppError {
	ret := m.Called(key)
	if f, ok := ret.Get(0).(func(string) *model.AppError); ok {
		return f(key)
	}
	err, _ := ret.Get(0).(*model.AppError)
	return err
}
