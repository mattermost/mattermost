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

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("testElasticsearch", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	// no sniffing for ports or passwords
	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT) {
		if (*cfg.ElasticsearchSettings.ConnectionUrl != *c.App.Config().ElasticsearchSettings.ConnectionUrl) || (*cfg.ElasticsearchSettings.Password != model.FAKE_SETTING) {
			c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT)
			return
		}
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

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT)
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
