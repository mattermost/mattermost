package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// WikiService exposes methods to manipulate wikis and pages.
type WikiService struct {
	api plugin.API
}

// GetFirstWikiForChannel retrieves the ID of the first wiki in the given channel.
// If no wiki exists, an error is returned.
//
// Minimum server version: 10.10
func (w *WikiService) GetFirstWikiForChannel(channelID string) (string, error) {
	wikiID, appErr := w.api.GetFirstWikiForChannel(channelID)
	return wikiID, normalizeAppErr(appErr)
}

// CreatePage creates a new wiki page with the given title and content on behalf of the specified user.
// The userID parameter specifies which user is creating the page (for permission checks and attribution).
// Returns the created page.
//
// Minimum server version: 10.10
func (w *WikiService) CreatePage(wikiID, title, content, userID string) (*model.Page, error) {
	page, appErr := w.api.CreateWikiPage(wikiID, title, content, userID)
	return page, normalizeAppErr(appErr)
}
