// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

type TeamEnvironment struct {
	Users    []*model.User
	Channels []*model.Channel
}

type AutoTeamCreator struct {
	client        *model.Client4
	Fuzzy         bool
	NameLength    utils.Range
	NameCharset   string
	DomainLength  utils.Range
	DomainCharset string
	EmailLength   utils.Range
	EmailCharset  string
}

func NewAutoTeamCreator(client *model.Client4) *AutoTeamCreator {
	return &AutoTeamCreator{
		client:        client,
		Fuzzy:         false,
		NameLength:    TEAM_NAME_LEN,
		NameCharset:   utils.LOWERCASE,
		DomainLength:  TEAM_DOMAIN_NAME_LEN,
		DomainCharset: utils.LOWERCASE,
		EmailLength:   TEAM_EMAIL_LEN,
		EmailCharset:  utils.LOWERCASE,
	}
}

func (cfg *AutoTeamCreator) createRandomTeam() (*model.Team, bool) {
	var teamEmail string
	var teamDisplayName string
	var teamName string
	if cfg.Fuzzy {
		teamEmail = "success+" + model.NewId() + "simulator.amazonses.com"
		teamDisplayName = utils.FuzzName()
		teamName = utils.FuzzName()
	} else {
		teamEmail = "success+" + model.NewId() + "simulator.amazonses.com"
		teamDisplayName = utils.RandomName(cfg.NameLength, cfg.NameCharset)
		teamName = utils.RandomName(cfg.NameLength, cfg.NameCharset) + model.NewId()
	}
	team := &model.Team{
		DisplayName: teamDisplayName,
		Name:        teamName,
		Email:       teamEmail,
		Type:        model.TEAM_OPEN,
	}

	createdTeam, err := cfg.client.CreateTeam(team)
	if err != nil {
		return nil, false
	}
	return createdTeam, true
}

func (cfg *AutoTeamCreator) CreateTestTeams(num utils.Range) ([]*model.Team, bool) {
	numTeams := utils.RandIntFromRange(num)
	teams := make([]*model.Team, numTeams)

	for i := 0; i < numTeams; i++ {
		var err bool
		teams[i], err = cfg.createRandomTeam()
		if !err {
			return teams, false
		}
	}

	return teams, true
}
