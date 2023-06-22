// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/services/store"

	mm_model "github.com/mattermost/mattermost/server/public/model"
)

var errTestStore = errors.New("plugin test store error")

type PluginTestStore struct {
	store.Store
	users     map[string]*model.User
	testTeam  *model.Team
	otherTeam *model.Team
	emptyTeam *model.Team
	baseTeam  *model.Team
}

func NewPluginTestStore(innerStore store.Store) *PluginTestStore {
	return &PluginTestStore{
		Store: innerStore,
		users: map[string]*model.User{
			"no-team-member": {
				ID:       "no-team-member",
				Username: "no-team-member",
				Email:    "no-team-member@sample.com",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			},
			"team-member": {
				ID:       "team-member",
				Username: "team-member",
				Email:    "team-member@sample.com",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			},
			"viewer": {
				ID:       "viewer",
				Username: "viewer",
				Email:    "viewer@sample.com",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			},
			"commenter": {
				ID:       "commenter",
				Username: "commenter",
				Email:    "commenter@sample.com",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			},
			"editor": {
				ID:       "editor",
				Username: "editor",
				Email:    "editor@sample.com",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			},
			"admin": {
				ID:       "admin",
				Username: "admin",
				Email:    "admin@sample.com",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			},
			"guest": {
				ID:       "guest",
				Username: "guest",
				Email:    "guest@sample.com",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
				IsGuest:  true,
			},
		},
		testTeam:  &model.Team{ID: "test-team", Title: "Test Team"},
		otherTeam: &model.Team{ID: "other-team", Title: "Other Team"},
		emptyTeam: &model.Team{ID: "empty-team", Title: "Empty Team"},
		baseTeam:  &model.Team{ID: "0", Title: "Base Team"},
	}
}

func (s *PluginTestStore) GetTeam(id string) (*model.Team, error) {
	switch id {
	case "0":
		return s.baseTeam, nil
	case "other-team":
		return s.otherTeam, nil
	case "test-team", testTeamID:
		return s.testTeam, nil
	case "empty-team":
		return s.emptyTeam, nil
	}
	return nil, errTestStore
}

func (s *PluginTestStore) GetTeamsForUser(userID string) ([]*model.Team, error) {
	switch userID {
	case "no-team-member":
		return []*model.Team{}, nil
	case "team-member":
		return []*model.Team{s.testTeam, s.otherTeam}, nil
	case "viewer":
		return []*model.Team{s.testTeam, s.otherTeam}, nil
	case "commenter":
		return []*model.Team{s.testTeam, s.otherTeam}, nil
	case "editor":
		return []*model.Team{s.testTeam, s.otherTeam}, nil
	case "admin":
		return []*model.Team{s.testTeam, s.otherTeam}, nil
	case "guest":
		return []*model.Team{s.testTeam}, nil
	}
	return nil, errTestStore
}

func (s *PluginTestStore) GetUserByID(userID string) (*model.User, error) {
	user := s.users[userID]
	if user == nil {
		return nil, errTestStore
	}
	return user, nil
}

func (s *PluginTestStore) GetUserByEmail(email string) (*model.User, error) {
	for _, user := range s.users {
		if user.Email == email {
			return user, nil
		}
	}
	return nil, errTestStore
}

func (s *PluginTestStore) GetUserByUsername(username string) (*model.User, error) {
	for _, user := range s.users {
		if user.Username == username {
			return user, nil
		}
	}
	return nil, errTestStore
}

func (s *PluginTestStore) GetUserPreferences(userID string) (mm_model.Preferences, error) {
	if userID == userTeamMember {
		return mm_model.Preferences{{
			UserId:   userTeamMember,
			Category: "focalboard",
			Name:     "test",
			Value:    "test",
		}}, nil
	}

	return nil, errTestStore
}

func (s *PluginTestStore) GetUsersByTeam(teamID string, asGuestID string, showEmail, showName bool) ([]*model.User, error) {
	if asGuestID == "guest" {
		return []*model.User{
			s.users["viewer"],
			s.users["commenter"],
			s.users["editor"],
			s.users["admin"],
			s.users["guest"],
		}, nil
	}

	switch {
	case teamID == s.testTeam.ID:
		return []*model.User{
			s.users["team-member"],
			s.users["viewer"],
			s.users["commenter"],
			s.users["editor"],
			s.users["admin"],
			s.users["guest"],
		}, nil
	case teamID == s.otherTeam.ID:
		return []*model.User{
			s.users["team-member"],
			s.users["viewer"],
			s.users["commenter"],
			s.users["editor"],
			s.users["admin"],
		}, nil
	case teamID == s.emptyTeam.ID:
		return []*model.User{}, nil
	}
	return nil, errTestStore
}

