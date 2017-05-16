// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
)

func InitAdmin() {
	l4g.Debug(utils.T("api.admin.init.debug"))

	BaseRoutes.Admin.Handle("/logs", ApiAdminSystemRequired(getLogs)).Methods("GET")
	BaseRoutes.Admin.Handle("/audits", ApiAdminSystemRequired(getAllAudits)).Methods("GET")
	BaseRoutes.Admin.Handle("/config", ApiAdminSystemRequired(getConfig)).Methods("GET")
	BaseRoutes.Admin.Handle("/save_config", ApiAdminSystemRequired(saveConfig)).Methods("POST")
	BaseRoutes.Admin.Handle("/reload_config", ApiAdminSystemRequired(reloadConfig)).Methods("GET")
	BaseRoutes.Admin.Handle("/invalidate_all_caches", ApiAdminSystemRequired(invalidateAllCaches)).Methods("GET")
	BaseRoutes.Admin.Handle("/test_email", ApiAdminSystemRequired(testEmail)).Methods("POST")
	BaseRoutes.Admin.Handle("/recycle_db_conn", ApiAdminSystemRequired(recycleDatabaseConnection)).Methods("GET")
	BaseRoutes.Admin.Handle("/analytics/{id:[A-Za-z0-9]+}/{name:[A-Za-z0-9_]+}", ApiAdminSystemRequired(getAnalytics)).Methods("GET")
	BaseRoutes.Admin.Handle("/analytics/{name:[A-Za-z0-9_]+}", ApiAdminSystemRequired(getAnalytics)).Methods("GET")
	BaseRoutes.Admin.Handle("/save_compliance_report", ApiAdminSystemRequired(saveComplianceReport)).Methods("POST")
	BaseRoutes.Admin.Handle("/compliance_reports", ApiAdminSystemRequired(getComplianceReports)).Methods("GET")
	BaseRoutes.Admin.Handle("/download_compliance_report/{id:[A-Za-z0-9]+}", ApiAdminSystemRequiredTrustRequester(downloadComplianceReport)).Methods("GET")
	BaseRoutes.Admin.Handle("/upload_brand_image", ApiAdminSystemRequired(uploadBrandImage)).Methods("POST")
	BaseRoutes.Admin.Handle("/get_brand_image", ApiAppHandlerTrustRequester(getBrandImage)).Methods("GET")
	BaseRoutes.Admin.Handle("/reset_mfa", ApiAdminSystemRequired(adminResetMfa)).Methods("POST")
	BaseRoutes.Admin.Handle("/reset_password", ApiAdminSystemRequired(adminResetPassword)).Methods("POST")
	BaseRoutes.Admin.Handle("/ldap_sync_now", ApiAdminSystemRequired(ldapSyncNow)).Methods("POST")
	BaseRoutes.Admin.Handle("/ldap_test", ApiAdminSystemRequired(ldapTest)).Methods("POST")
	BaseRoutes.Admin.Handle("/saml_metadata", ApiAppHandler(samlMetadata)).Methods("GET")
	BaseRoutes.Admin.Handle("/add_certificate", ApiAdminSystemRequired(addCertificate)).Methods("POST")
	BaseRoutes.Admin.Handle("/remove_certificate", ApiAdminSystemRequired(removeCertificate)).Methods("POST")
	BaseRoutes.Admin.Handle("/saml_cert_status", ApiAdminSystemRequired(samlCertificateStatus)).Methods("GET")
	BaseRoutes.Admin.Handle("/cluster_status", ApiAdminSystemRequired(getClusterStatus)).Methods("GET")
	BaseRoutes.Admin.Handle("/recently_active_users/{team_id:[A-Za-z0-9]+}", ApiUserRequired(getRecentlyActiveUsers)).Methods("GET")
}

func getLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	lines, err := app.GetLogs(0, 10000)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.ArrayToJson(lines)))
}

func getClusterStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	infos := app.GetClusterStatus()

	if einterfaces.GetClusterInterface() != nil {
		w.Header().Set(model.HEADER_CLUSTER_ID, einterfaces.GetClusterInterface().GetClusterId())
	}

	w.Write([]byte(model.ClusterInfosToJson(infos)))
}

func getAllAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	if audits, err := app.GetAudits("", 200); err != nil {
		c.Err = err
		return
	} else if HandleEtag(audits.Etag(), "Get All Audits", w, r) {
		return
	} else {
		etag := audits.Etag()
		if len(etag) > 0 {
			w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		}

		w.Write([]byte(audits.ToJson()))
		return
	}
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := app.GetConfig()
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func reloadConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	app.ReloadConfig()
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func invalidateAllCaches(c *Context, w http.ResponseWriter, r *http.Request) {
	err := app.InvalidateAllCaches()
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func saveConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("saveConfig", "config")
		return
	}

	err := app.SaveConfig(cfg, true)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	ReturnStatusOK(w)
}

func recycleDatabaseConnection(c *Context, w http.ResponseWriter, r *http.Request) {
	app.RecycleDatabaseConnection()
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func testEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("testEmail", "config")
		return
	}

	err := app.TestEmail(c.Session.UserId, cfg)
	if err != nil {
		c.Err = err
		return
	}

	m := make(map[string]string)
	m["SUCCESS"] = "true"
	w.Write([]byte(model.MapToJson(m)))
}

