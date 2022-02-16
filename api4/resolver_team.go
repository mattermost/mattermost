// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"

	"github.com/mattermost/mattermost-server/v6/model"
)

func getGraphQLTeam(ctx context.Context, id string) (*model.Team, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	team, appErr := c.App.GetTeam(id)
	if appErr != nil {
		return nil, appErr
	}

	if (!team.AllowOpenInvite || team.Type != model.TeamOpen) &&
		!c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), team.Id, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return nil, c.Err
	}

	team = c.App.SanitizeTeam(*c.AppContext.Session(), team)
	return team, nil
}
