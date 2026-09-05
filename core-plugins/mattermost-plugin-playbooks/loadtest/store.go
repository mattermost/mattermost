// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package loadtest

import (
	"fmt"
	"math/rand"
	"sync"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/graphql"
)

// PluginStore implements the Store interface as an in-memory store for the [PluginController]
// plugin implementation.
type PluginStore struct {
	// This is a global lock for all shared resources in the store
	lock sync.RWMutex

	// The global settings retrieved at login
	settings *client.GlobalSettings

	// runsOnTeamQueryMap stores a single run per channel in a map with the
	// following shape: TeamID > ChannelID > Run
	// This is not how the current model works, but we still need to use it as a
	// result of the RunsOnTeamQuery GraphQL query.
	// See https://mattermost.atlassian.net/browse/MM-65733
	runsOnTeamQueryMap map[string]map[string]graphql.RunEdge

	// runsByTeamByChannel stores all runs per channel in a map with the
	// following shape: TeamId > ChannelId > []Run
	runsByTeamByChannel map[string]map[string][]graphql.RunEdge

	// playbooksByTeam stores all playbooks per team in a map with the following
	// shape: TeamId > []Playbook
	playbooksByTeam map[string][]client.Playbook

	// actionsByChannel stores all actions per channel in a map with the
	// following shape: ChannelId > []Action
	actionsByChannel map[string][]client.GenericChannelAction
}

// Clear resets the store, clearing all stored data and initializing all the maps
func (s *PluginStore) Clear() {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.settings = &client.GlobalSettings{}

	clear(s.runsOnTeamQueryMap)
	s.runsOnTeamQueryMap = map[string]map[string]graphql.RunEdge{}

	clear(s.runsByTeamByChannel)
	s.runsByTeamByChannel = map[string]map[string][]graphql.RunEdge{}

	clear(s.playbooksByTeam)
	s.playbooksByTeam = map[string][]client.Playbook{}

	clear(s.actionsByChannel)
	s.actionsByChannel = map[string][]client.GenericChannelAction{}
}

func (s *PluginStore) SetSettings(settings *client.GlobalSettings) {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.settings = settings
}

// SetRunsOnTeam stores the provided runs (encoded as GraphQL RunEdge structs)
// returned by the RunsOnTeamQuery GraphQL query.
// See [runsOnTeamQueryMap] for more information.
func (s *PluginStore) SetRunsOnTeam(runs []graphql.RunEdge) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	if len(runs) == 0 {
		return nil
	}

	// All runs are in the same team, so get the inner map of such team
	teamID := runs[0].Node.TeamID
	if teamID == "" {
		return fmt.Errorf("unable to set runs on team: team ID is empty")
	}
	if s.runsOnTeamQueryMap[teamID] == nil {
		s.runsOnTeamQueryMap[teamID] = map[string]graphql.RunEdge{}
	}
	runsInTeam := s.runsOnTeamQueryMap[teamID]

	// Assign each run to its channel inside the team map
	for _, r := range runs {
		runsInTeam[r.Node.ChannelID] = r
	}

	return nil
}

// SetRuns stores the provided runs (encoded as GraphQL RunConnection structs)
// returned by the RHSRuns GraphQL query.
func (s *PluginStore) SetRuns(connections graphql.RunConnection) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	if connections.TotalCount == 0 {
		return nil
	}

	runs := connections.Edges
	teamID := runs[0].Node.TeamID
	channelID := runs[0].Node.ChannelID

	if teamID == "" || channelID == "" {
		return fmt.Errorf("unable to set runs: team ID or channel ID is empty")
	}

	if s.runsByTeamByChannel[teamID] == nil {
		s.runsByTeamByChannel[teamID] = map[string][]graphql.RunEdge{}
	}

	if s.runsByTeamByChannel[teamID][channelID] == nil {
		s.runsByTeamByChannel[teamID][channelID] = []graphql.RunEdge{}
	}

	s.runsByTeamByChannel[teamID][channelID] = append(s.runsByTeamByChannel[teamID][channelID], runs...)

	return nil
}

// SetPlaybooks stores the provided playbooks, returned by e.g. the
// [client.PlaybookService] methods.
func (s *PluginStore) SetPlaybooks(playbooks []client.Playbook) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	if len(playbooks) == 0 {
		return nil
	}

	teamID := playbooks[0].TeamID
	if teamID == "" {
		return fmt.Errorf("unable to set playbooks: team ID is empty")
	}

	if s.playbooksByTeam[teamID] == nil {
		s.playbooksByTeam[teamID] = []client.Playbook{}
	}

	s.playbooksByTeam[teamID] = append(s.playbooksByTeam[teamID], playbooks...)

	return nil
}

// SetPlaybook stores the provided playbook, returned by e.g. the
// [client.PlaybookService] methods.
func (s *PluginStore) SetPlaybook(playbook client.Playbook) error {
	return s.SetPlaybooks([]client.Playbook{playbook})
}

func (s *PluginStore) GetPlaybooks(teamID string) []client.Playbook {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.playbooksByTeam[teamID]
}

func (s *PluginStore) RandomPlaybook(teamID string) (client.Playbook, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	pbs := s.playbooksByTeam[teamID]
	if len(pbs) == 0 {
		return client.Playbook{}, fmt.Errorf("no playbooks in team %q", teamID)
	}

	return pbs[rand.Intn(len(pbs))], nil
}

// SetActions stores the provided actions mapped to the provided channel, as returned by the
// [client.ActionsService] methods.
func (s *PluginStore) SetActions(channelID string, actions []client.GenericChannelAction) error {
	if channelID == "" {
		return fmt.Errorf("unable to set actions: channel ID is empty")
	}

	if _, ok := s.actionsByChannel[channelID]; !ok {
		actions = []client.GenericChannelAction{}
	}
	s.actionsByChannel[channelID] = append(s.actionsByChannel[channelID], actions...)

	return nil
}
