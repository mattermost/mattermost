package app

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) OmniSearch(ctx request.CTX, terms string, userID string, isOrSearch bool, timeZoneOffset int, page int, perPage int) ([]*model.OmniSearchResult, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOmniSearch {
		return nil, model.NewAppError("OmniSearch", "store.sql_omnisearch.disabled", nil, fmt.Sprintf("userId=%v", userID), http.StatusNotImplemented)
	}
	searchResults := []*model.OmniSearchResult{}
	pluginContext := pluginContext(ctx)
	ctx.Logger().Warn("Running the OmniSearchHook", mlog.Int("plugin_hook_id", plugin.OnOmniSearchID))
	a.ch.RunMultiHook(func(hooks plugin.Hooks, manifest *model.Manifest) bool {
		ctx.Logger().Warn("Running the OmniSearchHook inside the plugin", mlog.Int("plugin_hook_id", plugin.OnOmniSearchID))
		results, err := hooks.OnOmniSearch(pluginContext, terms, userID, isOrSearch, timeZoneOffset, page, perPage)
		if err != nil {
			ctx.Logger().Warn("Failed to run OnOmniSearch on plugin", mlog.Err(err))
			return true
		}
		searchResults = append(searchResults, results...)
		return true
	}, plugin.OnOmniSearchID)

	return searchResults, nil
}
