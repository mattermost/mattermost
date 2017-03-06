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
	BaseRoutes.Teams.Handle("", ApiSessionRequired(getAllTeams)).Methods("GET")
	BaseRoutes.TeamsForUser.Handle("", ApiSessionRequired(getTeamsForUser)).Methods("GET")
	BaseRoutes.TeamsForUser.Handle("/unread", ApiSessionRequired(getTeamsUnreadForUser)).Methods("GET")

	BaseRoutes.Team.Handle("", ApiSessionRequired(getTeam)).Methods("GET")
	BaseRoutes.Team.Handle("/stats", ApiSessionRequired(getTeamStats)).Methods("GET")
	BaseRoutes.Team.Handle("/members", ApiSessionRequired(getTeamMembers)).Methods("GET")

	BaseRoutes.TeamByName.Handle("", ApiSessionRequired(getTeamByName)).Methods("GET")
	BaseRoutes.TeamMember.Handle("", ApiSessionRequired(getTeamMember)).Methods("GET")
	BaseRoutes.TeamMember.Handle("/roles", ApiSessionRequired(updateTeamMemberRoles)).Methods("PUT")
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

func getTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {
	if team, err := app.GetTeamByName(c.Params.TeamName); err != nil {
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

func getTeamsUnreadForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.Session.UserId != c.Params.UserId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	// optional team id to be excluded from the result
	teamId := r.URL.Query().Get("exclude_team")

	unreadTeamsList, err := app.GetTeamsUnreadForUser(teamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamsUnreadToJson(unreadTeamsList)))
}

func getTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if team, err := app.GetTeamMember(c.Params.TeamId, c.Params.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(team.ToJson()))
		return
	}
}

func getTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if members, err := app.GetTeamMembers(c.Params.TeamId, c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.TeamMembersToJson(members)))
		return
	}
}

func getTeamStats(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if stats, err := app.GetTeamStats(c.Params.TeamId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(stats.ToJson()))
		return
	}
}

func updateTeamMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJson(r.Body)

	newRoles := props["roles"]
	if !model.IsValidUserRoles(newRoles) {
		c.SetInvalidParam("team_member_roles")
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_TEAM_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM_ROLES)
		return
	}

	if _, err := app.UpdateTeamMemberRoles(c.Params.TeamId, c.Params.UserId, newRoles); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getAllTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	var teams []*model.Team
	var err *model.AppError

	if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		teams, err = app.GetAllTeamsPage(c.Params.Page, c.Params.PerPage)
	} else {
		teams, err = app.GetAllOpenTeamsPage(c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamListToJson(teams)))
}
