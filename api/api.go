// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	_ "github.com/cloudfoundry/jibber_jabber"
	_ "github.com/nicksnyder/go-i18n/i18n"
)

func InitApi() {
	r := Srv.Router.PathPrefix("/api/v1").Subrouter()
	InitUser(r)
	InitTeam(r)
	InitChannel(r)
	InitPost(r)
	InitWebSocket(r)
	InitFile(r)
	InitCommand(r)
	InitAdmin(r)
	InitOAuth(r)
	InitWebhook(r)
	InitPreference(r)
	InitLicense(r)

	utils.InitHTML()
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
