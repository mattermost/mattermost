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
	cleanupAt := model.GetMillis()
	if report.CleanupAt != nil {
		cleanupAt = *report.CleanupAt
	}

	model.AddEventParameterToAuditRec(auditRec, "posts_deleted", postsDeleted)
	model.AddEventParameterToAuditRec(auditRec, "playbook_runs_deleted", playbookRunsDeleted)
	model.AddEventParameterToAuditRec(auditRec, "cleanup_at", cleanupAt)

	auditRec.Success()

	ReturnStatusOK(w)
}

func logOfflinePurge(c *Context, w http.ResponseWriter, r *http.Request) {
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

	purgeAt := model.GetMillis()
	if report.PurgeAt != nil {
		purgeAt = *report.PurgeAt
	}

	model.AddEventParameterToAuditRec(auditRec, "offline_time_minutes", *report.OfflineTimeMinutes)
	model.AddEventParameterToAuditRec(auditRec, "purge_at", purgeAt)

	auditRec.Success()

	ReturnStatusOK(w)
}

// logSessionWipe is called by a client confirming a local wipe after its session was revoked, so
// it runs without a session and the actor is taken from the self-reported user_id/session_id.
func logSessionWipe(c *Context, w http.ResponseWriter, r *http.Request) {
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

	wipeAt := model.GetMillis()
	if report.WipeAt != nil {
		wipeAt = *report.WipeAt
	}
	model.AddEventParameterToAuditRec(auditRec, "wipe_at", wipeAt)

	auditRec.Success()

	ReturnStatusOK(w)
}
