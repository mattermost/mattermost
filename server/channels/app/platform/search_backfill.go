// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

func (ps *PlatformService) backfillPostsChannelType(engine searchengine.SearchEngineInterface) {
	rctx := request.EmptyContext(ps.Log())

	// Check if already done.
	sys, err := ps.Store.System().GetByName(model.SystemPostChannelTypeBackfillComplete)
	if err == nil && sys.Value == "true" {
		return
	}

	rctx.Logger().Info("Starting post channel_type backfill")

	// Backfill public and private channels. GetAllChannels does not filter by the Public/Private opts,
	// so we fetch all channels and group them by type ourselves.
	page := 0
	const perPage = 10000
	for {
		allChannels, channelErr := ps.Store.Channel().GetAllChannels(page*perPage, perPage, store.ChannelSearchOpts{})
		if channelErr != nil {
			rctx.Logger().Error("Failed to get channels for backfill", mlog.Err(channelErr))
			return
		}

		if len(allChannels) == 0 {
			break
		}

		byType := map[string][]string{}
		for _, ch := range allChannels {
			byType[string(ch.Type)] = append(byType[string(ch.Type)], ch.Id)
		}

		for chType, channelIDs := range byType {
			rctx.Logger().Info("Backfilling channel_type batch",
				mlog.String("channel_type", chType),
				mlog.Int("channel_count", len(channelIDs)),
				mlog.Int("page", page))
			if appErr := engine.BackfillPostsChannelType(rctx, channelIDs, chType); appErr != nil {
				rctx.Logger().Error("Failed to backfill channel_type on posts",
					mlog.String("channel_type", chType),
					mlog.Err(appErr))
				return
			}
		}

		if len(allChannels) < perPage {
			break
		}
		page++
	}

	// Mark done.
	if err := ps.Store.System().SaveOrUpdate(&model.System{
		Name:  model.SystemPostChannelTypeBackfillComplete,
		Value: "true",
	}); err != nil {
		rctx.Logger().Error("Backfill data was written but completion flag was not saved; backfill will re-run on next trigger", mlog.Err(err))
		return
	}

	rctx.Logger().Info("Post channel_type backfill complete")
}
