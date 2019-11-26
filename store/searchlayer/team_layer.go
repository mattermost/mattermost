// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package searchlayer

import (
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SearchTeamStore struct {
	store.TeamStore
	rootStore *SearchStore
}

func (s SearchTeamStore) UpdateMember(teamMember *model.TeamMember) (*model.TeamMember, *model.AppError) {
	member, err := s.TeamStore.UpdateMember(teamMember)
	if s.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() && err == nil {
		go (func() {
			user, err := s.rootStore.User().Get(teamMember.UserId)
			if err != nil {
				mlog.Error("Encountered error indexing user", mlog.String("user_id", teamMember.UserId), mlog.Err(err))
				return
			}
			s.rootStore.indexUser(user)
		})()
	}
	return member, err
}
