package api

import (
	"context"

	"github.com/graph-gophers/dataloader/v7"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
)

type playbookInfo struct {
	UserID string
	TeamID string
	ID     string
}

func graphQLPlaybooksLoader[V *app.Playbook](ctx context.Context, keys []playbookInfo) []*dataloader.Result[V] {
	result := make([]*dataloader.Result[V], len(keys))

	if len(keys) == 0 {
		return result
	}

	uniquePlaybookIDs := getUniquePlaybookIDs(keys)

	var teamID, userID string = keys[0].TeamID, keys[0].UserID

	c, err := getContext(ctx)
	if err != nil {
		return populateResultWithError(err, result)
	}

	playbookResult, err := c.playbookService.GetPlaybooksForTeam(
		app.RequesterInfo{
			UserID: userID,
			TeamID: teamID,
		},
		teamID,
		app.PlaybookFilterOptions{
			PlaybookIDs: uniquePlaybookIDs,
			PerPage:     loaderBatchCapacity,
		},
	)
	if err != nil {
		return populateResultWithError(err, result)
	}
	playbooksByID := make(map[string]*app.Playbook)
	for i := range playbookResult.Items {
		playbooksByID[playbookResult.Items[i].ID] = &playbookResult.Items[i]
	}

	for i, playbookInfo := range keys {
		playbook, ok := playbooksByID[playbookInfo.ID]
		if !ok {
			result[i] = &dataloader.Result[V]{Data: nil}
			continue
		}
		result[i] = &dataloader.Result[V]{
			Data: V(playbook),
		}
	}
	return result
}

func getUniquePlaybookIDs(playbooks []playbookInfo) []string {
	playbookByID := make(map[string]bool)

	for _, playbook := range playbooks {
		playbookByID[playbook.ID] = true
	}

	result := make([]string, 0, len(playbookByID))
	for playbookID := range playbookByID {
		result = append(result, playbookID)
	}
	return result
}
