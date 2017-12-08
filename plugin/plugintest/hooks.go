// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugintest

import (
	"net/http"

	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type Hooks struct {
	mock.Mock
}

var _ plugin.Hooks = (*Hooks)(nil)

func (m *Hooks) OnActivate(api plugin.API) error {
	ret := m.Called(api)
	if f, ok := ret.Get(0).(func(plugin.API) error); ok {
		return f(api)
	}
	return ret.Error(0)
}

func (m *Hooks) OnDeactivate() error {
	return m.Called().Error(0)
}

func (m *Hooks) OnConfigurationChange() error {
	return m.Called().Error(0)
}

func (m *Hooks) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.Called(w, r)
}

func (m *Hooks) ExecuteCommand(args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	ret := m.Called(args)
	if f, ok := ret.Get(0).(func(*model.CommandArgs) (*model.CommandResponse, *model.AppError)); ok {
		return f(args)
	}
	resp, _ := ret.Get(0).(*model.CommandResponse)
	err, _ := ret.Get(1).(*model.AppError)
	return resp, err
}
