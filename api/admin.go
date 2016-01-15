// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bufio"
	"net/http"
	"os"
	"strings"

	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/i18n"
)

func InitAdmin(r *mux.Router) {
	T := i18n.GetSystemLanguage()
	l4g.Debug(T("Initializing admin api routes"))

	sr := r.PathPrefix("/admin").Subrouter()
	sr.Handle("/logs", ApiUserRequired(getLogs)).Methods("GET")
	sr.Handle("/config", ApiUserRequired(getConfig)).Methods("GET")
	sr.Handle("/save_config", ApiUserRequired(saveConfig)).Methods("POST")
	sr.Handle("/test_email", ApiUserRequired(testEmail)).Methods("POST")
	sr.Handle("/client_props", ApiAppHandler(getClientConfig)).Methods("GET")
	sr.Handle("/log_client", ApiAppHandler(logClient)).Methods("POST")
	sr.Handle("/analytics/{id:[A-Za-z0-9]+}/{name:[A-Za-z0-9_]+}", ApiAppHandler(getAnalytics)).Methods("GET")
}

func getLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !c.HasSystemAdminPermissions("getLogs", T) {
		return
	}

	var lines []string

	if utils.Cfg.LogSettings.EnableFile {

		file, err := os.Open(utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation))
		if err != nil {
			c.Err = model.NewAppError("getLogs", T("Error reading log file"), err.Error())
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
		err := model.NewAppError("client", msg, "")
		c.LogError(err)
	}

	rm := make(map[string]string)
	rm["SUCCESS"] = "true"
	w.Write([]byte(model.MapToJson(rm)))
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !c.HasSystemAdminPermissions("getConfig", T) {
		return
	}

	json := utils.Cfg.ToJson()
	cfg := model.ConfigFromJson(strings.NewReader(json))
	json = cfg.ToJson()

	w.Write([]byte(json))
}

func saveConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !c.HasSystemAdminPermissions("getConfig", T) {
		return
	}

	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("saveConfig", "config")
		return
	}

	cfg.SetDefaults()

	if err := cfg.IsValid(T); err != nil {
		c.Err = err
		return
	}

	utils.SaveConfig(utils.CfgFileName, cfg, T)
	utils.LoadConfig(utils.CfgFileName, T)
	json := utils.Cfg.ToJson()
	w.Write([]byte(json))
}

func testEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !c.HasSystemAdminPermissions("testEmail", T) {
		return
	}

	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("testEmail", "config")
		return
	}

	if result := <-Srv.Store.User().Get(c.Session.UserId, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if err := utils.SendMailUsingConfig(result.Data.(*model.User).Email, T("Mattermost - Testing Email Settings"), T("<br/><br/><br/>It appears your Mattermost email is setup correctly!"), cfg, T); err != nil {
			c.Err = err
			return
		}
	}

	m := make(map[string]string)
	m["SUCCESS"] = "true"
	w.Write([]byte(model.MapToJson(m)))
}

func getAnalytics(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !c.HasSystemAdminPermissions("getAnalytics", T) {
		return
	}

	params := mux.Vars(r)
	teamId := params["id"]
	name := params["name"]

	if name == "standard" {
		var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 3)
		rows[0] = &model.AnalyticsRow{"channel_open_count", 0}
		rows[1] = &model.AnalyticsRow{"channel_private_count", 0}
		rows[2] = &model.AnalyticsRow{"post_count", 0}
		openChan := Srv.Store.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_OPEN, T)
		privateChan := Srv.Store.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_PRIVATE, T)
		postChan := Srv.Store.Post().AnalyticsPostCount(teamId, T)

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

		w.Write([]byte(rows.ToJson()))
	} else if name == "post_counts_day" {
		if r := <-Srv.Store.Post().AnalyticsPostCountsByDay(teamId, T); r.Err != nil {
			c.Err = r.Err
			return
		} else {
			w.Write([]byte(r.Data.(model.AnalyticsRows).ToJson()))
		}
	} else if name == "user_counts_with_posts_day" {
		if r := <-Srv.Store.Post().AnalyticsUserCountsWithPostsByDay(teamId, T); r.Err != nil {
			c.Err = r.Err
			return
		} else {
			w.Write([]byte(r.Data.(model.AnalyticsRows).ToJson()))
		}
	} else {
		c.SetInvalidParam("getAnalytics", "name")
	}

}
