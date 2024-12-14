package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitOmniSearch() {
	api.BaseRoutes.OmniSearch.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchInOmniSearch)).Methods("POST")
}

func searchInOmniSearch(c *Context, w http.ResponseWriter, r *http.Request) {
	var params model.SearchParameter
	if jsonErr := json.NewDecoder(r.Body).Decode(&params); jsonErr != nil {
		c.Err = model.NewAppError("searchPosts", "api.post.search_posts.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(jsonErr)
		return
	}

	if params.Terms == nil || *params.Terms == "" {
		c.SetInvalidParam("terms")
		return
	}
	terms := *params.Terms

	timeZoneOffset := 0
	if params.TimeZoneOffset != nil {
		timeZoneOffset = *params.TimeZoneOffset
	}

	isOrSearch := false
	if params.IsOrSearch != nil {
		isOrSearch = *params.IsOrSearch
	}

	page := 0
	if params.Page != nil {
		page = *params.Page
	}

	perPage := 60
	if params.PerPage != nil {
		perPage = *params.PerPage
	}

	results, appErr := c.App.OmniSearch(c.AppContext, terms, c.AppContext.Session().UserId, isOrSearch, timeZoneOffset, page, perPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	resultsData, err := json.Marshal(results)
	if err != nil {
		c.Err = model.NewAppError("Api4.omniSearch", "api.omnisearch.search.invalid_response", nil, "", http.StatusBadRequest)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if _, err := w.Write(resultsData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
