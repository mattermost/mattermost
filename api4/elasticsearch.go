// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitElasticsearch() {
	l4g.Debug(utils.T("api.elasticsearch.init.debug"))

	BaseRoutes.Elasticsearch.Handle("/test", ApiSessionRequired(testElasticsearch)).Methods("POST")
}

func testElasticsearch(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := app.TestElasticsearch(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
