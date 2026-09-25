// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package loadtest

import (
	"context"
	"fmt"

	ltcontrol "github.com/mattermost/mattermost-load-test-ng/loadtest/control"
	ltuser "github.com/mattermost/mattermost-load-test-ng/loadtest/user"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

// OpenRHS opens the Playbooks RHS, getting the channel's runs to show either
// the whole list or a single one.
func (c *SimulController) OpenRHS(u ltuser.User, pbClient *client.Client) ltcontrol.UserActionResponse {
	ctx := context.Background()

	// Retrieve current channel
	currentChannel, err := u.Store().CurrentChannel()
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	channelID := currentChannel.Id
	teamID := currentChannel.TeamId

	// 1. Get in progress runs and store them
	runsInProgress, err := gqlRHSRuns(pbClient, channelID, client.SortByCreateAt, client.SortDesc, client.StatusInProgress, 8, "")
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	err = c.store.SetRuns(runsInProgress)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 2. Get finished runs and store them
	runsFinished, err := gqlRHSRuns(pbClient, channelID, client.SortByCreateAt, client.SortDesc, client.StatusFinished, 8, "")
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	err = c.store.SetRuns(runsFinished)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 3. Retrieve the list of playbooks in the team and store them
	playbooks, err := pbClient.Playbooks.List(ctx, teamID, 0, 10, client.PlaybookListOptions{
		Sort:         client.SortByTitle,
		Direction:    client.SortAsc,
		SearchTeam:   "",
		WithArchived: false,
	})
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	err = c.store.SetPlaybooks(playbooks.Items)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// We only continue if there is exactly one in progress run, which the RHS
	// list directly shows. In any other case, we return early
	if runsInProgress.TotalCount != 1 {
		msg := fmt.Sprintf("RHS open with %d in-progress and %d finished runs", runsInProgress.TotalCount, runsFinished.TotalCount)
		return ltcontrol.UserActionResponse{Info: msg}
	}
	graphqlRun := runsInProgress.Edges[0].Node

	// 4. Retrieve the details of the run
	currentRun, err := pbClient.PlaybookRuns.Get(ctx, graphqlRun.Id)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 5. Retrieve the run's metadata
	// https://hub.mattermost.com/plugins/playbooks/api/v0/runs/fuhegiurtbb75fnfajaka98uuo/metadata
	_, err = pbClient.PlaybookRuns.GetMetadata(ctx, currentRun.ID)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 6. If the run is attached to a playbook, retrieve the whole playbook
	if currentRun.PlaybookID != "" {
		_, err = pbClient.Playbooks.Get(ctx, currentRun.PlaybookID)
		if err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}
	}

	// 7. Check whether the current run is marked as favourite
	_, err = pbClient.Categories.IsFavorite(ctx, client.CategoriesIsFavoriteOptions{
		TeamId:   teamID,
		ItemId:   currentRun.ID,
		ItemType: "r",
	})
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 8. Retrieve, again, the run's metadata.
	// TODO: This mimics the current behaviour of the playbook, but this looks
	// like a frontend bug to me
	_, err = pbClient.PlaybookRuns.GetMetadata(ctx, currentRun.ID)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	msg := fmt.Sprintf("RHS open with in-progress run %q", currentRun.Name)
	return ltcontrol.UserActionResponse{Info: msg}
}
