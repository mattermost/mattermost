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

func (m *APIMock) LoadConfiguration(dest interface{}) error {
	return m.Called(dest).Error(0)
}

func (m *APIMock) Router() *mux.Router {
	if m.router == nil {
		m.router = mux.NewRouter()
	}
	return m.router
}

func (m *APIMock) CreatePost(teamId, userId, channelNameOrId, text string) (*model.Post, *model.AppError) {
	ret := m.Called(teamId, userId, channelNameOrId, text)
	return ret.Get(0).(*model.Post), ret.Get(1).(*model.AppError)
}

func (m *APIMock) I18n(id string, r *http.Request) string {
	return id
}
