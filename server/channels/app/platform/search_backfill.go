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

	// Backfill public and private channels.
	channelTypes := []struct {
		channelType string
		opts        store.ChannelSearchOpts
	}{
		{"O", store.ChannelSearchOpts{Public: true}},
		{"P", store.ChannelSearchOpts{Private: true}},
	}

	for _, ct := range channelTypes {
		page := 0
		const perPage = 10000
		for {
			channels, channelErr := ps.Store.Channel().GetAllChannels(page*perPage, perPage, ct.opts)
			if channelErr != nil {
				rctx.Logger().Error("Failed to get channels for backfill",
					mlog.String("channel_type", ct.channelType),
					mlog.Err(channelErr))
				return
			}

			if len(channels) == 0 {
				break
			}

			channelIDs := make([]string, len(channels))
			for i, ch := range channels {
				channelIDs[i] = ch.Id
			}

			if appErr := engine.BackfillPostsChannelType(rctx, channelIDs, ct.channelType); appErr != nil {
				rctx.Logger().Error("Failed to backfill channel_type on posts",
					mlog.String("channel_type", ct.channelType),
					mlog.Err(appErr))
				return
			}

			if len(channels) < perPage {
				break
			}
			page++
		}
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
