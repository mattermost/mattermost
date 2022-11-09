// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

func (a *App) GetPriorityForPost(postId string) (*model.PostPriority, *model.AppError) {
	priority, err := a.Srv().Store().PostPriority().GetForPost(postId)

	if err != nil && err != sql.ErrNoRows {
		return nil, model.NewAppError("GetPriorityForPost", "app.post_prority.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return priority, nil
}

func (a *App) SendPersistentNotifications() error {
	// notificationInterval := a.Config().ServiceSettings.PersistenceNotificationInterval
	notificationInterval, err := time.ParseDuration("5m")
	if err != nil {
		return errors.Wrap(err, "failed to parse persistent notifications interval")
	}

	// fetch posts for which first notificationInterval duration has passed
	minCreateAt := time.Now().Add(-notificationInterval).UnixMilli()
	notificationPosts, err := a.Srv().Store().PostPriority().GetPersistentNotificationsPosts(minCreateAt)
	if err != nil {
		return errors.Wrap(err, "failed to get posts for persistent notifications")
	}

	// No posts available at the moment for persistent notifications
	if len(notificationPosts) == 0 {
		return nil
	}

	postIds := make([]string, len(notificationPosts))
	for _, p := range notificationPosts {
		postIds = append(postIds, p.PostId)
	}
	posts, err := a.Srv().Store().Post().GetPostsByIds(postIds)
	if err != nil {
		return errors.Wrap(err, "failed to get posts by IDs")
	}

	// notificationMaxDuration := a.Config().ServiceSettings.PersistenceNotificationMaxDuration
	notificationMaxDuration, err := time.ParseDuration("30m")
	if err != nil {
		return errors.Wrap(err, "failed to parse persistent notifications max duration")
	}
	var expiredPosts []*model.Post
	var validPosts []*model.Post
	for _, p := range posts {
		expireAt := time.UnixMilli(p.CreateAt).Add(notificationMaxDuration)
		if time.Now().UTC().After(expireAt) {
			expiredPosts = append(expiredPosts, p)
		} else {
			validPosts = append(validPosts, p)
		}
	}

	// Delete expired notifications posts
	// store.DeleteNotificationPostsByIDs(expiredPostsIDs)

	// Send notifications to validPosts
	return a.sendPersistentNotifications(validPosts)
}

func (a *App) sendPersistentNotifications(posts []*model.Post) error {
	mentions, err := a.getMentionsForPersistentNotifications(posts)
	if err != nil {
		return err
	}

	// sendNotifications to mentions
	fmt.Println(mentions)

	return nil
}

func (a *App) getMentionsForPersistentNotifications(posts []*model.Post) (map[string]*ExplicitMentions, error) {
	channelIds := make(model.StringSet)
	for _, p := range posts {
		channelIds.Add(p.ChannelId)
	}
	channels, err := a.Srv().Store().Channel().GetChannelsByIds(channelIds.Val(), false)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get channels by IDs")
	}
	channelsMap := make(map[string]*model.Channel, len(channels))
	for _, c := range channels {
		channelsMap[c.Id] = c
	}

	teamIds := make(model.StringSet)
	for _, c := range channels {
		teamIds.Add(c.TeamId)
	}
	teams, err := a.Srv().Store().Team().GetMany(teamIds.Val())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get teams by IDs")
	}
	teamsMap := make(map[string]*model.Team, len(teams))
	for _, t := range teams {
		teamsMap[t.Id] = t
	}

	channelsGroupsMap := make(map[string]map[string]*model.Group, len(channelsMap))
	for _, c := range channelsMap {
		groups, appErr := a.getGroupsAllowedForReferenceInChannel(c, teamsMap[c.TeamId])
		if appErr != nil {
			return nil, errors.Wrap(err, "failed to get groups for channels")
		}
		channelsGroupsMap[c.Id] = make(map[string]*model.Group, len(groups))
		for k, v := range groups {
			channelsGroupsMap[c.Id][k] = v
		}
	}

	postsMentions := make(map[string]*ExplicitMentions, len(posts))
	for _, p := range posts {
		postsMentions[p.Id] = getExplicitMentions(p, make(map[string][]string, 0), channelsGroupsMap[p.ChannelId])
	}

	return postsMentions, nil
}