func getComplianceReports(c *Context, w http.ResponseWriter, r *http.Request) {
	crs, err := app.GetComplianceReports(0, 10000)
	if err != nil {
		c.Err = err
		return
	}
	w.Write([]byte(crs.ToJson()))
}

func saveComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	job := model.ComplianceFromJson(r.Body)
	if job == nil {
		c.SetInvalidParam("saveComplianceReport", "compliance")
		return
	}

	job.UserId = c.Session.UserId

	rjob, err := app.SaveComplianceReport(job)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	w.Write([]byte(rjob.ToJson()))
}

func downloadComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	id := params["id"]
	if len(id) != 26 {
		c.SetInvalidParam("downloadComplianceReport", "id")
		return
	}

	job, err := app.GetComplianceReport(id)
	if err != nil {
		c.Err = err
		return
	}

	reportBytes, err := app.GetComplianceFile(job)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("downloaded " + job.Desc)

	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Header().Set("Content-Length", strconv.Itoa(len(reportBytes)))
	w.Header().Del("Content-Type") // Content-Type will be set automatically by the http writer

	// attach extra headers to trigger a download on IE, Edge, and Safari
	ua := user_agent.New(r.UserAgent())
	bname, _ := ua.Browser()

	w.Header().Set("Content-Disposition", "attachment;filename=\""+job.JobName()+".zip\"")

	if bname == "Edge" || bname == "Internet Explorer" || bname == "Safari" {
		// trim off anything before the final / so we just get the file's name
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	w.Write(reportBytes)
}

func getAnalytics(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	teamId := params["id"]
	name := params["name"]

	rows, err := app.GetAnalytics(name, teamId)
	if err != nil {
		c.Err = err
		return
	}

	if rows == nil {
		c.SetInvalidParam("getAnalytics", "name")
		return
	}

	w.Write([]byte(rows.ToJson()))
}

func uploadBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if r.ContentLength > *utils.Cfg.FileSettings.MaxFileSize {
		c.Err = model.NewLocAppError("uploadBrandImage", "api.admin.upload_brand_image.too_large.app_error", nil, "")
		c.Err.StatusCode = http.StatusRequestEntityTooLarge
		return
	}

	if err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewLocAppError("uploadBrandImage", "api.admin.upload_brand_image.parse.app_error", nil, "")
		return
	}

	m := r.MultipartForm

	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewLocAppError("uploadBrandImage", "api.admin.upload_brand_image.no_file.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(imageArray) <= 0 {
		c.Err = model.NewLocAppError("uploadBrandImage", "api.admin.upload_brand_image.array.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if err := app.SaveBrandImage(imageArray[0]); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	ReturnStatusOK(w)
}

func getBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if img, err := app.GetBrandImage(); err != nil {
		w.Write(nil)
	} else {
		w.Header().Set("Content-Type", "image/png")
		w.Write(img)
	}
}

func adminResetMfa(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	userId := props["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("adminResetMfa", "user_id")
		return
	}

	if err := app.DeactivateMfa(userId); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func adminResetPassword(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	userId := props["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("adminResetPassword", "user_id")
		return
	}

	newPassword := props["new_password"]
	if err := utils.IsPasswordValid(newPassword); err != nil {
		c.Err = err
		return
	}

	if err := app.UpdatePasswordByUserIdSendEmail(userId, newPassword, c.T("api.user.reset_password.method")); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func ldapSyncNow(c *Context, w http.ResponseWriter, r *http.Request) {
	app.SyncLdap()

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func ldapTest(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := app.TestLdap(); err != nil {
		c.Err = err
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func samlMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	if result, err := app.GetSamlMetadata(); err != nil {
		c.Err = model.NewLocAppError("loginWithSaml", "api.admin.saml.metadata.app_error", nil, "err="+err.Message)
		return
	} else {
		w.Header().Set("Content-Type", "application/xml")
		w.Header().Set("Content-Disposition", "attachment; filename=\"metadata.xml\"")
		w.Write([]byte(result))
	}
}

func addCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm

	fileArray, ok := m.File["certificate"]
	if !ok {
		c.Err = model.NewLocAppError("addCertificate", "api.admin.add_certificate.no_file.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileArray) <= 0 {
		c.Err = model.NewLocAppError("addCertificate", "api.admin.add_certificate.array.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileData := fileArray[0]

	if err := app.WriteSamlFile(fileData); err != nil {
		c.Err = err
		return
	}
	ReturnStatusOK(w)
}

func removeCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	if err := app.RemoveSamlFile(props["filename"]); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func samlCertificateStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	status := app.GetSamlCertificateStatus()

	statusMap := map[string]interface{}{}
	statusMap["IdpCertificateFile"] = status.IdpCertificateFile
	statusMap["PrivateKeyFile"] = status.PrivateKeyFile
	statusMap["PublicCertificateFile"] = status.PublicCertificateFile

	w.Write([]byte(model.StringInterfaceToJson(statusMap)))
}

func getRecentlyActiveUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	if profiles, err := app.GetRecentlyActiveUsersForTeam(c.TeamId); err != nil {
		c.Err = err
		return
	} else {
		for _, p := range profiles {
			sanitizeProfile(c, p)
		}

		w.Write([]byte(model.UserMapToJson(profiles)))
	}
}
