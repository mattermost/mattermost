// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"regexp"
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
	c.App.QueryHashTag(&c.Params.HashTagQuery, c.Params.Count)
}
