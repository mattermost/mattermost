// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"html/template"
	"net/http"
)

var ServerTemplates *template.Template

type ServerTemplatePage Page

func NewServerTemplatePage(templateName, siteURL string) *ServerTemplatePage {
	props := make(map[string]string)
	props["AnalyticsUrl"] = utils.Cfg.ServiceSettings.AnalyticsUrl
	return &ServerTemplatePage{TemplateName: templateName, SiteName: utils.Cfg.ServiceSettings.SiteName, FeedbackEmail: utils.Cfg.EmailSettings.FeedbackEmail, SiteURL: siteURL, Props: props}
}

func (me *ServerTemplatePage) Render() string {
	var text bytes.Buffer
	if err := ServerTemplates.ExecuteTemplate(&text, me.TemplateName, me); err != nil {
		l4g.Error("Error rendering template %v err=%v", me.TemplateName, err)
	}

	return text.String()
}

func InitApi() {
	r := Srv.Router.PathPrefix("/api/v1").Subrouter()
	InitUser(r)
	InitTeam(r)
	InitChannel(r)
	InitPost(r)
	InitWebSocket(r)
	InitFile(r)
	InitCommand(r)
	InitConfig(r)
	InitOAuth(r)

	templatesDir := utils.FindDir("api/templates")
	l4g.Debug("Parsing server templates at %v", templatesDir)
	var err error
	if ServerTemplates, err = template.ParseGlob(templatesDir + "*.html"); err != nil {
		l4g.Error("Failed to parse server templates %v", err)
	}
}

func HandleEtag(etag string, w http.ResponseWriter, r *http.Request) bool {
	if et := r.Header.Get(model.HEADER_ETAG_CLIENT); len(etag) > 0 {
		if et == etag {
			w.WriteHeader(http.StatusNotModified)
			return true
		}
	}

	return false
}
