// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
)

// sessionScopeChannelIDsQuery selects the IDs of the channels in a session
// scope's resources. It is the SQL form of model.SessionScopeAllowsChannel and
// model.Team.IsOpenToAllUsers and must stay in step with them. The caller has
// already dropped OpenTeamPublicChannels when the server turns the open-team
// grant off.
func sessionScopeChannelIDsQuery(builder sq.StatementBuilderType, resources *model.SessionScopeResources) sq.SelectBuilder {
	query := builder.Select("Channels.Id").
		From("Channels").
		Where(sq.Eq{"Channels.DeleteAt": 0}).
		Where(sq.NotEq{"Channels.Type": []model.ChannelType{model.ChannelTypeDirect, model.ChannelTypeGroup}}).
		Where(sq.Expr("NOT EXISTS (SELECT 1 FROM AccessControlPolicies acp WHERE acp.ID = Channels.Id AND acp.Type = ?)", model.AccessControlPolicyTypeChannel))

	inScope := sq.Or{}
	if resources != nil && len(resources.ChannelIDs) > 0 {
		inScope = append(inScope, sq.Eq{"Channels.Id": resources.ChannelIDs})
	}
	if resources != nil && resources.OpenTeamPublicChannels {
		inScope = append(inScope, sq.And{
			sq.Eq{"Channels.Type": model.ChannelTypeOpen},
			sq.Expr(`Channels.TeamId IN (
				SELECT ot.Id FROM Teams ot
				WHERE ot.AllowOpenInvite = true
				AND ot.DeleteAt = 0
				AND COALESCE(ot.GroupConstrained, false) = false
				AND COALESCE(ot.AllowedDomains, '') = ''
				AND NOT EXISTS (SELECT 1 FROM AccessControlPolicies tacp WHERE tacp.ID = ot.Id AND tacp.Type = ?)
			)`, model.AccessControlPolicyTypeTeam),
		})
	}
	if len(inScope) == 0 {
		return query.Where(sq.Expr("1 = 0"))
	}

	return query.Where(inScope)
}
