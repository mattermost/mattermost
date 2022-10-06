// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/utils"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitLicense() {
	api.BaseRoutes.APIRoot.Handle("/trial-license", api.APISessionRequired(requestTrialLicense)).Methods("POST")
	api.BaseRoutes.APIRoot.Handle("/trial-license/prev", api.APISessionRequired(getPrevTrialLicense)).Methods("GET")
	api.BaseRoutes.APIRoot.Handle("/license", api.APISessionRequired(addLicense)).Methods("POST")
	api.BaseRoutes.APIRoot.Handle("/license", api.APISessionRequired(removeLicense)).Methods("DELETE")
	api.BaseRoutes.APIRoot.Handle("/license/renewal", api.APISessionRequired(requestRenewalLink)).Methods("GET")
	api.BaseRoutes.APIRoot.Handle("/license/client", api.APIHandler(getClientLicense)).Methods("GET")
}

func getClientLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")

	if format == "" {
		c.Err = model.NewAppError("getClientLicense", "api.license.client.old_format.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if format != "old" {
		c.SetInvalidParam("format")
		return
	}

	var clientLicense map[string]string

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadLicenseInformation) {
		clientLicense = c.App.Srv().ClientLicense()
	} else {
		clientLicense = c.App.Srv().GetSanitizedClientLicense()
	}

	w.Write([]byte(model.MapToJSON(clientLicense)))
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("addLicense", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageLicenseInformation) {
		c.SetPermissionError(model.PermissionManageLicenseInformation)
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
	auditRec.AddEventParameter("filename", fileData.Filename)

	file, err := fileData.Open()
	if err != nil {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.open.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	licenseBytes := buf.Bytes()
	license, appErr := utils.LicenseValidator.LicenseFromBytes(licenseBytes)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// skip the restrictions if license is a sanctioned trial
	if !license.IsSanctionedTrial() && license.IsTrialLicense() {
		canStartTrialLicense, err := c.App.Srv().Platform().LicenseManager().CanStartTrial()
		if err != nil {
			c.Err = model.NewAppError("addLicense", "api.license.add_license.open.app_error", nil, "", http.StatusInternalServerError)
			return
		}

		if !canStartTrialLicense {
			c.Err = model.NewAppError("addLicense", "api.license.request-trial.can-start-trial.not-allowed", nil, "", http.StatusBadRequest)
			return
		}
	}

	license, appErr = c.App.Srv().SaveLicense(licenseBytes)
	if appErr != nil {
		if appErr.Id == model.ExpiredLicenseError {
			c.LogAudit("failed - expired or non-started license")
		} else if appErr.Id == model.InvalidLicenseError {
			c.LogAudit("failed - invalid license")
		} else {
			c.LogAudit("failed - unable to save license")
		}
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(license); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("removeLicense", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageLicenseInformation) {
		c.SetPermissionError(model.PermissionManageLicenseInformation)
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

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageLicenseInformation) {
		c.SetPermissionError(model.PermissionManageLicenseInformation)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("requestTrialLicense", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if c.App.Srv().Platform().LicenseManager() == nil {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.upgrade_needed.app_error", nil, "", http.StatusForbidden)
		return
	}

	canStartTrialLicense, err := c.App.Srv().Platform().LicenseManager().CanStartTrial()
	if err != nil {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.can-start-trial.error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	if !canStartTrialLicense {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.can-start-trial.not-allowed", nil, "", http.StatusBadRequest)
		return
	}

	var trialRequest struct {
		Users                 int  `json:"users"`
		TermsAccepted         bool `json:"terms_accepted"`
		ReceiveEmailsAccepted bool `json:"receive_emails_accepted"`
	}

	b, readErr := io.ReadAll(r.Body)
	if readErr != nil {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest)
		return
	}
	json.Unmarshal(b, &trialRequest)

	if err := c.App.Channels().RequestTrialLicense(c.AppContext.Session().UserId, trialRequest.Users, trialRequest.TermsAccepted, trialRequest.ReceiveEmailsAccepted); err != nil {
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

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageLicenseInformation) {
		c.SetPermissionError(model.PermissionManageLicenseInformation)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("requestRenewalLink", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	renewalLink, token, err := c.App.Srv().GenerateLicenseRenewalLink()
	if err != nil {
		c.Err = err
		return
	}

	if c.App.Cloud() == nil {
		c.Err = model.NewAppError("requestRenewalLink", "api.license.upgrade_needed.app_error", nil, "", http.StatusForbidden)
		return
	}

	// check if it is possible to renew license on the portal with generated token
	e := c.App.Cloud().GetLicenseRenewalStatus(c.AppContext.Session().UserId, token)
	if e != nil {
		c.Err = model.NewAppError("requestRenewalLink", "api.license.request_renewal_link.cannot_renew_on_cws", nil, e.Error(), http.StatusBadRequest)
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

func getPrevTrialLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().Platform().LicenseManager() == nil {
		c.Err = model.NewAppError("getPrevTrialLicense", "api.license.upgrade_needed.app_error", nil, "", http.StatusForbidden)
		return
	}

	license, err := c.App.Srv().Platform().LicenseManager().GetPrevTrial()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var clientLicense map[string]string

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadLicenseInformation) {
		clientLicense = utils.GetClientLicense(license)
	} else {
		clientLicense = utils.GetSanitizedClientLicense(utils.GetClientLicense(license))
	}

	w.Write([]byte(model.MapToJSON(clientLicense)))
}
