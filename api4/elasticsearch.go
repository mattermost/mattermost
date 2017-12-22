// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitElasticsearch() {
	api.BaseRoutes.Elasticsearch.Handle("/test", api.ApiSessionRequired(testElasticsearch)).Methods("POST")
	api.BaseRoutes.Elasticsearch.Handle("/purge_indexes", api.ApiSessionRequired(purgeElasticsearchIndexes)).Methods("POST")
}

func testElasticsearch(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		cfg = c.App.Config()
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.TestElasticsearch(cfg); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func purgeElasticsearchIndexes(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.PurgeElasticsearchIndexes(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
