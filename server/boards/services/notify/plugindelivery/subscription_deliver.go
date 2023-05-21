// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugindelivery

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"
)

var (
	ErrUnsupportedSubscriberType = errors.New("invalid subscriber type")
)

// SubscriptionDeliverSlashAttachments notifies a user that changes were made to a block they are subscribed to.
func (pd *PluginDelivery) SubscriptionDeliverSlackAttachments(teamID string, subscriberID string, subscriptionType model.SubscriberType,
	attachments []*mm_model.SlackAttachment) error {
	// check subscriber is member of channel
	_, err := pd.api.GetUserByID(subscriberID)
	if err != nil {
		if model.IsErrNotFound(err) {
			// subscriber is not a member of the channel; fail silently.
			return nil
		}
		return fmt.Errorf("cannot fetch channel member for user %s: %w", subscriberID, err)
	}

	channelID, err := pd.getDirectChannelID(teamID, subscriberID, subscriptionType, pd.botID)
	if err != nil {
		return err
	}

	post := &mm_model.Post{
		UserId:    pd.botID,
		ChannelId: channelID,
	}

	mm_model.ParseSlackAttachment(post, attachments)

	_, err = pd.api.CreatePost(post)
	return err
}

func (pd *PluginDelivery) getDirectChannelID(teamID string, subscriberID string, subscriberType model.SubscriberType, botID string) (string, error) {
	switch subscriberType {
	case model.SubTypeUser:
		user, err := pd.api.GetUserByID(subscriberID)
		if err != nil {
			return "", fmt.Errorf("cannot find user: %w", err)
		}
		channel, err := pd.getDirectChannel(teamID, user.Id, botID)
		if err != nil || channel == nil {
			return "", fmt.Errorf("cannot get direct channel: %w", err)
		}
		return channel.Id, nil
	case model.SubTypeChannel:
		return subscriberID, nil
	default:
		return "", ErrUnsupportedSubscriberType
	}
}

func (pd *PluginDelivery) getDirectChannel(teamID string, userID string, botID string) (*mm_model.Channel, error) {
	// first ensure the bot is a member of the team.
	_, err := pd.api.CreateMember(teamID, botID)
	if err != nil {
		return nil, fmt.Errorf("cannot add bot to team %s: %w", teamID, err)
	}
	return pd.api.GetDirectChannelOrCreate(userID, botID)
}
