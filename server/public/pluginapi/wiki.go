package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/plugin"
)

// WikiService exposes methods to manipulate wikis and pages.
type WikiService struct {
	api plugin.API
}

// LinkPageToFirstWiki links a page to the first wiki in the given channel.
// If no wiki exists, an error is returned.
//
// Minimum server version: 10.5
func (w *WikiService) LinkPageToFirstWiki(pageID, channelID string) error {
	appErr := w.api.LinkPageToFirstWiki(pageID, channelID)
	return normalizeAppErr(appErr)
}