func (s *PluginTestStore) SearchUsersByTeam(teamID string, searchQuery string, asGuestID string, excludeBots bool, showEmail, showName bool) ([]*model.User, error) {
	users := []*model.User{}
	teamUsers, err := s.GetUsersByTeam(teamID, asGuestID, showEmail, showName)
	if err != nil {
		return nil, err
	}

	for _, user := range teamUsers {
		if excludeBots && user.IsBot {
			continue
		}
		if strings.Contains(user.Username, searchQuery) {
			users = append(users, user)
		}
	}
	return users, nil
}

func (s *PluginTestStore) CanSeeUser(seerID string, seenID string) (bool, error) {
	user, err := s.GetUserByID(seerID)
	if err != nil {
		return false, err
	}
	if !user.IsGuest {
		return true, nil
	}
	seerMembers, err := s.GetMembersForUser(seerID)
	if err != nil {
		return false, err
	}
	seenMembers, err := s.GetMembersForUser(seenID)
	if err != nil {
		return false, err
	}
	for _, seerMember := range seerMembers {
		for _, seenMember := range seenMembers {
			if seerMember.BoardID == seenMember.BoardID {
				return true, nil
			}
		}
	}
	return false, nil
}

func (s *PluginTestStore) SearchUserChannels(teamID, userID, query string) ([]*mm_model.Channel, error) {
	return []*mm_model.Channel{
		{
			TeamId:      teamID,
			Id:          "valid-channel-id",
			DisplayName: "Valid Channel",
			Name:        "valid-channel",
		},
		{
			TeamId:      teamID,
			Id:          "valid-channel-id-2",
			DisplayName: "Valid Channel 2",
			Name:        "valid-channel-2",
		},
	}, nil
}

func (s *PluginTestStore) GetChannel(teamID, channel string) (*mm_model.Channel, error) {
	if channel == "valid-channel-id" {
		return &mm_model.Channel{
			TeamId:      teamID,
			Id:          "valid-channel-id",
			DisplayName: "Valid Channel",
			Name:        "valid-channel",
		}, nil
	} else if channel == "valid-channel-id-2" {
		return &mm_model.Channel{
			TeamId:      teamID,
			Id:          "valid-channel-id-2",
			DisplayName: "Valid Channel 2",
			Name:        "valid-channel-2",
		}, nil
	}
	return nil, errTestStore
}

func (s *PluginTestStore) SearchBoardsForUser(term string, field model.BoardSearchField, userID string, includePublicBoards bool) ([]*model.Board, error) {
	boards, err := s.Store.SearchBoardsForUser(term, field, userID, includePublicBoards)
	if err != nil {
		return nil, err
	}

	teams, err := s.GetTeamsForUser(userID)
	if err != nil {
		return nil, err
	}

	resultBoards := []*model.Board{}
	for _, board := range boards {
		for _, team := range teams {
			if team.ID == board.TeamID {
				resultBoards = append(resultBoards, board)
				break
			}
		}
	}
	return resultBoards, nil
}

func (s *PluginTestStore) GetLicense() *mm_model.License {
	license := s.Store.GetLicense()

	if license == nil {
		license = &mm_model.License{
			Id:        mm_model.NewId(),
			StartsAt:  mm_model.GetMillis() - 2629746000, // 1 month
			ExpiresAt: mm_model.GetMillis() + 2629746000, //
			IssuedAt:  mm_model.GetMillis() - 2629746000,
			Features:  &mm_model.Features{},
		}
		license.Features.SetDefaults()
	}

	complianceLicense := os.Getenv("FOCALBOARD_UNIT_TESTING_COMPLIANCE")
	if complianceLicense != "" {
		if val, err := strconv.ParseBool(complianceLicense); err == nil {
			license.Features.Compliance = mm_model.NewBool(val)
		}
	}

	return license
}
