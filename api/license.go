// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"io"
	"net/http"
	"strings"
)

func InitLicense(r *mux.Router) {
	l4g.Debug("Initializing license api routes")

	sr := r.PathPrefix("/license").Subrouter()
	sr.Handle("/add", ApiAdminSystemRequired(addLicense)).Methods("POST")
	sr.Handle("/remove", ApiAdminSystemRequired(removeLicense)).Methods("POST")
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempt")
	err := r.ParseMultipartForm(model.MAX_FILE_SIZE)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm

	fileArray, ok := m.File["license"]
	if !ok {
		c.Err = model.NewAppError("addLicense", "No file under 'license' in request", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileArray) <= 0 {
		c.Err = model.NewAppError("addLicense", "Empty array under 'license' in request", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileData := fileArray[0]

	file, err := fileData.Open()
	defer file.Close()
	if err != nil {
		c.Err = model.NewAppError("addLicense", "Could not open license file", err.Error())
		return
	}

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	data := buf.Bytes()

	var license *model.License
	if success, licenseStr := utils.ValidateLicense(data); success {
		license = model.LicenseFromJson(strings.NewReader(licenseStr))

		if ok := utils.SetLicense(license); !ok {
			c.LogAudit("failed - expired or non-started license")
			c.Err = model.NewAppError("addLicense", "License is either expired or has not yet started.", "")
			return
		}

		if err := writeFileLocally(data, utils.LicenseLocation()); err != nil {
			c.LogAudit("failed - could not save license file")
			c.Err = model.NewAppError("addLicense", "License did not save properly.", "path="+utils.LicenseLocation())
			utils.RemoveLicense()
			return
		}
	} else {
		c.LogAudit("failed - invalid license")
		c.Err = model.NewAppError("addLicense", "Invalid license file.", "")
		return
	}

	c.LogAudit("success")
	w.Write([]byte(license.ToJson()))
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("")

	if ok := utils.RemoveLicense(); !ok {
		c.LogAudit("failed - could not remove license file")
		c.Err = model.NewAppError("removeLicense", "License did not remove properly.", "")
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}
