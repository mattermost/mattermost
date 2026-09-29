// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func (api *API) InitHealthDashboard() {
	api.BaseRoutes.HealthFindings.Handle("", api.APISessionRequired(getHealthFindings)).Methods(http.MethodGet)
	api.BaseRoutes.HealthFindings.Handle("/{fingerprint:[a-f0-9]{32}}/mute", api.APISessionRequired(muteHealthFinding)).Methods(http.MethodPost)
	api.BaseRoutes.HealthFindings.Handle("/{fingerprint:[a-f0-9]{32}}/mute", api.APISessionRequired(unmuteHealthFinding)).Methods(http.MethodDelete)
}

// requireHealthDashboard sets c.Err and returns false unless the caller may use the health
// dashboard. Permission is checked first so a non-admin learns nothing about the flag or license.
func requireHealthDashboard(c *Context) bool {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return false
	}

	if !c.App.Config().FeatureFlags.HealthDashboard {
		c.Err = model.NewAppError("requireHealthDashboard", "api.health_finding.feature_disabled.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("requireHealthDashboard", "api.health_finding.license.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	return true
}

// renderFindings resolves each finding's message and its rule's title and remediation into the
// request locale. A finding whose code is no longer registered cannot be rendered or acted on,
// so it is dropped.
func renderFindings(c *Context, findings []*model.HealthFinding) []*model.HealthFinding {
	rules := healthcheck.Builtin()
	rendered := make([]*model.HealthFinding, 0, len(findings))
	for _, finding := range findings {
		rule, ok := rules.Get(finding.Code)
		if !ok {
			continue
		}
		rendered = append(rendered, finding.Render(c.AppContext.T, rule.RuleText))
	}

	return rendered
}

func getHealthFindings(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requireHealthDashboard(c) {
		return
	}

	muted := model.MutedFilter(r.URL.Query().Get("muted"))
	if !muted.IsValid() {
		c.SetInvalidURLParam("muted")
		return
	}

	findings, appErr := c.App.GetHealthFindings(c.AppContext, model.HealthFindingFilter{Muted: muted})
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(renderFindings(c, findings)); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func muteHealthFinding(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requireHealthDashboard(c) {
		return
	}

	fingerprint := mux.Vars(r)["fingerprint"]

	auditRec := c.MakeAuditRecord(model.AuditEventMuteHealthFinding, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "fingerprint", fingerprint)

	finding, appErr := c.App.GetHealthFinding(c.AppContext, fingerprint)
	if appErr != nil {
		c.Err = appErr
		return
	}
	model.AddEventParameterToAuditRec(auditRec, "code", finding.Code)

	if appErr = c.App.MuteHealthFinding(c.AppContext, fingerprint, c.AppContext.Session().UserId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func unmuteHealthFinding(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requireHealthDashboard(c) {
		return
	}

	fingerprint := mux.Vars(r)["fingerprint"]

	auditRec := c.MakeAuditRecord(model.AuditEventUnmuteHealthFinding, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "fingerprint", fingerprint)

	finding, appErr := c.App.GetHealthFinding(c.AppContext, fingerprint)
	if appErr != nil {
		c.Err = appErr
		return
	}
	model.AddEventParameterToAuditRec(auditRec, "code", finding.Code)

	if appErr = c.App.UnmuteHealthFinding(c.AppContext, fingerprint); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
