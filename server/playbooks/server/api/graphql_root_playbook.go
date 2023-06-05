// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"encoding/json"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"
	"github.com/pkg/errors"
	"gopkg.in/guregu/null.v4"
)

// RunMutationCollection hold all mutation functions for a playbookRun
type PlaybookRootResolver struct {
}

func getGraphqlPlaybook(ctx context.Context, playbookID string) (*PlaybookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err = c.permissions.PlaybookView(userID, playbookID); err != nil {
		return nil, err
	}

	playbook, err := c.playbookService.Get(playbookID)
	if err != nil {
		return nil, err
	}

	return &PlaybookResolver{playbook}, nil
}

func (r *PlaybookRootResolver) Playbook(ctx context.Context, args struct {
	ID string
}) (*PlaybookResolver, error) {
	playbookID := args.ID
	return getGraphqlPlaybook(ctx, playbookID)
}

func (r *PlaybookRootResolver) Playbooks(ctx context.Context, args struct {
	TeamID             string
	Sort               string
	Direction          string
	SearchTerm         string
	WithMembershipOnly bool
	WithArchived       bool
}) ([]*PlaybookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if args.TeamID != "" {
		if err = c.permissions.PlaybookList(userID, args.TeamID); err != nil {
			return nil, err
		}
	}

	isGuest, err := app.IsGuest(userID, c.api)
	if err != nil {
		return nil, err
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  args.TeamID,
		IsAdmin: app.IsSystemAdmin(userID, c.api),
	}

	opts := app.PlaybookFilterOptions{
		Sort:               app.SortField(args.Sort),
		Direction:          app.SortDirection(args.Direction),
		SearchTerm:         args.SearchTerm,
		WithArchived:       args.WithArchived,
		WithMembershipOnly: isGuest || args.WithMembershipOnly, // Guests can only see playbooks if they are invited to them
		Page:               0,
		PerPage:            10000,
	}

	playbookResults, err := c.playbookService.GetPlaybooksForTeam(requesterInfo, args.TeamID, opts)
	if err != nil {
		return nil, err
	}

	ret := make([]*PlaybookResolver, 0, len(playbookResults.Items))
	for _, pb := range playbookResults.Items {
		ret = append(ret, &PlaybookResolver{pb})
	}

	return ret, nil
}

