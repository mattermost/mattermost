// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"reflect"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (api *API) InitConfig() {
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiSessionRequired(getConfig)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiSessionRequired(updateConfig)).Methods("PUT")
	api.BaseRoutes.ApiRoot.Handle("/config/reload", api.ApiSessionRequired(configReload)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/config/client", api.ApiHandler(getClientConfig)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/config/environment", api.ApiSessionRequired(getEnvironmentConfig)).Methods("GET")
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	cfg := c.App.GetSanitizedConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func configReload(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("configReload", "api.restricted_system_admin", nil, "", http.StatusBadRequest)
		return
	}

	c.App.ReloadConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func updateConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("config")
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	appCfg := c.App.Config()
	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		// Start with the current configuration, and only merge values not marked as being
		// restricted.
		var err error
		cfg, err = config.Merge(appCfg, cfg, &utils.MergeConfig{
			StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
				restricted := structField.Tag.Get("restricted") == "true"

				return !restricted
			},
		})
		if err != nil {
			c.Err = model.NewAppError("updateConfig", "api.config.update_config.restricted_merge.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	// Do not allow plugin uploads to be toggled through the API
	cfg.PluginSettings.EnableUploads = appCfg.PluginSettings.EnableUploads

	// If the Message Export feature has been toggled in the System Console, rewrite the ExportFromTimestamp field to an
	// appropriate value. The rewriting occurs here to ensure it doesn't affect values written to the config file
	// directly and not through the System Console UI.
	if *cfg.MessageExportSettings.EnableExport != *appCfg.MessageExportSettings.EnableExport {
		if *cfg.MessageExportSettings.EnableExport && *cfg.MessageExportSettings.ExportFromTimestamp == int64(0) {
			// When the feature is toggled on, use the current timestamp as the start time for future exports.
			cfg.MessageExportSettings.ExportFromTimestamp = model.NewInt64(model.GetMillis())
		} else if !*cfg.MessageExportSettings.EnableExport {
			// When the feature is disabled, reset the timestamp so that the timestamp will be set if
			// the feature is re-enabled from the System Console in future.
			cfg.MessageExportSettings.ExportFromTimestamp = model.NewInt64(0)
		}
	}

	err := cfg.IsValid()
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.SaveConfig(cfg, true)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("updateConfig")

	cfg = c.App.GetSanitizedConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func getClientConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")

	if format == "" {
		c.Err = model.NewAppError("getClientConfig", "api.config.client.old_format.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if format != "old" {
		c.SetInvalidParam("format")
		return
	}

	var config map[string]string
	if len(c.App.Session.UserId) == 0 {
		config = c.App.LimitedClientConfigWithComputed()
	} else {
		config = c.App.ClientConfigWithComputed()
	}

	w.Write([]byte(model.MapToJson(config)))
}

func getEnvironmentConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	envConfig := c.App.GetEnvironmentConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(model.StringInterfaceToJson(envConfig)))
}
