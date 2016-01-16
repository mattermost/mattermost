// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/i18n"
	"io"
	"net/http"
	"strings"
)

func InitLicense(r *mux.Router) {
	l4g.Debug(T("Initializing license api routes"))

	sr := r.PathPrefix("/license").Subrouter()
	sr.Handle("/add", ApiAdminSystemRequired(addLicense)).Methods("POST")
	sr.Handle("/remove", ApiAdminSystemRequired(removeLicense)).Methods("POST")
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.GetTranslations(w, r)
	c.LogAudit(T("attempt"), T)
	err := r.ParseMultipartForm(model.MAX_FILE_SIZE)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm

	fileArray, ok := m.File["license"]
	if !ok {
		c.Err = model.NewAppError("addLicense", T("No file under 'license' in request"), "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileArray) <= 0 {
		c.Err = model.NewAppError("addLicense", T("Empty array under 'license' in request"), "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileData := fileArray[0]

	file, err := fileData.Open()
	defer file.Close()
	if err != nil {
		c.Err = model.NewAppError("addLicense", T("Could not open license file"), err.Error())
		return
	}

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	data := buf.Bytes()

	var license *model.License
	if success, licenseStr := utils.ValidateLicense(data, T); success {
		license = model.LicenseFromJson(strings.NewReader(licenseStr))

		if ok := utils.SetLicense(license); !ok {
			c.LogAudit(T("failed - expired or non-started license"), T)
			c.Err = model.NewAppError("addLicense", T("License is either expired or has not yet started."), "")
			return
		}

		if err := writeFileLocally(data, utils.LicenseLocation()); err != nil {
			c.LogAudit(T("failed - could not save license file"), T)
			c.Err = model.NewAppError("addLicense", T("License did not save properly."), "path="+utils.LicenseLocation())
			utils.RemoveLicense(T)
			return
		}
	} else {
		c.LogAudit(T("failed - invalid license"), T)
		c.Err = model.NewAppError("addLicense", T("Invalid license file."), "")
		return
	}

	c.LogAudit(T("success"), T)
	w.Write([]byte(license.ToJson()))
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.GetTranslations(w, r)
	c.LogAudit("", T)

	if ok := utils.RemoveLicense(T); !ok {
		c.LogAudit(T("failed - could not remove license file"), T)
		c.Err = model.NewAppError("removeLicense", T("License did not remove properly."), "")
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}
