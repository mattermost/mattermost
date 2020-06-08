// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/json"
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

	if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		clientLicense = c.App.ClientLicense()
	} else {
		clientLicense = c.App.GetSanitizedClientLicense()
	}

	w.Write([]byte(model.MapToJson(clientLicense)))
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("addLicense", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
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

	license, appErr := c.App.SaveLicense(buf.Bytes())
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

	if *c.App.Config().JobSettings.RunJobs {
		c.App.Srv().Jobs.Workers = c.App.Srv().Jobs.InitWorkers()
		c.App.Srv().Jobs.StartWorkers()
	}

	auditRec.Success()
	c.LogAudit("success")

	w.Write([]byte(license.ToJson()))
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("removeLicense", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("removeLicense", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.RemoveLicense(); err != nil {
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

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("removeLicense", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	var usersNumber struct {
		Users int `json:"users"`
	}

	b, readErr := ioutil.ReadAll(r.Body)
	if readErr != nil {
		c.Err = model.NewAppError("removeLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest)
		return
	}
	json.Unmarshal(b, &usersNumber)
	if usersNumber.Users == 0 {
		c.Err = model.NewAppError("removeLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest)
		return
	}

	currentUser, err := c.App.GetUser(c.App.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	trialLicenseRequest := &model.TrialLicenseRequest{
		ServerID: c.App.DiagnosticId(),
		Name:     currentUser.GetDisplayName(model.SHOW_FULLNAME),
		Email:    currentUser.Email,
		SiteName: *c.App.Config().TeamSettings.SiteName,
		SiteURL:  *c.App.Config().ServiceSettings.SiteURL,
		Users:    usersNumber.Users,
	}

	if err := c.App.RequestTrialLicense(trialLicenseRequest); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
}
