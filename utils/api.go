// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"crypto"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

func CheckOrigin(r *http.Request, allowedOrigins string) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}

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

func RenderWebAppError(config *model.Config, w http.ResponseWriter, r *http.Request, err *model.AppError, s crypto.Signer) {
	RenderWebError(config, w, r, err.StatusCode, url.Values{
		"message": []string{err.Message},
	}, s)
}

func RenderWebError(config *model.Config, w http.ResponseWriter, r *http.Request, status int, params url.Values, s crypto.Signer) {
	queryString := params.Encode()

	subpath, _ := GetSubpathFromConfig(config)

	h := crypto.SHA256
	sum := h.New()
	sum.Write([]byte(path.Join(subpath, "error") + "?" + queryString))
	signature, err := s.Sign(rand.Reader, sum.Sum(nil), h)
	if err != nil {
		http.Error(w, "", http.StatusInternalServerError)
		return
	}
	destination := path.Join(subpath, "error") + "?" + queryString + "&s=" + base64.URLEncoding.EncodeToString(signature)

	if status >= 300 && status < 400 {
		http.Redirect(w, r, destination, status)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(status)
	fmt.Fprintln(w, `<!DOCTYPE html><html><head></head>`)
	fmt.Fprintln(w, `<body onload="window.location = '`+template.HTMLEscapeString(template.JSEscapeString(destination))+`'">`)
	fmt.Fprintln(w, `<noscript><meta http-equiv="refresh" content="0; url=`+template.HTMLEscapeString(destination)+`"></noscript>`)
	fmt.Fprintln(w, `<!-- web error message -->`)
	fmt.Fprintln(w, `<a href="`+template.HTMLEscapeString(destination)+`" style="color: #c0c0c0;">...</a>`)
	fmt.Fprintln(w, `</body></html>`)
}

func RenderMobileAuthComplete(w http.ResponseWriter, redirectURL string) {
	RenderMobileMessage(w, `
		<div class="icon text-success" style="font-size: 4em">
			<i class="fa fa-check-circle" title="Success Icon"></i>
		</div>
		<h2> `+i18n.T("api.oauth.auth_complete")+` </h2>
		<p id="redirecting-message"> `+i18n.T("api.oauth.redirecting_back")+` </p>
		<p id="close-tab-message" style="display: none"> `+i18n.T("api.oauth.close_browser")+` </p>
		<noscript><meta http-equiv="refresh" content="2; url=`+template.HTMLEscapeString(redirectURL)+`"></noscript>
		<script>
			window.onload = function() {
				setTimeout(function() {
					document.getElementById('redirecting-message').style.display = 'none';
					document.getElementById('close-tab-message').style.display = 'block';
					window.location='`+template.HTMLEscapeString(template.JSEscapeString(redirectURL))+`';
				}, 2000);
			}
		</script>
	`)
}

func RenderMobileError(config *model.Config, w http.ResponseWriter, err *model.AppError, redirectURL string) {
	RenderMobileMessage(w, `
		<div class="icon" style="color: #ccc; font-size: 4em">
			<span class="fa fa-warning"></span>
		</div>
		<h2> `+i18n.T("error")+` </h2>
		<p> `+err.Message+` </p>
		<a href="`+redirectURL+`">
			`+i18n.T("api.back_to_app", map[string]interface{}{"SiteName": config.TeamSettings.SiteName})+`
		</a>
	`)
}

func RenderMobileMessage(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprintln(w, `
		<!DOCTYPE html>
		<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, user-scalable=yes, viewport-fit=cover">
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.css" integrity="sha512-5A8nwdMOWrSz20fDsjczgUidUBR8liPYU+WymTZP1lmY9G6Oc7HlZv156XqnsgNUzTyMefFTcsFH/tnJE/+xBg==" crossorigin="anonymous" />
				<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous" />
				<style>
					.message-container {
						color: #555;
						display: table-cell;
						padding: 5em 0;
						text-align: left;
						vertical-align: top;
					}
				</style>
			</head>
			<body>
				<!-- mobile app message -->
				<div class="container-fluid">
					<div class="message-container">
						`+message+`
					</div>
				</div>
			</body>
		</html>
	`)
}
