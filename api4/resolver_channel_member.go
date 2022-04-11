// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/graph-gophers/dataloader/v6"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/web"
)

// channelMember is an internal graphQL wrapper struct to add resolver methods.
type channelMember struct {
	model.ChannelMember
}

// match with api4.getUser
func (cm *channelMember) User(ctx context.Context) (*user, error) {
	return getGraphQLUser(ctx, cm.UserId)
}

// match with api4.Channel
func (cm *channelMember) Channel(ctx context.Context) (*channel, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	loader, err := getChannelsLoader(ctx)
	if err != nil {
		return nil, err
	}

	thunk := loader.Load(ctx, dataloader.StringKey(cm.ChannelId))
	result, err := thunk()
	if err != nil {
		return nil, err
	}
	channel := result.(*model.Channel)

	if channel.Type == model.ChannelTypeOpen {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionReadPublicChannel) &&
			!c.App.SessionHasPermissionToChannel(*c.AppContext.Session(), cm.ChannelId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadPublicChannel)
			return nil, c.Err
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(*c.AppContext.Session(), cm.ChannelId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return nil, c.Err
		}
	}

	appErr := c.App.FillInChannelProps(channel)
	if appErr != nil {
		return nil, appErr
	}

	res, err := postProcessChannels(c, []*model.Channel{channel})
	if err != nil {
		return nil, err
	}
	// A bit of defence-in-depth; can probably be removed after a deeper look.
	if len(res) != 1 {
		return nil, fmt.Errorf("postProcessChannels: incorrect number of channels returned %d", len(res))
	}
	return res[0], nil
}

func graphQLChannelsLoader(ctx context.Context, keys dataloader.Keys) []*dataloader.Result {
	stringKeys := keys.Keys()
	result := make([]*dataloader.Result, len(stringKeys))

	c, err := getCtx(ctx)
	if err != nil {
		for i := range result {
			result[i] = &dataloader.Result{Error: err}
		}
		return result
	}

	channels, err := getGraphQLChannels(c, stringKeys)
	if err != nil {
		for i := range result {
			result[i] = &dataloader.Result{Error: err}
		}
		return result
	}

	for i, ch := range channels {
		result[i] = &dataloader.Result{Data: ch}
	}
	return result
}

func getGraphQLChannels(c *web.Context, channelIDs []string) ([]*model.Channel, error) {
	channels, appErr := c.App.GetChannels(channelIDs)
	if appErr != nil {
		return nil, appErr
	}

	if len(channels) != len(channelIDs) {
		return nil, fmt.Errorf("all channels were not found. Requested %d; Found %d", len(channelIDs), len(channels))
	}

	// The channels need to be in the exact same order as the input slice.
	tmp := make(map[string]*model.Channel)
	for _, ch := range channels {
		tmp[ch.Id] = ch
	}

	// We reuse the same slice and just rewrite the channels.
	for i, id := range channelIDs {
		channels[i] = tmp[id]
	}

	return channels, nil
}

func (cm *channelMember) Roles_(ctx context.Context) ([]*model.Role, error) {
	loader, err := getRolesLoader(ctx)
	if err != nil {
		return nil, err
	}

	thunk := loader.LoadMany(ctx, dataloader.NewKeysFromStrings(strings.Fields(cm.Roles)))
	results, errs := thunk()
	// All errors are the same. We just return the first one.
	if len(errs) > 0 && errs[0] != nil {
		return nil, err
	}

	roles := make([]*model.Role, len(results))
	for i, res := range results {
		roles[i] = res.(*model.Role)
	}

	return roles, nil
}

func (cm *channelMember) Cursor() *string {
	cursor := string(channelMemberCursorPrefix) + "-" + cm.ChannelId + "-" + cm.UserId
	encoded := base64.StdEncoding.EncodeToString([]byte(cursor))
	return model.NewString(encoded)
}

func graphQLRolesLoader(ctx context.Context, keys dataloader.Keys) []*dataloader.Result {
	stringKeys := keys.Keys()
	result := make([]*dataloader.Result, len(stringKeys))

	c, err := getCtx(ctx)
	if err != nil {
		for i := range result {
			result[i] = &dataloader.Result{Error: err}
		}
		return result
	}

	roles, err := getGraphQLRoles(c, stringKeys)
	if err != nil {
		for i := range result {
			result[i] = &dataloader.Result{Error: err}
		}
		return result
	}

	for i, role := range roles {
		result[i] = &dataloader.Result{Data: role}
	}
	return result
}

func getGraphQLRoles(c *web.Context, roleNames []string) ([]*model.Role, error) {
	cleanedRoleNames, valid := model.CleanRoleNames(roleNames)
	if !valid {
		c.SetInvalidParam("rolename")
		return nil, c.Err
	}

	roles, appErr := c.App.GetRolesByNames(cleanedRoleNames)
	if appErr != nil {
		return nil, appErr
	}

	// The roles need to be in the exact same order as the input slice.
	tmp := make(map[string]*model.Role)
	for _, r := range roles {
		tmp[r.Name] = r
	}

	// We reuse the same slice and just rewrite the roles.
	for i, roleName := range roleNames {
		roles[i] = tmp[roleName]
	}

	return roles, nil
}

func parseChannelMemberCursor(cursor string) (channelID, userID string, ok bool) {
	decoded, err := base64.StdEncoding.DecodeString(cursor)
	if err != nil {
		return "", "", false
	}

	parts := strings.Split(string(decoded), "-")
	if len(parts) != 3 {
		return "", "", false
	}

	if cursorPrefix(parts[0]) != channelMemberCursorPrefix {
		return "", "", false
	}

	return parts[1], parts[2], true
}
