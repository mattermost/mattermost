package plugintest

import (
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/platform/plugin"
)

type Hooks struct {
	mock.Mock
}

var _ plugin.Hooks = (*Hooks)(nil)

func (m *Hooks) OnActivate(api plugin.API) error {
	return m.Called(api).Error(0)
}

func (m *Hooks) OnDeactivate() error {
	return m.Called().Error(0)
}
