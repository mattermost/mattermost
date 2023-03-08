// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/pkg/errors"
)

// RunRootResolver hold all queries and mutations for a playbookRun
type RunRootResolver struct {
}

func (r *RunRootResolver) Run(ctx context.Context, args struct {
	ID string `url:"id,omitempty"`
}) (*RunResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunView(userID, args.ID); err != nil {
		return nil, err
	}

	run, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return nil, err
	}

	return &RunResolver{*run}, nil
}

func (r *RunRootResolver) Runs(ctx context.Context, args struct {
	TeamID                  string
	Sort                    string
	Direction               string
	Statuses                []string
	ParticipantOrFollowerID string
	ChannelID               string
	First                   *int32
	After                   *string
	Types                   []string
}) (*RunConnectionResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  args.TeamID,
		IsAdmin: app.IsSystemAdmin(userID, c.api),
	}

	if args.ParticipantOrFollowerID == client.Me {
		args.ParticipantOrFollowerID = userID
	}

	perPage := 10000 // If paging not specified, get "everything"
	if args.First != nil {
		perPage = int(*args.First)
	}

	page := 0
	if args.After != nil {
		page, err = decodeRunConnectionCursor(*args.After)
		if err != nil {
			return nil, err
		}
	}

	filterOptions := app.PlaybookRunFilterOptions{
		Sort:                    app.SortField(args.Sort),
		Direction:               app.SortDirection(args.Direction),
		TeamID:                  args.TeamID,
		Statuses:                args.Statuses,
		ParticipantOrFollowerID: args.ParticipantOrFollowerID,
		ChannelID:               args.ChannelID,
		IncludeFavorites:        true,
		Types:                   args.Types,
		Page:                    page,
		PerPage:                 perPage,
	}

	runResults, err := c.playbookRunService.GetPlaybookRuns(requesterInfo, filterOptions)
	if err != nil {
		return nil, err
	}

	return &RunConnectionResolver{results: *runResults, page: page}, nil
}

func (r *RunRootResolver) SetRunFavorite(ctx context.Context, args struct {
	ID  string
	Fav bool
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunView(userID, args.ID); err != nil {
		return "", err
	}

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return "", err
	}

	if args.Fav {
		if err := c.categoryService.AddFavorite(
			app.CategoryItem{
				ItemID: playbookRun.ID,
				Type:   app.RunItemType,
			},
			playbookRun.TeamID,
			userID,
		); err != nil {
			return "", err
		}
	} else {
		if err := c.categoryService.DeleteFavorite(
			app.CategoryItem{
				ItemID: playbookRun.ID,
				Type:   app.RunItemType,
			},
			playbookRun.TeamID,
			userID,
		); err != nil {
			return "", err
		}
	}

	return playbookRun.ID, nil
}

type RunUpdates struct {
	Name                                    *string
	Summary                                 *string
	ChannelID                               *string
	CreateChannelMemberOnNewParticipant     *bool
	RemoveChannelMemberOnRemovedParticipant *bool
	StatusUpdateBroadcastChannelsEnabled    *bool
	StatusUpdateBroadcastWebhooksEnabled    *bool
	BroadcastChannelIDs                     *[]string
	WebhookOnStatusUpdateURLs               *[]string
}

