// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitTeam() {
	l4g.Debug(utils.T("api.team.init.debug"))

	BaseRoutes.Teams.Handle("", ApiSessionRequired(createTeam)).Methods("POST")

}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	team := model.TeamFromJson(r.Body)
	if team == nil {
		c.SetInvalidParam("team")
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_TEAM) {
		c.Err = model.NewAppError("createTeam", "api.team.is_team_creation_allowed.disabled.app_error", nil, "", http.StatusForbidden)
		return
	}

	rteam, err := app.CreateTeamWithUser(team, c.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(rteam.ToJson()))
}
