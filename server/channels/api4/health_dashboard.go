// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/report"
)

func (api *API) InitHealthDashboard() {
	api.BaseRoutes.HealthFindings.Handle("", api.APISessionRequired(getHealthFindings)).Methods(http.MethodGet)
	api.BaseRoutes.HealthFindings.Handle("/export", api.APISessionRequired(exportHealthFindings)).Methods(http.MethodGet)
	api.BaseRoutes.HealthFindings.Handle("/{fingerprint:[a-f0-9]{32}}/mute", api.APISessionRequired(muteHealthFinding)).Methods(http.MethodPost)
	api.BaseRoutes.HealthFindings.Handle("/{fingerprint:[a-f0-9]{32}}/mute", api.APISessionRequired(unmuteHealthFinding)).Methods(http.MethodDelete)
}

// healthFindingsReadPermissions lets delegated admins who can read Site Statistics see and export
// the findings. Muting stays manage_system, since a mute changes what every admin sees.
var healthFindingsReadPermissions = []*model.Permission{
	model.PermissionManageSystem,
	model.PermissionSysconsoleReadReportingSiteStatistics,
}

// requireHealthDashboard sets c.Err and returns false unless the caller holds one of permissions
// and the health dashboard is available. Permission is checked first so a caller without it
// learns nothing about the flag or license.
func requireHealthDashboard(c *Context, permissions ...*model.Permission) bool {
	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), permissions) {
		c.SetPermissionError(permissions...)
		return false
	}

	if !c.App.Config().FeatureFlags.HealthDashboard {
		c.Err = model.NewAppError("requireHealthDashboard", "api.health_finding.feature_disabled.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	if !model.MinimumProfessionalLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("requireHealthDashboard", "api.health_finding.license.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	return true
}

// complianceFindingPermissions maps each compliance rule to the read permission of the System
// Console page its setting is on, the same permission GET /config checks for that setting. It is
// a stopgap until every rule declares the permission that gates it: compliance is the area a
// delegated admin's default role may not read.
var complianceFindingPermissions = map[string]*model.Permission{
	"AUDIT_LOG_OFF":           model.PermissionSysconsoleReadExperimentalFeatures,
	"COMPLIANCE_NO_DIR":       model.PermissionSysconsoleReadComplianceComplianceMonitoring,
	"EXPORT_GR_TIMEOUT_LOW":   model.PermissionSysconsoleReadComplianceComplianceExport,
	"RETENTION_TIGHT_BATCHES": model.PermissionSysconsoleReadComplianceDataRetentionPolicy,
}

// readableFindings drops the findings the caller may not read. A caller with manage_system reads
// every finding. Otherwise a compliance finding needs read access to its setting's System Console
// page, and one whose rule isn't listed needs manage_system. A job finding, whose subject is the
// job type, needs read access to that type's jobs. Every other finding is visible to anyone who
// may use the dashboard.
func readableFindings(c *Context, findings []*model.HealthFinding) []*model.HealthFinding {
	session := *c.AppContext.Session()
	if c.App.SessionHasPermissionTo(session, model.PermissionManageSystem) {
		return findings
	}

	readable := make([]*model.HealthFinding, 0, len(findings))
	for _, finding := range findings {
		switch finding.Area {
		case model.AreaCompliance:
			permission, ok := complianceFindingPermissions[finding.Code]
			if !ok {
				permission = model.PermissionManageSystem
			}
			if !c.App.SessionHasPermissionTo(session, permission) {
				continue
			}
		case model.AreaJobs:
			if ok, _ := c.App.SessionHasPermissionToReadJob(session, finding.Subject); !ok {
				continue
			}
		}
		readable = append(readable, finding)
	}

	return readable
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
	if !requireHealthDashboard(c, healthFindingsReadPermissions...) {
		return
	}

	muted := model.MutedFilter(r.URL.Query().Get("muted"))
	if !muted.IsValid() {
		c.SetInvalidURLParam("muted")
		return
	}

	list, appErr := c.App.GetHealthFindings(c.AppContext, model.HealthFindingFilter{Muted: muted})
	if appErr != nil {
		c.Err = appErr
		return
	}
	list.Findings = renderFindings(c, readableFindings(c, list.Findings))

	if err := json.NewEncoder(w).Encode(list); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func exportHealthFindings(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requireHealthDashboard(c, healthFindingsReadPermissions...) {
		return
	}

	format := r.URL.Query().Get("format")

	auditRec := c.MakeAuditRecord(model.AuditEventExportHealthFindings, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "format", format)

	var contentType string
	var write func(*report.Report, io.Writer) error
	switch format {
	case "html":
		contentType, write = "text/html; charset=utf-8", (*report.Report).WriteHTML
	case "md":
		contentType, write = "text/markdown; charset=utf-8", (*report.Report).WriteMarkdown
	default:
		c.SetInvalidURLParam("format")
		return
	}

	user, appErr := c.App.GetUser(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	list, appErr := c.App.GetHealthFindings(c.AppContext, model.HealthFindingFilter{Muted: model.MutedIncluded})
	if appErr != nil {
		c.Err = appErr
		return
	}
	list.Findings = renderFindings(c, readableFindings(c, list.Findings))

	var tier, company string
	if license := c.App.Channels().License(); license != nil {
		tier = model.LicenseSkuDisplayName(license.SkuShortName, license.IsGovSku)
		if license.Customer != nil {
			company = license.Customer.Company
		}
	}

	// c.AppContext.T translates into the request's locale.
	_, locale := i18n.GetTranslationsAndLocaleFromRequest(r)

	cfg := c.App.Config()
	location := user.GetTimezoneLocation()
	now := time.Now().In(location)
	healthReport := report.Build(list, report.Options{
		T:             c.AppContext.T,
		Locale:        locale,
		Location:      location,
		GeneratedAt:   now,
		SiteURL:       *cfg.ServiceSettings.SiteURL,
		ServerVersion: model.CurrentVersion,
		License:       tier,
		Company:       company,
	})

	var buf bytes.Buffer
	if err := write(healthReport, &buf); err != nil {
		c.Err = model.NewAppError("exportHealthFindings", "api.health_finding.export.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	filename := healthReport.FileName + "." + format
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Cache-Control", "no-store")
	if _, err := w.Write(buf.Bytes()); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
		return
	}

	auditRec.Success()
}

func muteHealthFinding(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requireHealthDashboard(c, model.PermissionManageSystem) {
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
	if !requireHealthDashboard(c, model.PermissionManageSystem) {
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