func (r *RunRootResolver) UpdatePlaybookFavorite(ctx context.Context, args struct {
	ID       string
	Favorite bool
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	if err = c.permissions.PlaybookView(userID, args.ID); err != nil {
		return "", err
	}

	currentPlaybook, err := c.playbookService.Get(args.ID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if args.Favorite {
		if err := c.categoryService.AddFavorite(
			app.CategoryItem{
				ItemID: currentPlaybook.ID,
				Type:   app.PlaybookItemType,
			},
			currentPlaybook.TeamID,
			userID,
		); err != nil {
			return "", err
		}
	} else {
		if err := c.categoryService.DeleteFavorite(
			app.CategoryItem{
				ItemID: currentPlaybook.ID,
				Type:   app.PlaybookItemType,
			},
			currentPlaybook.TeamID,
			userID,
		); err != nil {
			return "", err
		}
	}

	return currentPlaybook.ID, nil
}

func (r *PlaybookRootResolver) UpdatePlaybook(ctx context.Context, args struct {
	ID      string
	Updates struct {
		Title                                   *string
		Description                             *string
		Public                                  *bool
		CreatePublicPlaybookRun                 *bool
		ReminderMessageTemplate                 *string
		ReminderTimerDefaultSeconds             *float64
		StatusUpdateEnabled                     *bool
		InvitedUserIDs                          *[]string
		InvitedGroupIDs                         *[]string
		InviteUsersEnabled                      *bool
		DefaultOwnerID                          *string
		DefaultOwnerEnabled                     *bool
		BroadcastChannelIDs                     *[]string
		BroadcastEnabled                        *bool
		WebhookOnCreationURLs                   *[]string
		WebhookOnCreationEnabled                *bool
		MessageOnJoin                           *string
		MessageOnJoinEnabled                    *bool
		RetrospectiveReminderIntervalSeconds    *float64
		RetrospectiveTemplate                   *string
		RetrospectiveEnabled                    *bool
		WebhookOnStatusUpdateURLs               *[]string
		WebhookOnStatusUpdateEnabled            *bool
		SignalAnyKeywords                       *[]string
		SignalAnyKeywordsEnabled                *bool
		CategorizeChannelEnabled                *bool
		CategoryName                            *string
		RunSummaryTemplateEnabled               *bool
		RunSummaryTemplate                      *string
		ChannelNameTemplate                     *string
		Checklists                              *[]UpdateChecklist
		CreateChannelMemberOnNewParticipant     *bool
		RemoveChannelMemberOnRemovedParticipant *bool
		ChannelID                               *string
		ChannelMode                             *string
	}
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.ID)
	if err != nil {
		return "", err
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Title", args.Updates.Title)
	addToSetmap(setmap, "Description", args.Updates.Description)
	if args.Updates.Public != nil {
		if *args.Updates.Public {
			if err := c.permissions.PlaybookMakePublic(userID, currentPlaybook); err != nil {
				return "", err
			}
		} else {
			if err := c.permissions.PlaybookMakePrivate(userID, currentPlaybook); err != nil {
				return "", err
			}
		}
		if !c.licenceChecker.PlaybookAllowed(*args.Updates.Public) {
			return "", errors.Wrapf(app.ErrLicensedFeature, "the playbook is not valid with the current license")
		}
		addToSetmap(setmap, "Public", args.Updates.Public)
	}
	addToSetmap(setmap, "CreatePublicIncident", args.Updates.CreatePublicPlaybookRun)
	addToSetmap(setmap, "ReminderMessageTemplate", args.Updates.ReminderMessageTemplate)
	addToSetmap(setmap, "ReminderTimerDefaultSeconds", args.Updates.ReminderTimerDefaultSeconds)
	addToSetmap(setmap, "StatusUpdateEnabled", args.Updates.StatusUpdateEnabled)
	addToSetmap(setmap, "CreateChannelMemberOnNewParticipant", args.Updates.CreateChannelMemberOnNewParticipant)
	addToSetmap(setmap, "RemoveChannelMemberOnRemovedParticipant", args.Updates.RemoveChannelMemberOnRemovedParticipant)

	if args.Updates.InvitedUserIDs != nil {
		filteredInvitedUserIDs := c.permissions.FilterInvitedUserIDs(*args.Updates.InvitedUserIDs, currentPlaybook.TeamID)
		addConcatToSetmap(setmap, "ConcatenatedInvitedUserIDs", &filteredInvitedUserIDs)
	}

	if args.Updates.InvitedGroupIDs != nil {
		filteredInvitedGroupIDs := c.permissions.FilterInvitedGroupIDs(*args.Updates.InvitedGroupIDs)
		addConcatToSetmap(setmap, "ConcatenatedInvitedGroupIDs", &filteredInvitedGroupIDs)
	}

	addToSetmap(setmap, "InviteUsersEnabled", args.Updates.InviteUsersEnabled)
	if args.Updates.DefaultOwnerID != nil {
		if !c.api.HasPermissionToTeam(*args.Updates.DefaultOwnerID, currentPlaybook.TeamID, model.PermissionViewTeam) {
			return "", errors.Wrap(app.ErrNoPermissions, "default owner can't view team")
		}
		addToSetmap(setmap, "DefaultCommanderID", args.Updates.DefaultOwnerID)
	}
	addToSetmap(setmap, "DefaultCommanderEnabled", args.Updates.DefaultOwnerEnabled)

	if args.Updates.BroadcastChannelIDs != nil {
		if err := c.permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *args.Updates.BroadcastChannelIDs, currentPlaybook.BroadcastChannelIDs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedBroadcastChannelIDs", args.Updates.BroadcastChannelIDs)
	}

	addToSetmap(setmap, "BroadcastEnabled", args.Updates.BroadcastEnabled)
	if args.Updates.WebhookOnCreationURLs != nil {
		if err := app.ValidateWebhookURLs(*args.Updates.WebhookOnCreationURLs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnCreationURLs", args.Updates.WebhookOnCreationURLs)
	}
	addToSetmap(setmap, "WebhookOnCreationEnabled", args.Updates.WebhookOnCreationEnabled)
	addToSetmap(setmap, "MessageOnJoin", args.Updates.MessageOnJoin)
	addToSetmap(setmap, "MessageOnJoinEnabled", args.Updates.MessageOnJoinEnabled)
	addToSetmap(setmap, "RetrospectiveReminderIntervalSeconds", args.Updates.RetrospectiveReminderIntervalSeconds)
	addToSetmap(setmap, "RetrospectiveTemplate", args.Updates.RetrospectiveTemplate)
	addToSetmap(setmap, "RetrospectiveEnabled", args.Updates.RetrospectiveEnabled)
	if args.Updates.WebhookOnStatusUpdateURLs != nil {
		if err := app.ValidateWebhookURLs(*args.Updates.WebhookOnStatusUpdateURLs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnStatusUpdateURLs", args.Updates.WebhookOnStatusUpdateURLs)
	}
	addToSetmap(setmap, "WebhookOnStatusUpdateEnabled", args.Updates.WebhookOnStatusUpdateEnabled)
	if args.Updates.SignalAnyKeywords != nil {
		validSignalAnyKeywords := app.ProcessSignalAnyKeywords(*args.Updates.SignalAnyKeywords)
		addConcatToSetmap(setmap, "ConcatenatedSignalAnyKeywords", &validSignalAnyKeywords)
	}
	addToSetmap(setmap, "SignalAnyKeywordsEnabled", args.Updates.SignalAnyKeywordsEnabled)
	addToSetmap(setmap, "CategorizeChannelEnabled", args.Updates.CategorizeChannelEnabled)
	if args.Updates.CategoryName != nil {
		if err := app.ValidateCategoryName(*args.Updates.CategoryName); err != nil {
			return "", err
		}
		addToSetmap(setmap, "CategoryName", args.Updates.CategoryName)
	}
	addToSetmap(setmap, "RunSummaryTemplateEnabled", args.Updates.RunSummaryTemplateEnabled)
	addToSetmap(setmap, "RunSummaryTemplate", args.Updates.RunSummaryTemplate)
	addToSetmap(setmap, "ChannelNameTemplate", args.Updates.ChannelNameTemplate)
	addToSetmap(setmap, "ChannelID", args.Updates.ChannelID)
	addToSetmap(setmap, "ChannelMode", args.Updates.ChannelMode)

	// Not optimal graphql. Stopgap measure. Should be updated separately.
	if args.Updates.Checklists != nil {
		app.CleanUpChecklists(*args.Updates.Checklists)
		if err := validateUpdateTaskActions(*args.Updates.Checklists); err != nil {
			return "", errors.Wrapf(err, "failed to validate task actions in graphql json for playbook id: '%s'", args.ID)
		}
		checklistsJSON, err := json.Marshal(args.Updates.Checklists)
		if err != nil {
			return "", errors.Wrapf(err, "failed to marshal checklist in graphql json for playbook id: '%s'", args.ID)
		}
		setmap["ChecklistsJSON"] = checklistsJSON
	}

	if args.Updates.Checklists != nil || args.Updates.InvitedUserIDs != nil || args.Updates.InviteUsersEnabled != nil {
		if err := validatePreAssignmentUpdate(currentPlaybook, args.Updates.Checklists, args.Updates.InvitedUserIDs, args.Updates.InviteUsersEnabled); err != nil {
			return "", errors.Wrapf(err, "invalid user pre-assignment for playbook id: '%s'", args.ID)
		}
	}

	if len(setmap) > 0 {
		if err := c.playbookStore.GraphqlUpdate(args.ID, setmap); err != nil {
			return "", err
		}
	}

	return args.ID, nil
}

func (r *PlaybookRootResolver) AddPlaybookMember(ctx context.Context, args struct {
	PlaybookID string
	UserID     string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if err := c.permissions.PlaybookManageMembers(userID, currentPlaybook); err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if err := c.playbookStore.AddPlaybookMember(args.PlaybookID, args.UserID); err != nil {
		return "", errors.Wrap(err, "unable to add playbook member")
	}

	return "", nil
}

func (r *PlaybookRootResolver) RemovePlaybookMember(ctx context.Context, args struct {
	PlaybookID string
	UserID     string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	// do not require manageMembers permission if the user want to leave playbook
	if userID != args.UserID {
		if err := c.permissions.PlaybookManageMembers(userID, currentPlaybook); err != nil {
			return "", err
		}
	}

	if err := c.playbookStore.RemovePlaybookMember(args.PlaybookID, args.UserID); err != nil {
		return "", errors.Wrap(err, "unable to remove playbook member")
	}

	return "", nil
}

func (r *PlaybookRootResolver) AddMetric(ctx context.Context, args struct {
	PlaybookID  string
	Title       string
	Description string
	Type        string
	Target      *float64
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	var target null.Int
	if args.Target == nil {
		target = null.NewInt(0, false)
	} else {
		target = null.IntFrom(int64(*args.Target))
	}

	if err := c.playbookStore.AddMetric(args.PlaybookID, app.PlaybookMetricConfig{
		Title:       args.Title,
		Description: args.Description,
		Type:        args.Type,
		Target:      target,
	}); err != nil {
		return "", err
	}

	return args.PlaybookID, nil
}

func (r *PlaybookRootResolver) UpdateMetric(ctx context.Context, args struct {
	ID          string
	Title       *string
	Description *string
	Target      *float64
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentMetric, err := c.playbookStore.GetMetric(args.ID)
	if err != nil {
		return "", err
	}

	currentPlaybook, err := c.playbookService.Get(currentMetric.PlaybookID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Title", args.Title)
	addToSetmap(setmap, "Description", args.Description)
	if args.Target != nil {
		setmap["Target"] = null.IntFrom(int64(*args.Target))
	}
	if len(setmap) > 0 {
		if err := c.playbookStore.UpdateMetric(args.ID, setmap); err != nil {
			return "", err
		}
	}

	return args.ID, nil
}

func (r *PlaybookRootResolver) DeleteMetric(ctx context.Context, args struct {
	ID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentMetric, err := c.playbookStore.GetMetric(args.ID)
	if err != nil {
		return "", err
	}

	currentPlaybook, err := c.playbookService.Get(currentMetric.PlaybookID)
	if err != nil {
		return "", err
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	if err := c.playbookStore.DeleteMetric(args.ID); err != nil {
		return "", err
	}

	return args.ID, nil
}

func validatePreAssignmentUpdate[T app.ChecklistCommon](pb app.Playbook, newChecklists *[]T, newInvitedUsers *[]string, newInviteUsersEnabled *bool) error {
	assignees := app.GetDistinctAssignees(pb.Checklists)
	if newChecklists != nil {
		assignees = app.GetDistinctAssignees(*newChecklists)
	}

	invitedUsers := pb.InvitedUserIDs
	if newInvitedUsers != nil {
		invitedUsers = *newInvitedUsers
	}

	inviteUsersEnabled := pb.InviteUsersEnabled
	if newInviteUsersEnabled != nil {
		inviteUsersEnabled = *newInviteUsersEnabled
	}

	return app.ValidatePreAssignment(assignees, invitedUsers, inviteUsersEnabled)
}

// validateUpdateTaskActions validates the taskactions in the given checklist
// NOTE: Any changes to this function must be made to function 'validateTaskActions' for the REST endpoint.
func validateUpdateTaskActions(checklists []UpdateChecklist) error {
	for _, checklist := range checklists {
		for _, item := range checklist.Items {
			if taskActions := item.TaskActions; taskActions != nil {
				for _, ta := range *taskActions {
					if err := app.ValidateTrigger(ta.Trigger); err != nil {
						return err
					}
					for _, a := range ta.Actions {
						if err := app.ValidateAction(a); err != nil {
							return err
						}
					}
				}
			}
		}
	}
	return nil
}
