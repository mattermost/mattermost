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
	BaseRoutes.Team.Handle("", ApiSessionRequired(getTeam)).Methods("GET")
	BaseRoutes.TeamsForUser.Handle("", ApiSessionRequired(getTeamsForUser)).Methods("GET")

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

func getTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if team, err := app.GetTeam(c.Params.TeamId); err != nil {
		c.Err = err
		return
	} else {
		if team.Type != model.TEAM_OPEN && !app.SessionHasPermissionToTeam(c.Session, team.Id, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		w.Write([]byte(team.ToJson()))
		return
	}
}

func getTeamsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.Session.UserId != c.Params.UserId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if teams, err := app.GetTeamsForUser(c.Params.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.TeamListToJson(teams)))
	}
}
