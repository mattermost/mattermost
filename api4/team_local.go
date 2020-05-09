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
	api.BaseRoutes.Team.Handle("", api.ApiLocal(getTeam)).Methods("GET")
	api.BaseRoutes.TeamByName.Handle("", api.ApiLocal(getTeamByName)).Methods("GET")
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

	auditRec.Success()
	auditRec.AddMeta("team", team) // overwrite meta

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(rteam.ToJson()))
}
