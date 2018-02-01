// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"fmt"
	"html/template"
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
	status := http.StatusTemporaryRedirect
	if err.StatusCode != http.StatusInternalServerError {
		status = err.StatusCode
	}

	destination := strings.TrimRight(GetSiteURL(), "/") + "/error?message=" + url.QueryEscape(err.Message)
	if status >= 300 && status < 400 {
		http.Redirect(w, r, destination, status)
		return
	}

	w.WriteHeader(status)
	fmt.Fprintln(w, `<!DOCTYPE html><html><head></head>`)
	fmt.Fprintln(w, `<body onload="window.location = '`+template.HTMLEscapeString(template.JSEscapeString(destination))+`'">`)
	fmt.Fprintln(w, `<noscript><meta http-equiv="refresh" content="0; url=`+template.HTMLEscapeString(destination)+`"></noscript>`)
	fmt.Fprintln(w, `<a href="`+template.HTMLEscapeString(destination)+`" style="color: #c0c0c0;">...</a>`)
	fmt.Fprintln(w, `</body></html>`)
}
