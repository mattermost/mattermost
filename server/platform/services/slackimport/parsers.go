// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slackimport

import (
	"encoding/json"
	"io"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func slackParseChannels(data io.Reader, channelType model.ChannelType) ([]slackChannel, error) {
	decoder := json.NewDecoder(data)

	var channels []slackChannel
	if err := decoder.Decode(&channels); err != nil {
		mlog.Warn("Slack Import: Error occurred when parsing some Slack channels. Import may work anyway.", mlog.Err(err))
		return channels, err
	}

	for i := range channels {
		channels[i].Type = channelType
	}

	return channels, nil
}

func slackParseUsers(data io.Reader) ([]slackUser, error) {
	decoder := json.NewDecoder(data)

	var users []slackUser
	err := decoder.Decode(&users)
	// This actually returns errors that are ignored.
	// In this case it is erroring because of a null that Slack
	// introduced. So we just return the users here.
	return users, err
}

func slackParsePosts(data io.Reader) ([]slackPost, error) {
	decoder := json.NewDecoder(data)

	var posts []slackPost
	if err := decoder.Decode(&posts); err != nil {
		mlog.Warn("Slack Import: Error occurred when parsing some Slack posts. Import may work anyway.", mlog.Err(err))
		return posts, err
	}
	return posts, nil
}
