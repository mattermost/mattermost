// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (api *API) InitEphemeralMode() {
	api.BaseRoutes.EphemeralMode.Handle("/cleanup", api.APISessionRequired(logCleanup)).Methods(http.MethodPost)
	api.BaseRoutes.EphemeralMode.Handle("/purge", api.APISessionRequired(logOfflinePurge)).Methods(http.MethodPost)
	api.BaseRoutes.EphemeralMode.Handle("/wipe", api.APIHandler(logSessionWipe)).Methods(http.MethodPost)
}

func logCleanup(c *Context, w http.ResponseWriter, r *http.Request) {
	if !model.MinimumEnterpriseAdvancedLicense(c.App.License()) {
		c.Err = model.NewAppError("logCleanup", "license_error.feature_unavailable.specific", map[string]any{"Feature": "Ephemeral Mode"}, "", http.StatusNotImplemented)
		return
	}

	var report model.CleanupReport
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		c.SetInvalidParamWithErr("cleanup_report", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventAutoCacheCleanupRun, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if report.PostsDeleted == nil && report.PlaybookRunsDeleted == nil && report.CleanupAt == nil {
		c.SetInvalidParam("cleanup_report")
		return
	}

	postsDeleted := int64(0)
	if report.PostsDeleted != nil {
		postsDeleted = *report.PostsDeleted
	}
	playbookRunsDeleted := int64(0)
	if report.PlaybookRunsDeleted != nil {
		playbookRunsDeleted = *report.PlaybookRunsDeleted
	}
	model.AddEventParameterToAuditRec(auditRec, "posts_deleted", postsDeleted)
	model.AddEventParameterToAuditRec(auditRec, "playbook_runs_deleted", playbookRunsDeleted)
	if report.CleanupAt != nil {
		model.AddEventParameterToAuditRec(auditRec, "cleanup_at", *report.CleanupAt)
	}
	model.AddEventParameterToAuditRec(auditRec, "server_ts", model.GetMillis())

	auditRec.Success()

	ReturnStatusOK(w)
}

func logOfflinePurge(c *Context, w http.ResponseWriter, r *http.Request) {
	if !model.MinimumEnterpriseAdvancedLicense(c.App.License()) {
		c.Err = model.NewAppError("logOfflinePurge", "license_error.feature_unavailable.specific", map[string]any{"Feature": "Ephemeral Mode"}, "", http.StatusNotImplemented)
		return
	}

	var report model.OfflinePurgeReport
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		c.SetInvalidParamWithErr("offline_purge_report", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventOfflinePurge, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if report.OfflineTimeMinutes == nil {
		c.SetInvalidParam("offline_time_minutes")
		return
	}

	model.AddEventParameterToAuditRec(auditRec, "offline_time_minutes", *report.OfflineTimeMinutes)
	if report.PurgeAt != nil {
		model.AddEventParameterToAuditRec(auditRec, "purge_at", *report.PurgeAt)
	}
	model.AddEventParameterToAuditRec(auditRec, "server_ts", model.GetMillis())

	auditRec.Success()

	ReturnStatusOK(w)
}

// logSessionWipe is called by a client confirming a local wipe after its session was revoked, so
// it runs without a session and the actor is taken from the self-reported user_id/session_id.
func logSessionWipe(c *Context, w http.ResponseWriter, r *http.Request) {
	if !model.MinimumEnterpriseAdvancedLicense(c.App.License()) {
		c.Err = model.NewAppError("logSessionWipe", "license_error.feature_unavailable.specific", map[string]any{"Feature": "Ephemeral Mode"}, "", http.StatusNotImplemented)
		return
	}

	var report model.SessionWipeReport
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		c.SetInvalidParamWithErr("session_wipe_report", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventSessionWipe, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if report.UserId == "" {
		c.SetInvalidParam("user_id")
		return
	}
	if report.SessionId == "" {
		c.SetInvalidParam("session_id")
		return
	}

	auditRec.Actor.UserId = report.UserId
	auditRec.Actor.SessionId = report.SessionId

	if report.WipeAt != nil {
		model.AddEventParameterToAuditRec(auditRec, "wipe_at", *report.WipeAt)
	}
	model.AddEventParameterToAuditRec(auditRec, "server_ts", model.GetMillis())

	auditRec.Success()

	ReturnStatusOK(w)
}
