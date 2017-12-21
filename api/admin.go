// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mssola/user_agent"
)

func (api *API) InitAdmin() {
	api.BaseRoutes.Admin.Handle("/logs", api.ApiAdminSystemRequired(getLogs)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/audits", api.ApiAdminSystemRequired(getAllAudits)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/config", api.ApiAdminSystemRequired(getConfig)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/save_config", api.ApiAdminSystemRequired(saveConfig)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/reload_config", api.ApiAdminSystemRequired(reloadConfig)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/invalidate_all_caches", api.ApiAdminSystemRequired(invalidateAllCaches)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/test_email", api.ApiAdminSystemRequired(testEmail)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/recycle_db_conn", api.ApiAdminSystemRequired(recycleDatabaseConnection)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/analytics/{id:[A-Za-z0-9]+}/{name:[A-Za-z0-9_]+}", api.ApiAdminSystemRequired(getAnalytics)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/analytics/{name:[A-Za-z0-9_]+}", api.ApiAdminSystemRequired(getAnalytics)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/save_compliance_report", api.ApiAdminSystemRequired(saveComplianceReport)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/compliance_reports", api.ApiAdminSystemRequired(getComplianceReports)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/download_compliance_report/{id:[A-Za-z0-9]+}", api.ApiAdminSystemRequiredTrustRequester(downloadComplianceReport)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/upload_brand_image", api.ApiAdminSystemRequired(uploadBrandImage)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/get_brand_image", api.ApiAppHandlerTrustRequester(getBrandImage)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/reset_mfa", api.ApiAdminSystemRequired(adminResetMfa)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/reset_password", api.ApiAdminSystemRequired(adminResetPassword)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/ldap_sync_now", api.ApiAdminSystemRequired(ldapSyncNow)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/ldap_test", api.ApiAdminSystemRequired(ldapTest)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/saml_metadata", api.ApiAppHandler(samlMetadata)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/add_certificate", api.ApiAdminSystemRequired(addCertificate)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/remove_certificate", api.ApiAdminSystemRequired(removeCertificate)).Methods("POST")
	api.BaseRoutes.Admin.Handle("/saml_cert_status", api.ApiAdminSystemRequired(samlCertificateStatus)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/cluster_status", api.ApiAdminSystemRequired(getClusterStatus)).Methods("GET")
	api.BaseRoutes.Admin.Handle("/recently_active_users/{team_id:[A-Za-z0-9]+}", api.ApiUserRequired(getRecentlyActiveUsers)).Methods("GET")
}

func getLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	lines, err := c.App.GetLogs(0, 10000)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.ArrayToJson(lines)))
}

func getClusterStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	infos := c.App.GetClusterStatus()

	if c.App.Cluster != nil {
		w.Header().Set(model.HEADER_CLUSTER_ID, c.App.Cluster.GetClusterId())
	}

	w.Write([]byte(model.ClusterInfosToJson(infos)))
}

func getAllAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	if audits, err := c.App.GetAudits("", 200); err != nil {
		c.Err = err
		return
	} else if c.HandleEtag(audits.Etag(), "Get All Audits", w, r) {
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
	cfg := c.App.GetConfig()
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func reloadConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	c.App.ReloadConfig()
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func invalidateAllCaches(c *Context, w http.ResponseWriter, r *http.Request) {
	err := c.App.InvalidateAllCaches()
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

	err := c.App.SaveConfig(cfg, true)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	ReturnStatusOK(w)
}

func recycleDatabaseConnection(c *Context, w http.ResponseWriter, r *http.Request) {
	c.App.RecycleDatabaseConnection()
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func testEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("testEmail", "config")
		return
	}

	err := c.App.TestEmail(c.Session.UserId, cfg)
	if err != nil {
		c.Err = err
		return
	}

	m := make(map[string]string)
	m["SUCCESS"] = "true"
	w.Write([]byte(model.MapToJson(m)))
}

func getComplianceReports(c *Context, w http.ResponseWriter, r *http.Request) {
	crs, err := c.App.GetComplianceReports(0, 10000)
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

	rjob, err := c.App.SaveComplianceReport(job)
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

	job, err := c.App.GetComplianceReport(id)
	if err != nil {
		c.Err = err
		return
	}

	reportBytes, err := c.App.GetComplianceFile(job)
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

	rows, err := c.App.GetAnalytics(name, teamId)
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
	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.parse.app_error", nil, "", http.StatusBadRequest)
		return
	}

	m := r.MultipartForm

	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.no_file.app_error", nil, "", http.StatusBadRequest)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(imageArray) <= 0 {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.array.app_error", nil, "", http.StatusBadRequest)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if err := c.App.SaveBrandImage(imageArray[0]); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	ReturnStatusOK(w)
}

func getBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if img, err := c.App.GetBrandImage(); err != nil {
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

	if err := c.App.DeactivateMfa(userId); err != nil {
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
	if err := c.App.IsPasswordValid(newPassword); err != nil {
		c.Err = err
		return
	}

	if err := c.App.UpdatePasswordByUserIdSendEmail(userId, newPassword, c.T("api.user.reset_password.method")); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func ldapSyncNow(c *Context, w http.ResponseWriter, r *http.Request) {
	c.App.SyncLdap()

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func ldapTest(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := c.App.TestLdap(); err != nil {
		c.Err = err
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func samlMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	if result, err := c.App.GetSamlMetadata(); err != nil {
		c.Err = model.NewAppError("loginWithSaml", "api.admin.saml.metadata.app_error", nil, "err="+err.Message, http.StatusInternalServerError)
		return
	} else {
		w.Header().Set("Content-Type", "application/xml")
		w.Header().Set("Content-Disposition", "attachment; filename=\"metadata.xml\"")
		w.Write([]byte(result))
	}
}

func addCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm

	fileArray, ok := m.File["certificate"]
	if !ok {
		c.Err = model.NewAppError("addCertificate", "api.admin.add_certificate.no_file.app_error", nil, "", http.StatusBadRequest)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileArray) <= 0 {
		c.Err = model.NewAppError("addCertificate", "api.admin.add_certificate.array.app_error", nil, "", http.StatusBadRequest)
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
	status := c.App.GetSamlCertificateStatus()

	statusMap := map[string]interface{}{}
	statusMap["IdpCertificateFile"] = status.IdpCertificateFile
	statusMap["PrivateKeyFile"] = status.PrivateKeyFile
	statusMap["PublicCertificateFile"] = status.PublicCertificateFile

	w.Write([]byte(model.StringInterfaceToJson(statusMap)))
}

func getRecentlyActiveUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	if profiles, err := c.App.GetRecentlyActiveUsersForTeam(c.TeamId); err != nil {
		c.Err = err
		return
	} else {
		for _, p := range profiles {
			sanitizeProfile(c, p)
		}

		w.Write([]byte(model.UserMapToJson(profiles)))
	}
}
