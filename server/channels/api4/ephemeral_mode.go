// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

// errorReasonMaxRunes matches the bound postLog applies to client-supplied log messages.
const errorReasonMaxRunes = 400

// truncateErrorReason marks a cut reason so it stays distinguishable from a complete one.
func truncateErrorReason(reason string) string {
	const ellipsis = "..."

	runes := []rune(reason)
	if len(runes) <= errorReasonMaxRunes {
		return reason
	}
	return string(runes[:errorReasonMaxRunes-len(ellipsis)]) + ellipsis
}

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

	// if no deleted count reported and it is not an error, the request is considered invalid
	if report.ErrorReason == nil {
		if report.PostsDeleted == nil {
			c.SetInvalidParam("posts_deleted")
			return
		}
		if report.PlaybookRunsDeleted == nil {
			c.SetInvalidParam("playbook_runs_deleted")
			return
		}
	}

	if report.PostsDeleted != nil {
		model.AddEventParameterToAuditRec(auditRec, "posts_deleted", *report.PostsDeleted)
	}
	if report.PlaybookRunsDeleted != nil {
		model.AddEventParameterToAuditRec(auditRec, "playbook_runs_deleted", *report.PlaybookRunsDeleted)
	}
	if report.CleanupAt != nil {
		model.AddEventParameterToAuditRec(auditRec, "cleanup_at", *report.CleanupAt)
	}
	model.AddEventParameterToAuditRec(auditRec, "server_ts", model.GetMillis())

	if report.ErrorReason != nil {
		auditRec.AddErrorDesc(truncateErrorReason(*report.ErrorReason))
		auditRec.Fail()
	} else {
		auditRec.Success()
	}

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

	// a successful purge with no offline time records no evidence of why it ran
	if report.ErrorReason == nil && report.OfflineTimeMinutes == nil {
		c.SetInvalidParam("offline_time_minutes")
		return
	}

	if report.OfflineTimeMinutes != nil {
		model.AddEventParameterToAuditRec(auditRec, "offline_time_minutes", *report.OfflineTimeMinutes)
	}
	if report.PurgeAt != nil {
		model.AddEventParameterToAuditRec(auditRec, "purge_at", *report.PurgeAt)
	}
	model.AddEventParameterToAuditRec(auditRec, "server_ts", model.GetMillis())

	if report.ErrorReason != nil {
		auditRec.AddErrorDesc(truncateErrorReason(*report.ErrorReason))
		auditRec.Fail()
	} else {
		auditRec.Success()
	}

	ReturnStatusOK(w)
}

// logSessionWipe is called by a client confirming a local wipe after its session was revoked, so
// it runs without a session and the actor is taken from the signature the wipe push carried.
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

	// verified before the audit record exists so an unverified caller cannot append one at all
	claims, err := c.App.VerifyWipeSignature(report.Signature)
	if err != nil {
		c.SetInvalidParamWithErr("signature", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventSessionWipe, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	auditRec.Actor.UserId = claims.UserId
	model.AddEventParameterToAuditRec(auditRec, "device_id", model.RedactDeviceId(claims.DeviceId))
	model.AddEventParameterToAuditRec(auditRec, "ack_id", claims.AckId)

	if report.WipeAt != nil {
		model.AddEventParameterToAuditRec(auditRec, "wipe_at", *report.WipeAt)
	}
	model.AddEventParameterToAuditRec(auditRec, "server_ts", model.GetMillis())

	if report.ErrorReason != nil {
		auditRec.AddErrorDesc(truncateErrorReason(*report.ErrorReason))
		auditRec.Fail()
	} else {
		auditRec.Success()
	}

	ReturnStatusOK(w)
}
