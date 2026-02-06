// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const twoHoursInMilliseconds = int64(2 * 60 * 60 * 1000)

// handlePageUpdateNotification handles creating or updating page update notifications.
// wiki and channel are optional - if provided, avoids DB fetches.
func (a *App) handlePageUpdateNotification(rctx request.CTX, page *model.Post, userId string, wiki *model.Wiki, channel *model.Channel) {
	// Use provided wiki or fetch if not provided
	if wiki == nil {
		wikiId, _ := page.Props[model.PagePropsWikiID].(string)
		if wikiId == "" {
			var err *model.AppError
			wikiId, err = a.GetWikiIdForPost(rctx, page)
			if err != nil {
				rctx.Logger().Warn("Failed to get wiki for page update notification",
					mlog.String("page_id", page.Id),
					mlog.Err(err))
				return
			}
		}

		var wikiErr *model.AppError
		wiki, wikiErr = a.GetWiki(rctx, wikiId)
		if wikiErr != nil {
			rctx.Logger().Warn("Failed to get wiki details for page update notification",
				mlog.String("wiki_id", wikiId),
				mlog.Err(wikiErr))
			return
		}
	}

	// Use provided channel or fetch if not provided
	if channel == nil {
		var chanErr *model.AppError
		channel, chanErr = a.GetChannel(rctx, page.ChannelId)
		if chanErr != nil {
			rctx.Logger().Warn("Failed to get channel for page update notification",
				mlog.String("channel_id", page.ChannelId),
				mlog.Err(chanErr))
			return
		}
	}

	twoHoursAgo := model.GetMillis() - twoHoursInMilliseconds

	// Resolve username before the atomic store call
	username := ""
	user, userErr := a.GetUser(userId)
	if userErr != nil {
		rctx.Logger().Warn("Failed to get user for page update notification",
			mlog.String("user_id", userId),
			mlog.Err(userErr))
	} else {
		username = user.Username
	}

	pageTitle := page.GetPageTitle()

	// Atomically find and update the existing notification using SELECT FOR UPDATE
	// to prevent lost updates from concurrent page edits
	updatedPost, updateErr := a.Srv().Store().Page().AtomicUpdatePageNotification(
		page.ChannelId, page.Id, userId, username, pageTitle, twoHoursAgo,
	)
	if updateErr != nil {
		rctx.Logger().Warn("Failed to atomically update page notification, creating new one",
			mlog.String("page_id", page.Id),
			mlog.Err(updateErr))
		a.createNewPageUpdateNotification(rctx, page, wiki, channel, userId, 1)
		return
	}

	if updatedPost != nil {
		rctx.Logger().Debug("Updated existing page update notification",
			mlog.String("notification_id", updatedPost.Id),
			mlog.String("page_id", page.Id))
	} else {
		a.createNewPageUpdateNotification(rctx, page, wiki, channel, userId, 1)
	}
}

func (a *App) createNewPageUpdateNotification(rctx request.CTX, page *model.Post, wiki *model.Wiki, channel *model.Channel, userId string, updateCount int) {
	pageTitle := page.GetPageTitle()

	user, userErr := a.GetUser(userId)
	if userErr != nil {
		rctx.Logger().Warn("Failed to get user for page update notification",
			mlog.String("user_id", userId),
			mlog.Err(userErr))
		return
	}

	systemPost := &model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Type:      model.PostTypePageUpdated,
		Props: map[string]any{
			model.PagePropsPageID: page.Id,
			"page_title":          pageTitle,
			model.PagePropsWikiID: wiki.Id,
			"wiki_title":          wiki.Title,
			"channel_id":          channel.Id,
			"channel_name":        channel.Name,
			"update_count":        updateCount,
			"last_update_time":    model.GetMillis(),
			"updater_ids":         []string{userId},
			"username_" + userId:  user.Username,
		},
	}

	if _, _, err := a.CreatePost(rctx, systemPost, channel, model.CreatePostFlags{}); err != nil {
		rctx.Logger().Warn("Failed to create page update system message",
			mlog.String("page_id", page.Id),
			mlog.String("wiki_id", wiki.Id),
			mlog.String("channel_id", channel.Id),
			mlog.Err(err))
	} else {
		rctx.Logger().Debug("Created new page update notification",
			mlog.String("page_id", page.Id),
			mlog.Int("update_count", updateCount))
	}
}
