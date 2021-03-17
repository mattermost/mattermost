// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
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

	// PERMISSION_TEST_ELASTICSEARCH is an ancillary permission of PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_ELASTICSEARCH,
	// which should prevent read-only managers from password sniffing
	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_TEST_ELASTICSEARCH) {
		c.SetPermissionError(model.PERMISSION_TEST_ELASTICSEARCH)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("testElasticsearch", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.TestElasticsearch(cfg); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func purgeElasticsearchIndexes(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("purgeElasticsearchIndexes", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_PURGE_ELASTICSEARCH_INDEXES) {
		c.SetPermissionError(model.PERMISSION_PURGE_ELASTICSEARCH_INDEXES)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("purgeElasticsearchIndexes", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.PurgeElasticsearchIndexes(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
