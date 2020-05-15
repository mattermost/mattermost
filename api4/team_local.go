// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitTeamLocal() {
	api.BaseRoutes.Teams.Handle("", api.ApiLocal(localCreateTeam)).Methods("POST")
	api.BaseRoutes.Teams.Handle("", api.ApiLocal(getAllTeams)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/search", api.ApiLocal(localSearchTeams)).Methods("POST")
	api.BaseRoutes.Team.Handle("", api.ApiLocal(getTeam)).Methods("GET")
	api.BaseRoutes.Team.Handle("", api.ApiLocal(localUpdateTeam)).Methods("PUT")
	api.BaseRoutes.Team.Handle("", api.ApiLocal(localDeleteTeam)).Methods("DELETE")
	api.BaseRoutes.Team.Handle("/patch", api.ApiLocal(localPatchTeam)).Methods("PUT")
	api.BaseRoutes.TeamByName.Handle("", api.ApiLocal(localGetTeamByName)).Methods("GET")
}

func localCreateTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	team := model.TeamFromJson(r.Body)
	if team == nil {
		c.SetInvalidParam("team")
		return
	}
	team.Email = strings.ToLower(team.Email)

	auditRec := c.MakeAuditRecord("localCreateTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("team", team)

	rteam, err := c.App.CreateTeam(team)
	if err != nil {
		c.Err = err
		return
	}
	// Don't sanitize the team here since the user will be a team admin and their session won't reflect that yet

	auditRec.Success()
	auditRec.AddMeta("team", team) // overwrite meta

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(rteam.ToJson()))
}

func localUpdateTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("team")
		return
	}
	team.Email = strings.ToLower(team.Email)

	// The team being updated in the payload must be the same one as indicated in the URL.
	if team.Id != c.Params.TeamId {
		c.SetInvalidParam("id")
		return
	}

	auditRec := c.MakeAuditRecord("localUpdateTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("team", team)

	updatedTeam, err := c.App.UpdateTeam(team)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("update", updatedTeam)

	c.App.SanitizeTeam(*c.App.Session(), updatedTeam)
	w.Write([]byte(updatedTeam.ToJson()))
}

func localGetTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamName()
	if c.Err != nil {
		return
	}

	team, err := c.App.GetTeamByName(c.Params.TeamName)
	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeam(*c.App.Session(), team)
	w.Write([]byte(team.ToJson()))
}

func localSearchTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.TeamSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("team_search")
		return
	}

	if len(props.Term) == 0 {
		c.SetInvalidParam("term")
		return
	}

	teams, totalCount, err := c.App.SearchAllTeams(props)
	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeams(*c.App.Session(), teams)

	var payload []byte
	if props.Page != nil && props.PerPage != nil {
		twc := &model.TeamsWithCount{Teams: teams, TotalCount: totalCount}
		payload = model.TeamsWithCountToJson(twc)
	} else {
		payload = []byte(model.TeamListToJson(teams))
	}

	w.Write(payload)
}

func localPatchTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	team := model.TeamPatchFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("team")
		return
	}

	auditRec := c.MakeAuditRecord("localPatchTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if oldTeam, err := c.App.GetTeam(c.Params.TeamId); err == nil {
		auditRec.AddMeta("team", oldTeam)
	}

	patchedTeam, err := c.App.PatchTeam(c.Params.TeamId, team)

	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeam(*c.App.Session(), patchedTeam)

	auditRec.Success()
	auditRec.AddMeta("patched", patchedTeam)
	c.LogAudit("")

	w.Write([]byte(patchedTeam.ToJson()))
}

func localDeleteTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("localDeleteTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if team, err := c.App.GetTeam(c.Params.TeamId); err == nil {
		auditRec.AddMeta("team", team)
	}

	var err *model.AppError
	if c.Params.Permanent && *c.App.Config().ServiceSettings.EnableAPITeamDeletion {
		err = c.App.PermanentDeleteTeamId(c.Params.TeamId)
	} else {
		err = c.App.SoftDeleteTeam(c.Params.TeamId)
	}

	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
