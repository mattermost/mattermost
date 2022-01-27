// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"reflect"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func (api *API) InitConfigLocal() {
	api.BaseRoutes.APIRoot.Handle("/config", api.APILocal(localGetConfig)).Methods("GET")
	api.BaseRoutes.APIRoot.Handle("/config", api.APILocal(localUpdateConfig)).Methods("PUT")
	api.BaseRoutes.APIRoot.Handle("/config/patch", api.APILocal(localPatchConfig)).Methods("PUT")
	api.BaseRoutes.APIRoot.Handle("/config/reload", api.APILocal(configReload)).Methods("POST")
	api.BaseRoutes.APIRoot.Handle("/config/migrate", api.APILocal(localMigrateConfig)).Methods("POST")
}

func localGetConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("localGetConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)
	cfg := c.App.GetSanitizedConfig()
	auditRec.Success()
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func localUpdateConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJSON(r.Body)
	if cfg == nil {
		c.SetInvalidParam("config")
		return
	}

	auditRec := c.MakeAuditRecord("localUpdateConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	cfg.SetDefaults()

	appCfg := c.App.Config()

	// Do not allow plugin uploads to be toggled through the API
	cfg.PluginSettings.EnableUploads = appCfg.PluginSettings.EnableUploads

	// Do not allow certificates to be changed through the API
	cfg.PluginSettings.SignaturePublicKeyFiles = appCfg.PluginSettings.SignaturePublicKeyFiles

	c.App.HandleMessageExportConfig(cfg, appCfg)

	err := cfg.IsValid()
	if err != nil {
		c.Err = err
		return
	}

	oldCfg, newCfg, err := c.App.SaveConfig(cfg, true)
	if err != nil {
		c.Err = err
		return
	}

	diffs, diffErr := config.Diff(oldCfg, newCfg)
	if diffErr != nil {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.diff.app_error", nil, diffErr.Error(), http.StatusInternalServerError)
		return
	}
	auditRec.AddMeta("diff", diffs.Sanitize())

	newCfg.Sanitize()

	auditRec.Success()
	c.LogAudit("updateConfig")

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := json.NewEncoder(w).Encode(newCfg); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func localPatchConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJSON(r.Body)
	if cfg == nil {
		c.SetInvalidParam("config")
		return
	}

	auditRec := c.MakeAuditRecord("localPatchConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	appCfg := c.App.Config()
	filterFn := func(structField reflect.StructField, base, patch reflect.Value) bool {
		return true
	}

	if cfg.MessageExportSettings.EnableExport != nil {
		c.App.HandleMessageExportConfig(cfg, appCfg)
	}

	updatedCfg, mergeErr := config.Merge(appCfg, cfg, &utils.MergeConfig{
		StructFieldFilter: filterFn,
	})

	if mergeErr != nil {
		c.Err = model.NewAppError("patchConfig", "api.config.update_config.restricted_merge.app_error", nil, mergeErr.Error(), http.StatusInternalServerError)
		return
	}

	err := updatedCfg.IsValid()
	if err != nil {
		c.Err = err
		return
	}

	oldCfg, newCfg, err := c.App.SaveConfig(updatedCfg, true)
	if err != nil {
		c.Err = err
		return
	}

	diffs, diffErr := config.Diff(oldCfg, newCfg)
	if diffErr != nil {
		c.Err = model.NewAppError("patchConfig", "api.config.patch_config.diff.app_error", nil, diffErr.Error(), http.StatusInternalServerError)
		return
	}
	auditRec.AddMeta("diff", diffs.Sanitize())

	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := json.NewEncoder(w).Encode(c.App.GetSanitizedConfig()); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func localMigrateConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJSON(r.Body)
	from, ok := props["from"].(string)
	if !ok {
		c.SetInvalidParam("from")
		return
	}
	to, ok := props["to"].(string)
	if !ok {
		c.SetInvalidParam("to")
		return
	}

	auditRec := c.MakeAuditRecord("migrateConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	err := config.Migrate(from, to)
	if err != nil {
		c.Err = model.NewAppError("migrateConfig", "api.config.migrate_config.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
