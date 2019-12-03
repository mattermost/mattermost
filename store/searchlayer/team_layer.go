// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	model "github.com/mattermost/mattermost-server/v5/model"
	store "github.com/mattermost/mattermost-server/v5/store"
)

type SearchTeamStore struct {
	store.TeamStore
	rootStore *SearchStore
}

func (s SearchTeamStore) UpdateMember(teamMember *model.TeamMember) (*model.TeamMember, *model.AppError) {
	member, err := s.TeamStore.UpdateMember(teamMember)
	if err == nil {
		s.rootStore.indexUserFromID(member.UserId)
	}
	return member, err
}
