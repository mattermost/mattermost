package plugintest

import (
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/platform/plugin"
)

type API struct {
	mock.Mock
}

var _ plugin.API = (*API)(nil)

func (m *API) LoadPluginConfiguration(dest interface{}) error {
	return m.Called(dest).Error(0)
}
