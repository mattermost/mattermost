// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost-server/model"
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
	message := err.Message
	details := err.DetailedError

	status := http.StatusTemporaryRedirect
	if err.StatusCode != http.StatusInternalServerError {
		status = err.StatusCode
	}

	http.Redirect(
		w,
		r,
		"/error?message="+url.QueryEscape(message)+
			"&details="+url.QueryEscape(details),
		status)
}
