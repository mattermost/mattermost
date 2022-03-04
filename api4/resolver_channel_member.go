// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

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

	channel, appErr := c.App.GetChannel(cm.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

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

	appErr = c.App.FillInChannelProps(channel)
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

func (cm *channelMember) Roles_(ctx context.Context) ([]*model.Role, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	return getGraphQLRoles(c, strings.Fields(cm.Roles))
}

func (cm *channelMember) Cursor() *string {
	cursor := string(channelMemberCursorPrefix) + "-" + cm.ChannelId + "-" + cm.UserId
	encoded := base64.StdEncoding.EncodeToString([]byte(cursor))
	return model.NewString(encoded)
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
