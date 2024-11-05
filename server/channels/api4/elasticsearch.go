// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitElasticsearch() {
	api.BaseRoutes.Elasticsearch.Handle("/test", api.APISessionRequired(testElasticsearch)).Methods(http.MethodPost)
	api.BaseRoutes.Elasticsearch.Handle("/purge_indexes", api.APISessionRequired(purgeElasticsearchIndexes)).Methods(http.MethodPost)
}

func testElasticsearch(c *Context, w http.ResponseWriter, r *http.Request) {
	var cfg *model.Config
	err := json.NewDecoder(r.Body).Decode(&cfg)
	if err != nil {
		c.Logger.Warn("Error decoding config.", mlog.Err(err))
	}
	if cfg == nil {
		cfg = c.App.Config()
	}

	// we set BulkIndexingTimeWindowSeconds to a random value to avoid failing on the nil check
	// TODO: remove this hack once we remove BulkIndexingTimeWindowSeconds from the config.
	if cfg.ElasticsearchSettings.BulkIndexingTimeWindowSeconds == nil {
		cfg.ElasticsearchSettings.BulkIndexingTimeWindowSeconds = model.NewPointer(0)
	}
	if checkHasNilFields(&cfg.ElasticsearchSettings) {
		c.Err = model.NewAppError("testElasticsearch", "api.elasticsearch.test_elasticsearch_settings_nil.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// PERMISSION_TEST_ELASTICSEARCH is an ancillary permission of PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_ELASTICSEARCH,
	// which should prevent read-only managers from password sniffing
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionTestElasticsearch) {
		c.SetPermissionError(model.PermissionTestElasticsearch)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("testElasticsearch", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.TestElasticsearch(c.AppContext, cfg); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func purgeElasticsearchIndexes(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("purgeElasticsearchIndexes", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionPurgeElasticsearchIndexes) {
		c.SetPermissionError(model.PermissionPurgeElasticsearchIndexes)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("purgeElasticsearchIndexes", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	specifiedIndexesQuery := r.URL.Query()["index"]
	if err := c.App.PurgeElasticsearchIndexes(c.AppContext, specifiedIndexesQuery); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
