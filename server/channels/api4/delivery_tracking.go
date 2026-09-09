// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitDeliveryTracking() {
	if !api.srv.Config().FeatureFlags.PostDeliveryTracking {
		return
	}

	api.BaseRoutes.DeliveryTracking.Handle("/config", api.APISessionRequired(getDeliveryTrackingConfig)).Methods(http.MethodGet)
	api.BaseRoutes.DeliveryTracking.Handle("/config", api.APISessionRequired(updateDeliveryTrackingConfig)).Methods(http.MethodPut)
}

func requireDeliveryTrackingAvailable(c *Context) {
	if !model.MinimumEnterpriseAdvancedLicense(c.App.License()) {
		c.Err = model.NewAppError("requireDeliveryTrackingAvailable", "api.delivery_tracking.error.license", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.Config().FeatureFlags.PostDeliveryTracking {
		c.Err = model.NewAppError("requireDeliveryTrackingAvailable", "api.delivery_tracking.error.feature_flag", nil, "", http.StatusNotImplemented)
		return
	}
}

func getDeliveryTrackingConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	requireDeliveryTrackingAvailable(c)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	config, appErr := c.App.GetDeliveryTrackingConfig(c.AppContext)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// The response is already committed by this point, so an encoding failure can only be
	// logged, not turned into an error status.
	if err := json.NewEncoder(w).Encode(config); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateDeliveryTrackingConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	requireDeliveryTrackingAvailable(c)
	if c.Err != nil {
		return
	}

	var config model.DeliveryTrackingConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		c.SetInvalidParamWithErr("config", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateDeliveryTrackingConfig, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	config.SetDefaults()

	// Recorded before validation so rejected attempts are auditable too. SetDefaults
	// guarantees both pointers are set.
	model.AddEventParameterToAuditRec(auditRec, "enable", *config.Enable)
	model.AddEventParameterToAuditRec(auditRec, "enable_for_all_channels", *config.EnableForAllChannels)
	// Record the count rather than the ids so the audit record stays bounded.
	model.AddEventParameterToAuditRec(auditRec, "channel_id_count", len(config.ChannelIds))

	if appErr := config.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	if appErr := c.App.SaveDeliveryTrackingConfig(c.AppContext, &config); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	writeOKResponse(w)
}
