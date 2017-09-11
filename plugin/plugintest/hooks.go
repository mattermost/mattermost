package plugintest

import (
	"net/http"

	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/plugin"
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

func (m *Hooks) OnConfigurationChange() error {
	return m.Called().Error(0)
}

func (m *Hooks) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.Called(w, r)
}
