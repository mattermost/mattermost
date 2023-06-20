// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/avct/uasurfer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitCompliance() {
	api.BaseRoutes.Compliance.Handle("/reports", api.APISessionRequired(createComplianceReport)).Methods("POST")
	api.BaseRoutes.Compliance.Handle("/reports", api.APISessionRequired(getComplianceReports)).Methods("GET")
	api.BaseRoutes.Compliance.Handle("/reports/{report_id:[A-Za-z0-9]+}", api.APISessionRequired(getComplianceReport)).Methods("GET")
	api.BaseRoutes.Compliance.Handle("/reports/{report_id:[A-Za-z0-9]+}/download", api.APISessionRequiredTrustRequester(downloadComplianceReport)).Methods("GET")
}

func createComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	var job model.Compliance
	if jsonErr := json.NewDecoder(r.Body).Decode(&job); jsonErr != nil {
		c.SetInvalidParamWithErr("compliance", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("createComplianceReport", audit.Fail)
	audit.AddEventParameterAuditable(auditRec, "compliance", &job)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateComplianceExportJob) {
		c.SetPermissionError(model.PermissionCreateComplianceExportJob)
		return
	}

	job.UserId = c.AppContext.Session().UserId

	rjob, err := c.App.SaveComplianceReport(&job)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rjob)
	auditRec.AddEventObjectType("compliance")
	auditRec.AddMeta("compliance_id", rjob.Id)
	auditRec.AddMeta("compliance_desc", rjob.Desc)
	c.LogAudit("")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rjob); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getComplianceReports(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadComplianceExportJob) {
		c.SetPermissionError(model.PermissionReadComplianceExportJob)
		return
	}

	auditRec := c.MakeAuditRecord("getComplianceReports", audit.Fail)
	defer c.LogAuditRec(auditRec)

	crs, err := c.App.GetComplianceReports(c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	if err := json.NewEncoder(w).Encode(crs); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireReportId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("getComplianceReport", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadComplianceExportJob) {
		c.SetPermissionError(model.PermissionReadComplianceExportJob)
		return
	}

	audit.AddEventParameter(auditRec, "report_id", c.Params.ReportId)
	job, err := c.App.GetComplianceReport(c.Params.ReportId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("compliance_id", job.Id)
	auditRec.AddMeta("compliance_desc", job.Desc)

	if err := json.NewEncoder(w).Encode(job); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func downloadComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireReportId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("downloadComplianceReport", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "compliance_id", c.Params.ReportId)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionDownloadComplianceExportResult) {
		c.SetPermissionError(model.PermissionDownloadComplianceExportResult)
		return
	}

	job, err := c.App.GetComplianceReport(c.Params.ReportId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventResultState(job)
	auditRec.AddEventObjectType("compliance")

	reportBytes, err := c.App.GetComplianceFile(job)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("length", len(reportBytes))

	c.LogAudit("downloaded " + job.Desc)

	w.Header().Set("Cache-Control", "max-age=2592000, private")
	w.Header().Set("Content-Length", strconv.Itoa(len(reportBytes)))
	w.Header().Del("Content-Type") // Content-Type will be set automatically by the http writer

	// attach extra headers to trigger a download on IE, Edge, and Safari
	ua := uasurfer.Parse(r.UserAgent())

	w.Header().Set("Content-Disposition", "attachment;filename=\""+job.JobName()+".zip\"")

	if ua.Browser.Name == uasurfer.BrowserIE || ua.Browser.Name == uasurfer.BrowserSafari {
		// trim off anything before the final / so we just get the file's name
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	auditRec.Success()

	w.Write(reportBytes)
}
