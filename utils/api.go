// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost-server/model"
)

func CheckOrigin(r *http.Request, allowedOrigins string) bool {
	origin := r.Header.Get("Origin")
	if allowedOrigins == "*" {
		return true
	}
	for _, allowed := range strings.Split(allowedOrigins, " ") {
		if allowed == origin {
			return true
		}
	}
	return false
}

func OriginChecker(allowedOrigins string) func(*http.Request) bool {
	return func(r *http.Request) bool {
		return CheckOrigin(r, allowedOrigins)
	}
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
