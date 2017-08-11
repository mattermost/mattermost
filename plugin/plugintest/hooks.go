package plugintest

import (
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/platform/plugin"
)

type Hooks struct {
	mock.Mock
}

var _ plugin.Hooks = (*Hooks)(nil)

func (m *Hooks) OnActivate(api plugin.API) {
	m.Called(api)
}

func (m *Hooks) OnDeactivate() {
	m.Called()
}
