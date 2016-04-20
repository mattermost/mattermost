// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bufio"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
)

func InitAdmin() {
	l4g.Debug(utils.T("api.admin.init.debug"))

	BaseRoutes.Admin.Handle("/logs", ApiUserRequired(getLogs)).Methods("GET")
	BaseRoutes.Admin.Handle("/audits", ApiUserRequired(getAllAudits)).Methods("GET")
	BaseRoutes.Admin.Handle("/config", ApiUserRequired(getConfig)).Methods("GET")
	BaseRoutes.Admin.Handle("/save_config", ApiUserRequired(saveConfig)).Methods("POST")
	BaseRoutes.Admin.Handle("/test_email", ApiUserRequired(testEmail)).Methods("POST")
	BaseRoutes.Admin.Handle("/client_props", ApiAppHandler(getClientConfig)).Methods("GET")
	BaseRoutes.Admin.Handle("/log_client", ApiAppHandler(logClient)).Methods("POST")
	BaseRoutes.Admin.Handle("/analytics/{id:[A-Za-z0-9]+}/{name:[A-Za-z0-9_]+}", ApiUserRequired(getAnalytics)).Methods("GET")
	BaseRoutes.Admin.Handle("/analytics/{name:[A-Za-z0-9_]+}", ApiUserRequired(getAnalytics)).Methods("GET")
	BaseRoutes.Admin.Handle("/save_compliance_report", ApiUserRequired(saveComplianceReport)).Methods("POST")
	BaseRoutes.Admin.Handle("/compliance_reports", ApiUserRequired(getComplianceReports)).Methods("GET")
	BaseRoutes.Admin.Handle("/download_compliance_report/{id:[A-Za-z0-9]+}", ApiUserRequired(downloadComplianceReport)).Methods("GET")
	BaseRoutes.Admin.Handle("/upload_brand_image", ApiAdminSystemRequired(uploadBrandImage)).Methods("POST")
	BaseRoutes.Admin.Handle("/get_brand_image", ApiAppHandlerTrustRequester(getBrandImage)).Methods("GET")
	BaseRoutes.Admin.Handle("/reset_mfa", ApiAdminSystemRequired(adminResetMfa)).Methods("POST")
	BaseRoutes.Admin.Handle("/reset_password", ApiAdminSystemRequired(adminResetPassword)).Methods("POST")
}

func getLogs(c *Context, w http.ResponseWriter, r *http.Request) {

	if !c.HasSystemAdminPermissions("getLogs") {
		return
	}

	var lines []string

	if utils.Cfg.LogSettings.EnableFile {

		file, err := os.Open(utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation))
		if err != nil {
			c.Err = model.NewLocAppError("getLogs", "api.admin.file_read_error", nil, err.Error())
		}

		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
	} else {
		lines = append(lines, "")
	}

	w.Write([]byte(model.ArrayToJson(lines)))
}

func getAllAudits(c *Context, w http.ResponseWriter, r *http.Request) {

	if !c.HasSystemAdminPermissions("getAllAudits") {
		return
	}

	if result := <-Srv.Store.Audit().Get("", 200); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		audits := result.Data.(model.Audits)
		etag := audits.Etag()

		if HandleEtag(etag, w, r) {
			return
		}

		if len(etag) > 0 {
			w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		}

		w.Write([]byte(audits.ToJson()))
		return
	}
}

func getClientConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	w.Write([]byte(model.MapToJson(utils.ClientCfg)))
}

func logClient(c *Context, w http.ResponseWriter, r *http.Request) {
	m := model.MapFromJson(r.Body)

	lvl := m["level"]
	msg := m["message"]

	if len(msg) > 400 {
		msg = msg[0:399]
	}

	if lvl == "ERROR" {
		err := &model.AppError{}
		err.Message = msg
		err.Where = "client"
		c.LogError(err)
	}

	rm := make(map[string]string)
	rm["SUCCESS"] = "true"
	w.Write([]byte(model.MapToJson(rm)))
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasSystemAdminPermissions("getConfig") {
		return
	}

	json := utils.Cfg.ToJson()
	cfg := model.ConfigFromJson(strings.NewReader(json))
	json = cfg.ToJson()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(json))
}

func saveConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasSystemAdminPermissions("getConfig") {
		return
	}

	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("saveConfig", "config")
		return
	}

	cfg.SetDefaults()

	if err := cfg.IsValid(); err != nil {
		c.Err = err
		return
	}

	if err := utils.ValidateLdapFilter(cfg); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	utils.SaveConfig(utils.CfgFileName, cfg)
	utils.LoadConfig(utils.CfgFileName)
	json := utils.Cfg.ToJson()
	w.Write([]byte(json))
}

func testEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasSystemAdminPermissions("testEmail") {
		return
	}

	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("testEmail", "config")
		return
	}

	if result := <-Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if err := utils.SendMailUsingConfig(result.Data.(*model.User).Email, c.T("api.admin.test_email.subject"), c.T("api.admin.test_email.body"), cfg); err != nil {
			c.Err = err
			return
		}
	}

	m := make(map[string]string)
	m["SUCCESS"] = "true"
	w.Write([]byte(model.MapToJson(m)))
}

func getComplianceReports(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasSystemAdminPermissions("getComplianceReports") {
		return
	}

	if !*utils.Cfg.ComplianceSettings.Enable || !utils.IsLicensed || !*utils.License.Features.Compliance {
		c.Err = model.NewLocAppError("getComplianceReports", "ent.compliance.licence_disable.app_error", nil, "")
		return
	}

	if result := <-Srv.Store.Compliance().GetAll(); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		crs := result.Data.(model.Compliances)
		w.Write([]byte(crs.ToJson()))
	}
}

func saveComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasSystemAdminPermissions("getComplianceReports") {
		return
	}

	if !*utils.Cfg.ComplianceSettings.Enable || !utils.IsLicensed || !*utils.License.Features.Compliance || einterfaces.GetComplianceInterface() == nil {
		c.Err = model.NewLocAppError("saveComplianceReport", "ent.compliance.licence_disable.app_error", nil, "")
		return
	}

	job := model.ComplianceFromJson(r.Body)
	if job == nil {
		c.SetInvalidParam("saveComplianceReport", "compliance")
		return
	}

	job.UserId = c.Session.UserId
	job.Type = model.COMPLIANCE_TYPE_ADHOC

	if result := <-Srv.Store.Compliance().Save(job); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		job = result.Data.(*model.Compliance)
		go einterfaces.GetComplianceInterface().RunComplianceJob(job)
	}

	w.Write([]byte(job.ToJson()))
}

func downloadComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasSystemAdminPermissions("downloadComplianceReport") {
		return
	}

	if !*utils.Cfg.ComplianceSettings.Enable || !utils.IsLicensed || !*utils.License.Features.Compliance || einterfaces.GetComplianceInterface() == nil {
		c.Err = model.NewLocAppError("downloadComplianceReport", "ent.compliance.licence_disable.app_error", nil, "")
		return
	}

	params := mux.Vars(r)

	id := params["id"]
	if len(id) != 26 {
		c.SetInvalidParam("downloadComplianceReport", "id")
		return
	}

	if result := <-Srv.Store.Compliance().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		job := result.Data.(*model.Compliance)
		c.LogAudit("downloaded " + job.Desc)

		if f, err := ioutil.ReadFile(*utils.Cfg.ComplianceSettings.Directory + "compliance/" + job.JobName() + ".zip"); err != nil {
			c.Err = model.NewLocAppError("readFile", "api.file.read_file.reading_local.app_error", nil, err.Error())
			return
		} else {
			w.Header().Set("Cache-Control", "max-age=2592000, public")
			w.Header().Set("Content-Length", strconv.Itoa(len(f)))
			w.Header().Del("Content-Type") // Content-Type will be set automatically by the http writer

			// attach extra headers to trigger a download on IE, Edge, and Safari
			ua := user_agent.New(r.UserAgent())
			bname, _ := ua.Browser()

			w.Header().Set("Content-Disposition", "attachment;filename=\""+job.JobName()+".zip\"")

			if bname == "Edge" || bname == "Internet Explorer" || bname == "Safari" {
				// trim off anything before the final / so we just get the file's name
				w.Header().Set("Content-Type", "application/octet-stream")
			}

			w.Write(f)
		}
	}
}

