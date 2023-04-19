// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"strings"

	"github.com/graph-gophers/dataloader/v6"

	"github.com/mattermost/mattermost-server/server/v8/model"
)

// teamMember is an internal graphQL wrapper struct to add resolver methods.
type teamMember struct {
	model.TeamMember
}

// match with api4.getTeam
func (tm *teamMember) Team(ctx context.Context) (*model.Team, error) {
	return getGraphQLTeam(ctx, tm.TeamId)
}

// match with api4.getUser
func (tm *teamMember) User(ctx context.Context) (*user, error) {
	return getGraphQLUser(ctx, tm.UserId)
}

// match with api4.getRolesByNames
func (tm *teamMember) Roles_(ctx context.Context) ([]*model.Role, error) {
	loader, err := getRolesLoader(ctx)
	if err != nil {
		return nil, err
	}

	thunk := loader.LoadMany(ctx, dataloader.NewKeysFromStrings(strings.Fields(tm.Roles)))
	results, errs := thunk()
	// All errors are the same. We just return the first one.
	if len(errs) > 0 && errs[0] != nil {
		return nil, err
	}

	roles := make([]*model.Role, len(results))
	for i, res := range results {
		roles[i] = res.(*model.Role)
	}

	return roles, nil
}
