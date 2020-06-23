package freetextfetcher

import (
	"github.com/mattermost/mattermost-plugin-api/experimental/bot/logger"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

type Manager interface {
	MessageHasBeenPosted(c *plugin.Context, post *model.Post, api plugin.API, l logger.Logger, botUserID string, pluginURL string)
	Clear()
}

type manager struct {
	ftfList []FreetextFetcher
}

var ftfManager manager

func GetManager() Manager {
	if ftfManager.ftfList == nil {
		ftfManager.ftfList = []FreetextFetcher{}
	}
	return &ftfManager
}

func (m *manager) Clear() {
	m.ftfList = []FreetextFetcher{}
}

func (m *manager) MessageHasBeenPosted(c *plugin.Context, post *model.Post, api plugin.API, l logger.Logger, botUserID, pluginURL string) {
	for _, v := range m.ftfList {
		v.MessageHasBeenPosted(c, post, api, l, botUserID, pluginURL)
	}
}
