// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"path"
	"strings"

	"github.com/avct/uasurfer"
	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/configservice"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type Web struct {
	GetGlobalAppOptions app.AppOptionCreator
	ConfigService       configservice.ConfigService
	MainRouter          *mux.Router
}

func New(config configservice.ConfigService, globalOptions app.AppOptionCreator, root *mux.Router) *Web {
	mlog.Debug("Initializing web routes")

	web := &Web{
		GetGlobalAppOptions: globalOptions,
		ConfigService:       config,
		MainRouter:          root,
	}

	web.InitOAuth()
	web.InitWebhooks()
	web.InitSaml()
	web.InitStatic()

	return web
}

// Due to the complexities of UA detection and the ramifications of a misdetection
// only older Safari and IE browsers throw incompatibility errors.
// Map should be of minimum required browser version.
// -1 means that the browser is not supported in any version.
var browserMinimumSupported = map[string]int{
	"BrowserIE":     12,
	"BrowserSafari": 12,
}

func CheckClientCompatability(agentString string) bool {
	ua := uasurfer.Parse(agentString)

	if version, exist := browserMinimumSupported[ua.Browser.Name.String()]; exist && (ua.Browser.Version.Major < version || version < 0) {
		return false
	}

	return true
}

func Handle404(config configservice.ConfigService, w http.ResponseWriter, r *http.Request) {
	err := model.NewAppError("Handle404", "api.context.404.app_error", nil, "", http.StatusNotFound)
	ipAddress := utils.GetIpAddress(r, config.Config().ServiceSettings.TrustedProxyIPHeader)
	mlog.Debug("not found handler triggered", mlog.String("path", r.URL.Path), mlog.Int("code", 404), mlog.String("ip", ipAddress))

	if IsApiCall(config, r) {
		w.WriteHeader(err.StatusCode)
		err.DetailedError = "There doesn't appear to be an api call for the url='" + r.URL.Path + "'.  Typo? are you missing a team_id or user_id as part of the url?"
		w.Write([]byte(err.ToJson()))
	} else if *config.Config().ServiceSettings.WebserverMode == "disabled" {
		http.NotFound(w, r)
	} else {
		utils.RenderWebAppError(config.Config(), w, r, err, config.AsymmetricSigningKey())
	}
}

func IsApiCall(config configservice.ConfigService, r *http.Request) bool {
	subpath, _ := utils.GetSubpathFromConfig(config.Config())

	return strings.HasPrefix(r.URL.Path, path.Join(subpath, "api")+"/")
}

func IsWebhookCall(a *app.App, r *http.Request) bool {
	subpath, _ := utils.GetSubpathFromConfig(a.Config())

	return strings.HasPrefix(r.URL.Path, path.Join(subpath, "hooks")+"/")
}

func IsOAuthApiCall(config configservice.ConfigService, r *http.Request) bool {
	subpath, _ := utils.GetSubpathFromConfig(config.Config())

	if r.Method == "POST" && r.URL.Path == path.Join(subpath, "oauth", "authorize") {
		return true
	}

	if r.URL.Path == path.Join(subpath, "oauth", "apps", "authorized") ||
		r.URL.Path == path.Join(subpath, "oauth", "deauthorize") ||
		r.URL.Path == path.Join(subpath, "oauth", "access_token") {
		return true
	}
	return false
}

func ReturnStatusOK(w http.ResponseWriter) {
	m := make(map[string]string)
	m[model.STATUS] = model.STATUS_OK
	w.Write([]byte(model.MapToJson(m)))
}
