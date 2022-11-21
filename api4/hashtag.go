// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"github.com/mattermost/mattermost-server/v6/model/sort"
	"net/http"
	"regexp"
)

func init() {
	groupIDsQueryParamRegex = regexp.MustCompile(groupIDsParamPattern)
}

func (api *API) InitHashtag() {

	api.BaseRoutes.HashTags.Handle("", api.APISessionRequired(api.getHashTags)).Methods("GET")
	api.BaseRoutes.HashTags.Handle("", api.APISessionRequired(api.getHashTags)).Methods("GET")
}

func (api *API) getHashTags(c *Context, w http.ResponseWriter, r *http.Request) {
	querySort := r.URL.Query().Get("sort")
	query := r.URL.Query().Get("query")

	if query != "" {
		api.suggestHashTag(c, w, r)
		return
	}

	var sortToUse sort.Sort
	if querySort == "messages[asc]" {
		sortToUse = sort.Asc
	} else if querySort == "messages[desc]" {
		sortToUse = sort.Desc
	} else {
		sortToUse = ""
	}

	if sortToUse != "" {
		hashtags, _ := c.App.Srv().GetStore().Hashtag().GetMostCommon(sortToUse)
		response, _ := json.Marshal(hashtags)
		w.Write(response)
		return
	}

	hashtags, _ := c.App.Srv().GetStore().Hashtag().GetAll()
	response, _ := json.Marshal(hashtags)
	w.Write(response)
}

func (api *API) suggestHashTag(c *Context, w http.ResponseWriter, r *http.Request) {
	hashtags, _ := c.App.Srv().GetStore().Hashtag().SearchForUser(r.URL.Query().Get("query"), c.AppContext.Session().UserId)

	response, _ := json.Marshal(hashtags)
	w.Write(response)
}
