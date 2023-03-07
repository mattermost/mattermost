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

	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/i18n"
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
	var link = template.HTMLEscapeString(redirectURL)
	RenderMobileMessage(w, `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 64px; height: 64px; fill: #3c763d">
			<!-- Font Awesome Free 5.15.3 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) -->
			<path stroke="green" d="M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z"/>
		</svg>
		<h2> `+i18n.T("api.oauth.auth_complete")+` </h2>
		<p id="redirecting-message"> `+i18n.T("api.oauth.redirecting_back")+` </p>
		<p id="close-tab-message" style="display: none"> `+i18n.T("api.oauth.close_browser")+` </p>
		<p> `+i18n.T("api.oauth.click_redirect", model.StringInterface{"Link": link})+` </p>
		<meta http-equiv="refresh" content="2; url=`+link+`">
		<script>
			window.onload = function() {
				setTimeout(function() {
					document.getElementById('redirecting-message').style.display = 'none';
					document.getElementById('close-tab-message').style.display = 'block';
				}, 2000);
			}
		</script>
	`)
}

func RenderMobileError(config *model.Config, w http.ResponseWriter, err *model.AppError, redirectURL string) {
	var link = template.HTMLEscapeString(redirectURL)
	var invalidSchemes = map[string]bool{
		"data":       true,
		"javascript": true,
		"vbscript":   true,
	}
	u, redirectErr := url.Parse(redirectURL)
	if redirectErr != nil || invalidSchemes[u.Scheme] {
		link = *config.ServiceSettings.SiteURL
	}
	RenderMobileMessage(w, `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" style="width: 64px; height: 64px; fill: #ccc">
			<!-- Font Awesome Free 5.15.3 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) -->
			<path d="M569.517 440.013C587.975 472.007 564.806 512 527.94 512H48.054c-36.937 0-59.999-40.055-41.577-71.987L246.423 23.985c18.467-32.009 64.72-31.951 83.154 0l239.94 416.028zM288 354c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"/>
		</svg>
		<h2> `+i18n.T("error")+` </h2>
		<p> `+err.Message+` </p>
		<a href="`+link+`">
			`+i18n.T("api.back_to_app", map[string]any{"SiteName": config.TeamSettings.SiteName})+`
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
				<style>
					body {
						color: #333;
						background-color: #fff;
						font-family: "Helvetica Neue",Helvetica,Arial,sans-serif;
						font-size: 14px;
						line-height: 1.42857143;
					}
					a {
						color: #337ab7;
						text-decoration: none;
					}
					a:focus, a:hover {
						color: #23527c;
						text-decoration: underline;
					}
					h2 {
						font-size: 30px;
						margin: 20px 0 10px 0;
						font-weight: 500;
						line-height: 1.1
					}
					p {
						margin: 0 0 10px;
					}
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
				<div class="message-container">
					`+message+`
				</div>
			</body>
		</html>
	`)
}
