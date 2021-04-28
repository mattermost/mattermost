// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

type sinceResult struct {
	posts     []*model.Post
	hasMore   bool
	nextSince int64
}

// getPostsSince fetches posts that need to be synchronized with a remote cluster.
// There is a soft cap on the number of posts that will be synchronized in a single pass (MaxPostsPerSync).
//
// There is a special case where multiple posts have the same UpdateAt value. It is vital that this method
// include all posts within that millisecond so that subsequent calls can use an incremented `since`. If this
// method were to be called repeatedly with the same `since` value the same records would be returned each time
// and the sync would never move forward.
//
// A boolean is also returned to indicate if there are more posts to be synchronized (true) or not (false).
func (scs *Service) getPostsSince(channelId string, rc *model.RemoteCluster, since int64) (sinceResult, error) {
	opts := model.GetPostsSinceForSyncOptions{
		ChannelId:      channelId,
		Since:          since,
		IncludeDeleted: true,
		Limit:          MaxPostsPerSync + 1, // ask for 1 more than needed to peek at first post in next batch
	}
	posts, err := scs.server.GetStore().Post().GetPostsSinceForSync(opts, true)
	if err != nil {
		return sinceResult{}, err
	}

	if len(posts) == 0 {
		return sinceResult{nextSince: since}, nil
	}

	var hasMore bool
	if len(posts) > MaxPostsPerSync {
		hasMore = true
		peekUpdateAt := posts[len(posts)-1].UpdateAt
		posts = posts[:MaxPostsPerSync] // trim the peeked at record

		// If the last post to be synchronized has the same Update value as the first post in the next batch
		// then we need to grab the rest of the posts for that millisecond to ensure the next call can have an
		// incremented `since`.
		if peekUpdateAt == posts[len(posts)-1].UpdateAt {
			opts.Since = peekUpdateAt
			opts.Until = opts.Since
			opts.Limit = 1000
			opts.Offset = countPostsAtMillisecond(posts, peekUpdateAt)

			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "getPostsSince handling updateAt collision",
				mlog.String("remote", rc.DisplayName),
				mlog.Int64("update_at", peekUpdateAt),
				mlog.Int("offset", opts.Offset),
			)

			morePosts, err := scs.server.GetStore().Post().GetPostsSinceForSync(opts, true)
			if err != nil {
				return sinceResult{}, err
			}
			posts = append(posts, morePosts...)
		}
	}
	return sinceResult{posts: posts, hasMore: hasMore, nextSince: posts[len(posts)-1].UpdateAt + 1}, nil
}

func countPostsAtMillisecond(posts []*model.Post, milli int64) int {
	// walk backward through the slice until we find a post with UpdateAt that differs from milli.
	var count int
	for i := len(posts) - 1; i >= 0; i-- {
		if posts[i].UpdateAt != milli {
			return count
		}
		count++
	}
	return count
}
