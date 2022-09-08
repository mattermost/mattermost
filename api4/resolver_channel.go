// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/base64"
	"fmt"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/web"
)

// channel is an internal graphQL wrapper struct to add resolver methods.
type channel struct {
	model.Channel
	PrettyDisplayName string
}

// match with api4.getTeam
func (ch *channel) Team(ctx context.Context) (*model.Team, error) {
	if ch.TeamId == "" {
		return nil, nil
	}

	return getGraphQLTeam(ctx, ch.TeamId)
}

// match with api4.getChannelStats
func (ch *channel) Stats(ctx context.Context) (*model.ChannelStats, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), ch.Id, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return nil, c.Err
	}

	memberCount, appErr := c.App.GetChannelMemberCount(c.AppContext, ch.Id)
	if appErr != nil {
		return nil, appErr
	}

	guestCount, appErr := c.App.GetChannelGuestCount(c.AppContext, ch.Id)
	if appErr != nil {
		return nil, appErr
	}

	pinnedPostCount, appErr := c.App.GetChannelPinnedPostCount(c.AppContext, ch.Id)
	if appErr != nil {
		return nil, appErr
	}

	return &model.ChannelStats{ChannelId: ch.Id, MemberCount: memberCount, GuestCount: guestCount, PinnedPostCount: pinnedPostCount}, nil
}

func (ch *channel) Cursor() *string {
	cursor := string(channelCursorPrefix) + "-" + ch.Id
	encoded := base64.StdEncoding.EncodeToString([]byte(cursor))
	return model.NewString(encoded)
}

func parseChannelCursor(cursor string) (channelID string, ok bool) {
	decoded, err := base64.StdEncoding.DecodeString(cursor)
	if err != nil {
		return "", false
	}

	prefix, id, found := strings.Cut(string(decoded), "-")
	if !found {
		return "", false
	}

	if cursorPrefix(prefix) != channelCursorPrefix {
		return "", false
	}

	return id, true
}

func postProcessChannels(c *web.Context, channels []*model.Channel) ([]*channel, error) {
	// This approach becomes effectively similar to a dataloader if the displayName computation
	// were to be done at the field level per channel.

	// Get DM/GM channelIDs and set empty maps as well.
	var channelIDs []string
	for _, ch := range channels {
		if ch.IsGroupOrDirect() {
			channelIDs = append(channelIDs, ch.Id)
		}

		// This is needed to avoid sending null, which
		// does not match with the schema since props is not nullable.
		// And making it nullable would mean taking pointer of a map,
		// which is not very idiomatic.
		ch.MakeNonNil()
	}

	var nameFormat string
	var userInfo map[string][]*model.User
	var err error

	// Avoiding unnecessary queries unless necessary.
	if len(channelIDs) > 0 {
		userInfo, err = c.App.Srv().Store().Channel().GetMembersInfoByChannelIds(channelIDs)
		if err != nil {
			return nil, err
		}

		user := &model.User{Id: c.AppContext.Session().UserId}
		nameFormat = c.App.GetNotificationNameFormat(user)
	}

	// Convert to the wrapper format.
	nameCache := make(map[string]string)
	res := make([]*channel, len(channels))
	for i, ch := range channels {
		prettyName := ch.DisplayName

		if ch.IsGroupOrDirect() {
			// get users slice for channel id
			users := userInfo[ch.Id]
			if users == nil {
				return nil, fmt.Errorf("user info not found for channel id: %s", ch.Id)
			}
			prettyName = getPrettyDNForUsers(nameFormat, users, c.AppContext.Session().UserId, nameCache)
		}

		res[i] = &channel{Channel: *ch, PrettyDisplayName: prettyName}
	}

	return res, nil
}

func getPrettyDNForUsers(displaySetting string, users []*model.User, omitUserId string, cache map[string]string) string {
	displayNames := make([]string, 0, len(users))
	for _, u := range users {
		if u.Id == omitUserId {
			continue
		}
		displayNames = append(displayNames, getPrettyDNForUser(displaySetting, u, cache))
	}

	sort.Strings(displayNames)
	result := strings.Join(displayNames, ", ")
	if result == "" {
		// Self DM
		result = getPrettyDNForUser(displaySetting, users[0], cache)
	}
	return result
}

func getPrettyDNForUser(displaySetting string, user *model.User, cache map[string]string) string {
	// use the cache first
	if name, ok := cache[user.Id]; ok {
		return name
	}

	var displayName string
	switch displaySetting {
	case "nickname_full_name":
		displayName = user.Nickname
		if strings.TrimSpace(displayName) == "" {
			displayName = user.GetFullName()
		}
		if strings.TrimSpace(displayName) == "" {
			displayName = user.Username
		}
	case "full_name":
		displayName = user.GetFullName()
		if strings.TrimSpace(displayName) == "" {
			displayName = user.Username
		}
	default: // the "username" case also falls under this one.
		displayName = user.Username
	}

	// update the cache
	cache[user.Id] = displayName

	return displayName
}
