// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	store "github.com/mattermost/mattermost/server/v8/channels/store"
)

type SearchTeamStore struct {
	store.TeamStore
	rootStore *SearchStore
}

func (s SearchTeamStore) SaveMember(rctx request.CTX, teamMember *model.TeamMember, maxUsersPerTeam int) (*model.TeamMember, error) {
	member, err := s.TeamStore.SaveMember(rctx, teamMember, maxUsersPerTeam)
	if err != nil {
		mlog.Error("failed to save member", mlog.String("user_id", teamMember.UserId), mlog.String("team_id", teamMember.TeamId))
		return member, err
	}
	mlog.Debug("saved member", mlog.String("user_id", member.UserId), mlog.String("team_id", member.TeamId))
	// Nothing to do if search engine is not active
	if s.rootStore.searchEngine.ActiveEngine() != "database" && s.rootStore.searchEngine.ActiveEngine() != "none" {
		mlog.Debug("indexing user from ID")
		s.rootStore.indexUserFromID(rctx, member.UserId)
		mlog.Debug("indexing channels for team")
		s.rootStore.indexChannelsForTeam(rctx, member.TeamId, member.UserId)
	}
	return member, err
}

func (s SearchTeamStore) UpdateMember(rctx request.CTX, teamMember *model.TeamMember) (*model.TeamMember, error) {
	member, err := s.TeamStore.UpdateMember(rctx, teamMember)
	if err == nil {
		s.rootStore.indexUserFromID(rctx, member.UserId)
	}
	return member, err
}

func (s SearchTeamStore) RemoveMember(rctx request.CTX, teamId string, userId string) error {
	err := s.TeamStore.RemoveMember(rctx, teamId, userId)
	if err == nil {
		// Nothing to do if search engine is not active
		if s.rootStore.searchEngine.ActiveEngine() != "database" && s.rootStore.searchEngine.ActiveEngine() != "none" {
			s.rootStore.indexUserFromID(rctx, userId)
			s.rootStore.indexChannelsForTeam(rctx, teamId, userId)
		}
	}
	return err
}

func (s SearchTeamStore) RemoveAllMembersByUser(rctx request.CTX, userId string) error {
	memberships, err := s.TeamStore.GetTeamsForUser(rctx, userId, "", true)
	if err != nil {
		return err
	}
	if s.rootStore.searchEngine.ActiveEngine() != "database" && s.rootStore.searchEngine.ActiveEngine() != "none" {
		for _, membership := range memberships {
			s.rootStore.indexChannelsForTeam(rctx, membership.TeamId, userId)
		}
	}
	err = s.TeamStore.RemoveAllMembersByUser(rctx, userId)
	if err == nil {
		if s.rootStore.searchEngine.ActiveEngine() != "database" && s.rootStore.searchEngine.ActiveEngine() != "none" {
			s.rootStore.indexUserFromID(rctx, userId)
		}
	}
	return err
}
