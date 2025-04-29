// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/json"
	"io"
	"math"
	"net/http"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitLicense() {
	api.BaseRoutes.APIRoot.Handle("/trial-license", api.APISessionRequired(requestTrialLicense)).Methods(http.MethodPost)
	api.BaseRoutes.APIRoot.Handle("/trial-license/prev", api.APISessionRequired(getPrevTrialLicense)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/license", api.APISessionRequired(addLicense, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.APIRoot.Handle("/license", api.APISessionRequired(removeLicense)).Methods(http.MethodDelete)
	api.BaseRoutes.APIRoot.Handle("/license/client", api.APIHandler(getClientLicense)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/license/load_metric", api.APISessionRequired(getLicenseLoadMetric)).Methods(http.MethodGet)
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

	if _, err := w.Write([]byte(model.MapToJSON(clientLicense))); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("addLicense", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToAndNotRestrictedAdmin(*c.AppContext.Session(), model.PermissionManageLicenseInformation) {
		c.SetPermissionError(model.PermissionManageLicenseInformation)
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
	audit.AddEventParameter(auditRec, "filename", fileData.Filename)

	file, err := fileData.Open()
	if err != nil {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.open.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	defer file.Close()

	buf := bytes.NewBuffer(nil)
	if _, err := io.Copy(buf, file); err != nil {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.copy.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	licenseBytes := buf.Bytes()
	license, appErr := utils.LicenseValidator.LicenseFromBytes(licenseBytes)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// skip the restrictions if license is a sanctioned trial
	if !license.IsSanctionedTrial() && license.IsTrialLicense() {
		lm := c.App.Srv().Platform().LicenseManager()
		if lm == nil {
			c.Err = model.NewAppError("addLicense", "api.license.upgrade_needed.app_error", nil, "", http.StatusInternalServerError)
			return
		}

		canStartTrialLicense, err := lm.CanStartTrial()
		if err != nil {
			c.Err = model.NewAppError("addLicense", "api.license.add_license.open.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	if c.App.Channels().License().IsCloud() {
		// If cloud, invalidate the caches when a new license is loaded
		defer func() {
			if err := c.App.Srv().Cloud.HandleLicenseChange(); err != nil {
				c.Logger.Warn("Error while handling license change", mlog.Err(err))
			}
		}()
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

	if !c.App.SessionHasPermissionToAndNotRestrictedAdmin(*c.AppContext.Session(), model.PermissionManageLicenseInformation) {
		c.SetPermissionError(model.PermissionManageLicenseInformation)
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

	if !c.App.SessionHasPermissionToAndNotRestrictedAdmin(*c.AppContext.Session(), model.PermissionManageLicenseInformation) {
		c.SetPermissionError(model.PermissionManageLicenseInformation)
		return
	}

	if c.App.Srv().Platform().LicenseManager() == nil {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.upgrade_needed.app_error", nil, "", http.StatusForbidden)
		return
	}

	canStartTrialLicense, err := c.App.Srv().Platform().LicenseManager().CanStartTrial()
	if err != nil {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.can-start-trial.error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if !canStartTrialLicense {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.can-start-trial.not-allowed", nil, "", http.StatusBadRequest)
		return
	}

	var trialRequest *model.TrialLicenseRequest

	b, readErr := io.ReadAll(r.Body)
	if readErr != nil {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest)
		return
	}

	err = json.Unmarshal(b, &trialRequest)
	if err != nil {
		c.Err = model.NewAppError("requestTrialLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	var appErr *model.AppError
	// If any of the newly supported trial request fields are set (ie, not a legacy request), process this as a new trial request (requiring the new fields) otherwise fall back on the old method.
	if !trialRequest.IsLegacy() {
		appErr = c.App.Channels().RequestTrialLicenseWithExtraFields(c.AppContext.Session().UserId, trialRequest)
	} else {
		appErr = c.App.Channels().RequestTrialLicense(c.AppContext.Session().UserId, trialRequest.Users, trialRequest.TermsAccepted, trialRequest.ReceiveEmailsAccepted)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
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

	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write([]byte(model.MapToJSON(clientLicense))); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getLicenseLoadMetric returns a load metric computed as (mau / licensed) * 1000.
func getLicenseLoadMetric(c *Context, w http.ResponseWriter, r *http.Request) {
	var loadMetric int
	var licenseUsers int

	license := c.App.Srv().License()
	if license != nil && license.Features != nil {
		licenseUsers = *license.Features.Users
	}

	if licenseUsers > 0 {
		monthlyActiveUsers, err := c.App.Srv().Store().User().AnalyticsActiveCount(app.MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
		if err != nil {
			c.Err = model.NewAppError("getLicenseLoad", "api.license.load_metric.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}

		loadMetric = int(math.Round((float64(monthlyActiveUsers) / float64(licenseUsers) * float64(1000))))
	}

	// Create response object
	data := map[string]int{
		"load": loadMetric,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
