// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// const (
// 	MaxAddMembersBatch    = 256
// 	MaximumBulkImportSize = 10 * 1024 * 1024
// 	groupIDsParamPattern  = "[^a-zA-Z0-9,]*"
// )

// var groupIDsQueryParamRegex *regexp.Regexp

func init() {
	groupIDsQueryParamRegex = regexp.MustCompile(groupIDsParamPattern)
}

func (api *API) InitHashTag() {

	api.BaseRoutes.HashTag.Handle("", api.APISessionRequired(api.suggestHashTag)).Methods("GET")
}

func (api *API) suggestHashTag(c *Context, w http.ResponseWriter, r *http.Request) {
	limit := r.URL.Query().Get("limit")
	limitInt := uint64(10) // By default, always set to 10
	var err2 error
	if limit != "" {
		limitInt, err2 = strconv.ParseUint(limit, 10, 64)
		if err2 != nil {
			mlog.Warn("Failed to parse limit URL query parameter from createPost request", mlog.Err(err2))
			limitInt = 10 // Set to 10 nonetheless
		}
	}
	hash_tags, err := c.App.QueryHashTag(&c.Params.HashTagQuery, limitInt)
	if err != nil {
		_ = hash_tags
		c.Err = err
	}
	js, jsonErr := json.Marshal(hash_tags)
	if jsonErr != nil {
		c.Err = model.NewAppError("suggestHashTag", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "max-age=2592000, private")
	w.Write(js)
}
