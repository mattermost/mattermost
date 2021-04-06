// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitLicense() {
	api.BaseRoutes.ApiRoot.Handle("/trial-license", api.ApiSessionRequired(requestTrialLicense)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/license", api.ApiSessionRequired(addLicense)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/license", api.ApiSessionRequired(removeLicense)).Methods("DELETE")
	api.BaseRoutes.ApiRoot.Handle("/license/renewal", api.ApiSessionRequired(requestRenewalLink)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/license/client", api.ApiHandler(getClientLicense)).Methods("GET")
}

func getClientLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")

	if format == "" {
		c.Err = model.NewAppError("getClientLicense", "api.license.client.old_format.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if format != "old" {
		c.SetInvalidParam("format")
		return
	}

	var clientLicense map[string]string

	if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_READ_LICENSE_INFORMATION) {
		clientLicense = c.App.Srv().ClientLicense()
	} else {
		clientLicense = c.App.Srv().GetSanitizedClientLicense()
	}

	w.Write([]byte(model.MapToJson(clientLicense)))
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("addLicense", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_LICENSE_INFORMATION) {
		c.SetPermissionError(model.PERMISSION_MANAGE_LICENSE_INFORMATION)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("addLicense", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	m := r.MultipartForm

	fileArray, ok := m.File["license"]
	if !ok {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(fileArray) <= 0 {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	fileData := fileArray[0]
	auditRec.AddMeta("filename", fileData.Filename)

	file, err := fileData.Open()
	if err != nil {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.open.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	license, appErr := c.App.Srv().SaveLicense(buf.Bytes())
	if appErr != nil {
		if appErr.Id == model.EXPIRED_LICENSE_ERROR {
			c.LogAudit("failed - expired or non-started license")
		} else if appErr.Id == model.INVALID_LICENSE_ERROR {
			c.LogAudit("failed - invalid license")
		} else {
			c.LogAudit("failed - unable to save license")
		}
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	w.Write([]byte(license.ToJson()))
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("removeLicense", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_LICENSE_INFORMATION) {
		c.SetPermissionError(model.PERMISSION_MANAGE_LICENSE_INFORMATION)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("removeLicense", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.Srv().RemoveLicense(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
}

func requestTrialLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("requestTrialLicense", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_LICENSE_INFORMATION) {
		c.SetPermissionError(model.PERMISSION_MANAGE_LICENSE_INFORMATION)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("requestTrialLicense", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	var trialRequest struct {
		Users                 int  `json:"users"`
		TermsAccepted         bool `json:"terms_accepted"`
		ReceiveEmailsAccepted bool `json:"receive_emails_accepted"`
	}

	b, readErr := ioutil.ReadAll(r.Body)
	if readErr != nil {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest)
		return
	}
	json.Unmarshal(b, &trialRequest)
	if !trialRequest.TermsAccepted {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.bad-request.terms-not-accepted", nil, "", http.StatusBadRequest)
		return
	}
	if trialRequest.Users == 0 {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest)
		return
	}

	currentUser, err := c.App.GetUser(c.App.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	trialLicenseRequest := &model.TrialLicenseRequest{
		ServerID:              c.App.TelemetryId(),
		Name:                  currentUser.GetDisplayName(model.SHOW_FULLNAME),
		Email:                 currentUser.Email,
		SiteName:              *c.App.Config().TeamSettings.SiteName,
		SiteURL:               *c.App.Config().ServiceSettings.SiteURL,
		Users:                 trialRequest.Users,
		TermsAccepted:         trialRequest.TermsAccepted,
		ReceiveEmailsAccepted: trialRequest.ReceiveEmailsAccepted,
	}

	if trialLicenseRequest.SiteURL == "" {
		c.Err = model.NewAppError("RequestTrialLicense", "api.license.request_trial_license.no-site-url.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if err := c.App.Srv().RequestTrialLicense(trialLicenseRequest); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
}

func requestRenewalLink(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("requestRenewalLink", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_LICENSE_INFORMATION) {
		c.SetPermissionError(model.PERMISSION_MANAGE_LICENSE_INFORMATION)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("requestRenewalLink", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	renewalLink, err := c.App.Srv().GenerateLicenseRenewalLink()
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	_, werr := w.Write([]byte(fmt.Sprintf(`{"renewal_link": "%s"}`, renewalLink)))
	if werr != nil {
		c.Err = model.NewAppError("requestRenewalLink", "api.license.request_renewal_link.app_error", nil, werr.Error(), http.StatusForbidden)
		return
	}
}