func (r *RunRootResolver) UpdateRun(ctx context.Context, args struct {
	ID      string
	Updates RunUpdates
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunManageProperties(userID, args.ID); err != nil {
		return "", err
	}

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return "", err
	}

	now := model.GetMillis()

	// scalar updates
	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Name", args.Updates.Name)
	addToSetmap(setmap, "Description", args.Updates.Summary)
	addToSetmap(setmap, "ChannelID", args.Updates.ChannelID)
	addToSetmap(setmap, "CreateChannelMemberOnNewParticipant", args.Updates.CreateChannelMemberOnNewParticipant)
	addToSetmap(setmap, "RemoveChannelMemberOnRemovedParticipant", args.Updates.RemoveChannelMemberOnRemovedParticipant)
	addToSetmap(setmap, "StatusUpdateBroadcastChannelsEnabled", args.Updates.StatusUpdateBroadcastChannelsEnabled)
	addToSetmap(setmap, "StatusUpdateBroadcastWebhooksEnabled", args.Updates.StatusUpdateBroadcastWebhooksEnabled)

	if args.Updates.Summary != nil {
		addToSetmap(setmap, "SummaryModifiedAt", &now)
	}

	if args.Updates.BroadcastChannelIDs != nil {
		if err := c.permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *args.Updates.BroadcastChannelIDs, playbookRun.BroadcastChannelIDs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedBroadcastChannelIDs", args.Updates.BroadcastChannelIDs)
	}

	if args.Updates.WebhookOnStatusUpdateURLs != nil {
		if err := app.ValidateWebhookURLs(*args.Updates.WebhookOnStatusUpdateURLs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnStatusUpdateURLs", args.Updates.WebhookOnStatusUpdateURLs)
	}

	if err := c.playbookRunService.GraphqlUpdate(args.ID, setmap); err != nil {
		return "", err
	}

	return playbookRun.ID, nil
}

func (r *RunRootResolver) AddRunParticipants(ctx context.Context, args struct {
	RunID             string
	UserIDs           []string
	ForceAddToChannel bool
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	// When user is joining run RunView permission is enough, otherwise user need manage permissions
	if updatesOnlyRequesterMembership(userID, args.UserIDs) {
		if err := c.permissions.RunView(userID, args.RunID); err != nil {
			return "", errors.Wrap(err, "attempted to join run without permissions")
		}
	} else {
		if err := c.permissions.RunManageProperties(userID, args.RunID); err != nil {
			return "", errors.Wrap(err, "attempted to modify participants without permissions")
		}
	}

	if err := c.playbookRunService.AddParticipants(args.RunID, args.UserIDs, userID, args.ForceAddToChannel); err != nil {
		return "", errors.Wrap(err, "failed to add participant from run")
	}

	return "", nil
}

func (r *RunRootResolver) RemoveRunParticipants(ctx context.Context, args struct {
	RunID   string
	UserIDs []string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	// When user is leaving run RunView permission is enough, otherwise user need manage permissions
	if updatesOnlyRequesterMembership(userID, args.UserIDs) {
		if err := c.permissions.RunView(userID, args.RunID); err != nil {
			return "", errors.Wrap(err, "attempted to modify participants without permissions")
		}
	} else {
		if err := c.permissions.RunManageProperties(userID, args.RunID); err != nil {
			return "", errors.Wrap(err, "attempted to modify participants without permissions")
		}
	}

	if err := c.playbookRunService.RemoveParticipants(args.RunID, args.UserIDs, userID); err != nil {
		return "", errors.Wrap(err, "failed to remove participant from run")
	}

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.Unfollow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
	}

	return "", nil
}

func updatesOnlyRequesterMembership(requesterUserID string, userIDs []string) bool {
	return len(userIDs) == 1 && userIDs[0] == requesterUserID
}

func (r *RunRootResolver) ChangeRunOwner(ctx context.Context, args struct {
	RunID   string
	OwnerID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	requesterID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunManageProperties(requesterID, args.RunID); err != nil {
		return "", errors.Wrap(err, "attempted to modify the run owner without permissions")
	}

	if err := c.playbookRunService.ChangeOwner(args.RunID, requesterID, args.OwnerID); err != nil {
		return "", errors.Wrap(err, "failed to change the run owner")
	}

	return "", nil
}

func (r *RunRootResolver) UpdateRunTaskActions(ctx context.Context, args struct {
	RunID        string
	ChecklistNum float64
	ItemNum      float64
	TaskActions  *[]app.TaskAction
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	if args.TaskActions == nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := validateTaskActions(*args.TaskActions); err != nil {
		return "", err
	}

	if err := c.playbookRunService.SetTaskActionsToChecklistItem(args.RunID, userID, int(args.ChecklistNum), int(args.ItemNum), *args.TaskActions); err != nil {
		return "", err
	}

	return "", nil
}
