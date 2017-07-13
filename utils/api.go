// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/mattermost/platform/model"
)

type OriginCheckerProc func(*http.Request) bool

func OriginChecker(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if *Cfg.ServiceSettings.AllowCorsFrom == "*" {
		return true
	}
	for _, allowed := range strings.Split(*Cfg.ServiceSettings.AllowCorsFrom, " ") {
		if allowed == origin {
			return true
		}
	}
	return false
}

func GetOriginChecker(r *http.Request) OriginCheckerProc {
	if len(*Cfg.ServiceSettings.AllowCorsFrom) > 0 {
		return OriginChecker
	}

	return nil
}

func RenderWebError(err *model.AppError, w http.ResponseWriter, r *http.Request) {
	T, _ := GetTranslationsAndLocale(w, r)

	title := T("api.templates.error.title", map[string]interface{}{"SiteName": ClientCfg["SiteName"]})
	message := err.Message
	details := err.DetailedError
	link := "/"
	linkMessage := T("api.templates.error.link")

	status := http.StatusTemporaryRedirect
	if err.StatusCode != http.StatusInternalServerError {
		status = err.StatusCode
	}

	http.Redirect(
		w,
		r,
		"/error?title="+url.QueryEscape(title)+
			"&message="+url.QueryEscape(message)+
			"&details="+url.QueryEscape(details)+
			"&link="+url.QueryEscape(link)+
			"&linkmessage="+url.QueryEscape(linkMessage),
		status)
}
