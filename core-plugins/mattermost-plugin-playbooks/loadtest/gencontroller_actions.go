// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package loadtest

import (
	"context"
	"errors"
	"fmt"
	"math/rand"

	ltcontrol "github.com/mattermost/mattermost-load-test-ng/loadtest/control"
	ltstore "github.com/mattermost/mattermost-load-test-ng/loadtest/store"
	ltuser "github.com/mattermost/mattermost-load-test-ng/loadtest/user"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
)

func randBool(freqTrue float64) bool {
	return rand.Float64() < freqTrue
}

func randChecklistItem() client.ChecklistItem {
	return client.ChecklistItem{
		Title:       ltcontrol.GenerateRandomSentences(1 + rand.Intn(15)),
		Description: ltcontrol.GenerateRandomSentences(1 + rand.Intn(50)),
	}
}

func randChecklist() client.Checklist {
	numItems := 1 + rand.Intn(10)
	items := make([]client.ChecklistItem, 0, numItems)
	for range numItems {
		items = append(items, randChecklistItem())
	}

	return client.Checklist{
		Title: ltcontrol.GenerateRandomSentences(1 + rand.Intn(5)),
		Items: items,
	}
}

func (c *GenController) CreatePlaybook(u ltuser.User, pbClient *client.Client) (res ltcontrol.UserActionResponse) {
	if !globalState.inc(StateTargetPlaybooks, TargetPlaybooks) {
		return ltcontrol.UserActionResponse{Info: "target number of playbooks reached"}
	}
	defer func() {
		if res.Err != nil || res.Warn != "" {
			globalState.dec(StateTargetPlaybooks)
		}
	}()

	ctx := context.Background()

	// Get a random team the user is a member of
	team, err := u.Store().RandomTeam(ltstore.SelectMemberOf)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// TODO: These numbers assume there are at least 10k users in each team,
	// which happens in the 100M posts DB dump, but they should come from a
	// config file
	page := rand.Intn(100)
	perPage := 100
	teamMembers, _, err := u.Client().GetTeamMembers(context.Background(), team.Id, page, perPage, "")
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	if len(teamMembers) == 0 {
		return ltcontrol.UserActionResponse{Err: errors.New("unable to retrieve any team members")}
	}

	// Get between 1 and 10 random team members
	numMembers := 1 + rand.Intn(10)
	addedMembers := map[string]struct{}{}
	members := make([]client.PlaybookMember, 0, numMembers)
	for range numMembers {
		teamMember := teamMembers[rand.Intn(len(teamMembers))]

		// Make sure not to add the same user more than once
		if _, ok := addedMembers[teamMember.UserId]; ok {
			continue
		}
		addedMembers[teamMember.UserId] = struct{}{}

		members = append(members, client.PlaybookMember{
			UserID:      teamMember.UserId,
			Roles:       []string{app.PlaybookRoleMember},
			SchemeRoles: []string{},
		})
	}

	// Get the owner
	owner, err := u.Store().RandomTeamMember(team.Id)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	numChecklists := 1 + rand.Intn(5)
	checklists := make([]client.Checklist, 0, numChecklists)
	for range numChecklists {
		checklists = append(checklists, randChecklist())
	}

	id, err := pbClient.Playbooks.Create(ctx, client.PlaybookCreateOptions{
		Title:                                   ltcontrol.GenerateRandomSentences(1 + rand.Intn(5)),
		Description:                             ltcontrol.GenerateRandomSentences(1 + rand.Intn(50)),
		TeamID:                                  team.Id,
		Public:                                  randBool(0.5),
		CreatePublicPlaybookRun:                 randBool(0.5),
		Checklists:                              checklists,
		Members:                                 members,
		InviteUsersEnabled:                      false,
		DefaultOwnerID:                          owner.UserId,
		DefaultOwnerEnabled:                     randBool(0.5),
		CreateChannelMemberOnNewParticipant:     randBool(0.5),
		RemoveChannelMemberOnRemovedParticipant: randBool(0.5),
	})
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	pb, err := pbClient.Playbooks.Get(ctx, id)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	if err := c.store.SetPlaybook(*pb); err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	msg := fmt.Sprintf("created playbook %q with %d members on team %q", id, len(members), team.DisplayName)
	return ltcontrol.UserActionResponse{Info: msg}
}

func (c *GenController) CreateRun(u ltuser.User, pbClient *client.Client) (res ltcontrol.UserActionResponse) {
	if !globalState.inc(StateTargetRuns, TargetRuns) {
		return ltcontrol.UserActionResponse{Info: "target number of runs reached"}
	}
	defer func() {
		if res.Err != nil || res.Warn != "" {
			globalState.dec(StateTargetRuns)
		}
	}()

	ctx := context.Background()

	// Get a random team the user is a member of
	team, err := u.Store().RandomTeam(ltstore.SelectMemberOf)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	playbook, err := c.store.RandomPlaybook(team.Id)
	if err != nil {
		// Try to populate the list of playbooks in the store
		pbRes, err := pbClient.Playbooks.List(ctx, team.Id, 0, 100, client.PlaybookListOptions{})
		if err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}

		if len(pbRes.Items) == 0 {
			return ltcontrol.UserActionResponse{Err: errors.New("unable to retrieve any playbook")}
		}

		if err := c.store.SetPlaybooks(pbRes.Items); err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}

		if err := c.store.SetPlaybooks(pbRes.Items); err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}

		playbook, err = c.store.RandomPlaybook(team.Id)
		if err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}
	}

	channelID := ""
	// A third of the runs will be created in existing channels
	if randBool(0.3) {
		// Select a random public channel
		channel, err := u.Store().RandomChannel(team.Id, ltstore.SelectNotDirect|ltstore.SelectNotGroup|ltstore.SelectNotPrivate)
		if err != nil {
			// If it fails, try to populate the store with channels, and pick one randomly
			channels, err := u.GetChannelsForTeamForUser(team.Id, u.Store().Id(), false)
			if err != nil {
				return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
			}

			if len(channels) == 0 {
				return ltcontrol.UserActionResponse{Err: errors.New("unable to retrieve any channel")}
			}

			channel = *channels[rand.Intn(len(channels))]
		}
		channelID = channel.Id
	}

	run, err := pbClient.PlaybookRuns.Create(ctx, client.PlaybookRunCreateOptions{
		Name:            ltcontrol.GenerateRandomSentences(1 + rand.Intn(5)),
		OwnerUserID:     u.Store().Id(),
		TeamID:          team.Id,
		ChannelID:       channelID,
		Summary:         ltcontrol.GenerateRandomSentences(1 + rand.Intn(50)),
		PlaybookID:      playbook.ID,
		CreatePublicRun: model.NewPointer(true),
		Type:            "playbook",
	})
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	msg := fmt.Sprintf("created run %q from playbook %q on team %q", run.ID, playbook.ID, team.DisplayName)
	return ltcontrol.UserActionResponse{Info: msg}
}