func getAnalytics(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasSystemAdminPermissions("getAnalytics") {
		return
	}

	params := mux.Vars(r)
	teamId := params["id"]
	name := params["name"]

	if name == "standard" {
		var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 5)
		rows[0] = &model.AnalyticsRow{"channel_open_count", 0}
		rows[1] = &model.AnalyticsRow{"channel_private_count", 0}
		rows[2] = &model.AnalyticsRow{"post_count", 0}
		rows[3] = &model.AnalyticsRow{"unique_user_count", 0}
		rows[4] = &model.AnalyticsRow{"team_count", 0}

		openChan := Srv.Store.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_OPEN)
		privateChan := Srv.Store.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_PRIVATE)
		postChan := Srv.Store.Post().AnalyticsPostCount(teamId, false, false)
		userChan := Srv.Store.User().AnalyticsUniqueUserCount(teamId)
		teamChan := Srv.Store.Team().AnalyticsTeamCount()

		if r := <-openChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[0].Value = float64(r.Data.(int64))
		}

		if r := <-privateChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[1].Value = float64(r.Data.(int64))
		}

		if r := <-postChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[2].Value = float64(r.Data.(int64))
		}

		if r := <-userChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[3].Value = float64(r.Data.(int64))
		}

		if r := <-teamChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[4].Value = float64(r.Data.(int64))
		}

		w.Write([]byte(rows.ToJson()))
	} else if name == "post_counts_day" {
		if r := <-Srv.Store.Post().AnalyticsPostCountsByDay(teamId); r.Err != nil {
			c.Err = r.Err
			return
		} else {
			w.Write([]byte(r.Data.(model.AnalyticsRows).ToJson()))
		}
	} else if name == "user_counts_with_posts_day" {
		if r := <-Srv.Store.Post().AnalyticsUserCountsWithPostsByDay(teamId); r.Err != nil {
			c.Err = r.Err
			return
		} else {
			w.Write([]byte(r.Data.(model.AnalyticsRows).ToJson()))
		}
	} else if name == "extra_counts" {
		var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 6)
		rows[0] = &model.AnalyticsRow{"file_post_count", 0}
		rows[1] = &model.AnalyticsRow{"hashtag_post_count", 0}
		rows[2] = &model.AnalyticsRow{"incoming_webhook_count", 0}
		rows[3] = &model.AnalyticsRow{"outgoing_webhook_count", 0}
		rows[4] = &model.AnalyticsRow{"command_count", 0}
		rows[5] = &model.AnalyticsRow{"session_count", 0}

		fileChan := Srv.Store.Post().AnalyticsPostCount(teamId, true, false)
		hashtagChan := Srv.Store.Post().AnalyticsPostCount(teamId, false, true)
		iHookChan := Srv.Store.Webhook().AnalyticsIncomingCount(teamId)
		oHookChan := Srv.Store.Webhook().AnalyticsOutgoingCount(teamId)
		commandChan := Srv.Store.Command().AnalyticsCommandCount(teamId)
		sessionChan := Srv.Store.Session().AnalyticsSessionCount()

		if r := <-fileChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[0].Value = float64(r.Data.(int64))
		}

		if r := <-hashtagChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[1].Value = float64(r.Data.(int64))
		}

		if r := <-iHookChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[2].Value = float64(r.Data.(int64))
		}

		if r := <-oHookChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[3].Value = float64(r.Data.(int64))
		}

		if r := <-commandChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[4].Value = float64(r.Data.(int64))
		}

		if r := <-sessionChan; r.Err != nil {
			c.Err = r.Err
			return
		} else {
			rows[5].Value = float64(r.Data.(int64))
		}

		w.Write([]byte(rows.ToJson()))
	} else {
		c.SetInvalidParam("getAnalytics", "name")
	}

}

func uploadBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("uploadBrandImage", "api.admin.upload_brand_image.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if r.ContentLength > model.MAX_FILE_SIZE {
		c.Err = model.NewLocAppError("uploadBrandImage", "api.admin.upload_brand_image.too_large.app_error", nil, "")
		c.Err.StatusCode = http.StatusRequestEntityTooLarge
		return
	}

	if err := r.ParseMultipartForm(model.MAX_FILE_SIZE); err != nil {
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

	brandInterface := einterfaces.GetBrandInterface()
	if brandInterface == nil {
		c.Err = model.NewLocAppError("uploadBrandImage", "api.admin.upload_brand_image.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if err := brandInterface.SaveBrandImage(imageArray[0]); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	rdata := map[string]string{}
	rdata["status"] = "OK"
	w.Write([]byte(model.MapToJson(rdata)))
}

func getBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("getBrandImage", "api.admin.get_brand_image.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	brandInterface := einterfaces.GetBrandInterface()
	if brandInterface == nil {
		c.Err = model.NewLocAppError("getBrandImage", "api.admin.get_brand_image.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if img, err := brandInterface.GetBrandImage(); err != nil {
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

	if err := DeactivateMfa(userId); err != nil {
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
	if len(newPassword) < model.MIN_PASSWORD_LENGTH {
		c.SetInvalidParam("adminResetPassword", "new_password")
		return
	}

	if err := ResetPassword(c, userId, newPassword); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}
