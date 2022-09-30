// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"errors"
	"fmt"

	"github.com/graph-gophers/dataloader/v6"
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/web"
)

// cursorPrefix is used to categorize objects
// sent in a cursor. The type is prepended
// to the string with a - to find which
// object the id belongs to.
//
// And after the type is extracted, object
// specific logic can be applied to extract the id.
type cursorPrefix string

const (
	channelMemberCursorPrefix cursorPrefix = "channelMember"
	channelCursorPrefix       cursorPrefix = "channel"
)

type resolver struct {
}

// match with api4.getChannelsForTeamForUser
func (r *resolver) Channels(ctx context.Context, args struct {
	TeamID         string
	UserID         string
	IncludeDeleted bool
	LastDeleteAt   float64
	LastUpdateAt   float64
	First          int32
	After          string
}) ([]*channel, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if args.UserID == model.Me {
		args.UserID = c.AppContext.Session().UserId
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), args.UserID) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return nil, c.Err
	}

	if args.TeamID != "" && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), args.TeamID, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return nil, c.Err
	}

	limit := int(args.First)
	// ensure args.First limit
	if limit == 0 {
		limit = web.PerPageDefault
	} else if limit > web.PerPageMaximum {
		return nil, fmt.Errorf("first parameter %d higher than allowed maximum of %d", limit, web.PerPageMaximum)
	}

	// ensure args.After format
	var afterChannel string
	var ok bool
	if args.After != "" {
		afterChannel, ok = parseChannelCursor(args.After)
		if !ok {
			return nil, fmt.Errorf("after cursor not in the correct format: %s", args.After)
		}
	}

	// TODO: convert this to a streaming API.
	channels, appErr := c.App.GetChannelsForTeamForUserWithCursor(c.AppContext, args.TeamID, args.UserID, &model.ChannelSearchOpts{
		IncludeDeleted: args.IncludeDeleted,
		LastDeleteAt:   int(args.LastDeleteAt),
		LastUpdateAt:   int(args.LastUpdateAt),
		PerPage:        model.NewInt(limit),
	}, afterChannel)
	if appErr != nil {
		return nil, appErr
	}

	appErr = c.App.FillInChannelsProps(c.AppContext, channels)
	if appErr != nil {
		return nil, appErr
	}

	return postProcessChannels(c, channels)
}

// match with api4.getUser
func (r *resolver) User(ctx context.Context, args struct{ ID string }) (*user, error) {
	return getGraphQLUser(ctx, args.ID)
}

// match with api4.getClientConfig
func (r *resolver) Config(ctx context.Context) (model.StringMap, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if c.AppContext.Session().UserId == "" {
		return c.App.LimitedClientConfigWithComputed(), nil
	}
	return c.App.ClientConfigWithComputed(), nil
}

// match with api4.getClientLicense
func (r *resolver) License(ctx context.Context) (model.StringMap, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadLicenseInformation) {
		return c.App.Srv().ClientLicense(), nil
	}
	return c.App.Srv().GetSanitizedClientLicense(), nil
}

// match with api4.getTeamMembersForUser for teamID=""
// and api4.getTeamMember for teamID != ""
func (r *resolver) TeamMembers(ctx context.Context, args struct {
	UserID      string
	TeamID      string
	ExcludeTeam bool
}) ([]*teamMember, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if args.UserID == model.Me {
		args.UserID = c.AppContext.Session().UserId
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), args.UserID) && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadOtherUsersTeams) {
		c.SetPermissionError(model.PermissionReadOtherUsersTeams)
		return nil, c.Err
	}

	canSee, appErr := c.App.UserCanSeeOtherUser(c.AppContext.Session().UserId, args.UserID)
	if appErr != nil {
		return nil, appErr
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return nil, c.Err
	}

	if args.TeamID != "" && !args.ExcludeTeam {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), args.TeamID, model.PermissionViewTeam) {
			c.SetPermissionError(model.PermissionViewTeam)
			return nil, c.Err
		}

		tm, appErr2 := c.App.GetTeamMember(args.TeamID, args.UserID)
		if appErr2 != nil {
			return nil, appErr2
		}

		return []*teamMember{{*tm}}, nil
	}

	excludeTeamID := ""
	if args.TeamID != "" && args.ExcludeTeam {
		excludeTeamID = args.TeamID
	}

	// Do not return archived team members
	members, appErr := c.App.GetTeamMembersForUser(args.UserID, excludeTeamID, false)
	if appErr != nil {
		return nil, appErr
	}

	// Convert to the wrapper format.
	res := make([]*teamMember, 0, len(members))
	for _, tm := range members {
		res = append(res, &teamMember{*tm})
	}

	return res, nil
}

func (*resolver) ChannelsLeft(ctx context.Context, args struct {
	UserID string
	Since  float64
}) ([]string, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if args.UserID == model.Me {
		args.UserID = c.AppContext.Session().UserId
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), args.UserID) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return nil, c.Err
	}

	return c.App.Srv().Store.ChannelMemberHistory().GetChannelsLeftSince(args.UserID, int64(args.Since))
}

