// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugindelivery

import (
	"fmt"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/notify"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"

	mm_model "github.com/mattermost/mattermost-server/server/v8/model"
)

// MentionDeliver notifies a user they have been mentioned in a blockv ia the plugin API.
func (pd *PluginDelivery) MentionDeliver(mentionedUser *mm_model.User, extract string, evt notify.BlockChangeEvent) (string, error) {
	author, err := pd.api.GetUserByID(evt.ModifiedBy.UserID)
	if err != nil {
		return "", fmt.Errorf("cannot find user: %w", err)
	}

	channel, err := pd.getDirectChannel(evt.TeamID, mentionedUser.Id, pd.botID)
	if err != nil {
		return "", fmt.Errorf("cannot get direct channel: %w", err)
	}
	link := utils.MakeCardLink(pd.serverRoot, evt.Board.TeamID, evt.Board.ID, evt.Card.ID)
	boardLink := utils.MakeBoardLink(pd.serverRoot, evt.Board.TeamID, evt.Board.ID)

	post := &mm_model.Post{
		UserId:    pd.botID,
		ChannelId: channel.Id,
		Message:   formatMessage(author.Username, extract, evt.Card.Title, link, evt.BlockChanged, boardLink, evt.Board.Title),
	}

	if _, err := pd.api.CreatePost(post); err != nil {
		return "", err
	}

	return mentionedUser.Id, nil
}