// match with api4.getChannelMember
func (*resolver) ChannelMembers(ctx context.Context, args struct {
	UserID       string
	TeamID       string
	ChannelID    string
	ExcludeTeam  bool
	First        int32
	After        string
	LastUpdateAt float64
}) ([]*channelMember, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if args.UserID == model.Me {
		args.UserID = c.AppContext.Session().UserId
	}

	// If it's a single channel
	if args.ChannelID != "" {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), args.ChannelID, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return nil, c.Err
		}

		ctx := c.AppContext
		ctx.SetContext(app.WithMaster(ctx.Context()))
		member, appErr := c.App.GetChannelMember(ctx, args.ChannelID, args.UserID)
		if appErr != nil {
			return nil, appErr
		}

		return []*channelMember{{*member}}, nil
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), args.UserID) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return nil, c.Err
	}

	limit := int(args.First)
	// ensure args.First limit
	if limit == 0 {
		limit = web.PerPageDefault
	} else if limit > web.PerPageMaximum {
		return nil, fmt.Errorf("first parameter %d higher than allowed maximum of %d", limit, web.PerPageMaximum)
	}

	// ensure args.After format
	var afterChannel, afterUser string
	var ok bool
	if args.After != "" {
		afterChannel, afterUser, ok = parseChannelMemberCursor(args.After)
		if !ok {
			return nil, fmt.Errorf("after cursor not in the correct format: %s", args.After)
		}
	}

	if args.TeamID != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), args.TeamID, model.PermissionViewTeam) {
			primaryTeam := *c.App.Config().TeamSettings.ExperimentalPrimaryTeam
			if primaryTeam != "" {
				team, appErr := c.App.GetTeamByName(primaryTeam)
				if appErr != nil {
					return []*channelMember{}, appErr
				}
				args.TeamID = team.Id
			} else {
				return []*channelMember{}, nil
			}
		}
	}

	opts := &store.ChannelMemberGraphQLSearchOpts{
		AfterChannel: afterChannel,
		AfterUser:    afterUser,
		Limit:        limit,
		LastUpdateAt: int(args.LastUpdateAt),
		ExcludeTeam:  args.ExcludeTeam,
	}
	members, err := c.App.Srv().Store.Channel().GetMembersForUserWithCursor(args.UserID, args.TeamID, opts)
	if err != nil {
		return nil, err
	}

	res := make([]*channelMember, 0, len(members))
	for _, cm := range members {
		res = append(res, &channelMember{cm})
	}

	return res, nil
}

// match with api4.getCategoriesForTeamForUser
func (*resolver) SidebarCategories(ctx context.Context, args struct {
	UserID      string
	TeamID      string
	ExcludeTeam bool
}) ([]*model.SidebarCategoryWithChannels, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	// Fallback to primary team logic
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), args.TeamID, model.PermissionViewTeam) {
		primaryTeam := *c.App.Config().TeamSettings.ExperimentalPrimaryTeam
		if primaryTeam != "" {
			team, appErr := c.App.GetTeamByName(primaryTeam)
			if appErr != nil {
				return []*model.SidebarCategoryWithChannels{}, appErr
			}
			args.TeamID = team.Id
		} else {
			return []*model.SidebarCategoryWithChannels{}, nil
		}
	}

	if args.UserID == model.Me {
		args.UserID = c.AppContext.Session().UserId
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), args.UserID) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return nil, c.Err
	}

	// If it's only for a single team.
	var categories *model.OrderedSidebarCategories
	var appErr *model.AppError
	if !args.ExcludeTeam {
		categories, appErr = c.App.GetSidebarCategoriesForTeamForUser(c.AppContext, args.UserID, args.TeamID)
		if appErr != nil {
			return nil, appErr
		}
	} else {
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      args.TeamID,
			ExcludeTeam: args.ExcludeTeam,
		}
		categories, appErr = c.App.GetSidebarCategories(c.AppContext, args.UserID, opts)
		if appErr != nil {
			return nil, appErr
		}
	}

	// TODO: look into optimizing this.
	// create map
	orderMap := make(map[string]*model.SidebarCategoryWithChannels, len(categories.Categories))
	for _, category := range categories.Categories {
		orderMap[category.Id] = category
	}

	// create a new slice based on the order
	res := make([]*model.SidebarCategoryWithChannels, 0, len(categories.Categories))
	for _, categoryId := range categories.Order {
		res = append(res, orderMap[categoryId])
	}

	return res, nil
}

// getCtx extracts web.Context out of the usual request context.
// Kind of an anti-pattern, but there are lots of methods attached to *web.Context
// so we use it for now.
func getCtx(ctx context.Context) (*web.Context, error) {
	c, ok := ctx.Value(webCtx).(*web.Context)
	if !ok {
		return nil, errors.New("no web.Context found in context")
	}
	return c, nil
}

// getRolesLoader returns the roles loader out of the context.
func getRolesLoader(ctx context.Context) (*dataloader.Loader, error) {
	l, ok := ctx.Value(rolesLoaderCtx).(*dataloader.Loader)
	if !ok {
		return nil, errors.New("no dataloader.Loader found in context")
	}
	return l, nil
}

// getChannelsLoader returns the channels loader out of the context.
func getChannelsLoader(ctx context.Context) (*dataloader.Loader, error) {
	l, ok := ctx.Value(channelsLoaderCtx).(*dataloader.Loader)
	if !ok {
		return nil, errors.New("no dataloader.Loader found in context")
	}
	return l, nil
}

// getTeamsLoader returns the teams loader out of the context.
func getTeamsLoader(ctx context.Context) (*dataloader.Loader, error) {
	l, ok := ctx.Value(teamsLoaderCtx).(*dataloader.Loader)
	if !ok {
		return nil, errors.New("no dataloader.Loader found in context")
	}
	return l, nil
}

// getUsersLoader returns the users loader out of the context.
func getUsersLoader(ctx context.Context) (*dataloader.Loader, error) {
	l, ok := ctx.Value(usersLoaderCtx).(*dataloader.Loader)
	if !ok {
		return nil, errors.New("no dataloader.Loader found in context")
	}
	return l, nil
}
