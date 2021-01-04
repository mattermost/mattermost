// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
)

func (scs *Service) onReceiveSyncMessage(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response remotecluster.Response) error {
	if msg.Topic != TopicSync {
		return fmt.Errorf("wrong topic, expected `%s`, got `%s`", TopicSync, msg.Topic)
	}

	if len(msg.Payload) == 0 {
		return errors.New("empty sync message")
	}

	var syncMessages []syncMsg

	if err := json.Unmarshal(msg.Payload, &syncMessages); err != nil {
		return fmt.Errorf("invalid sync message: %w", err)
	}

	scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Sync message received",
		mlog.String("remote", rc.DisplayName),
		mlog.Int("count", len(syncMessages)),
	)

	postErrors, lastUpdate, err := scs.processSyncMessagesViaStore(syncMessages, rc, response)
	if err == nil {
		if len(postErrors) > 0 {
			response[ResponsePostErrors] = postErrors
		}
		response[ResponseLastUpdateAt] = lastUpdate
	}
	return err
}

//
//   Sync message should be array of users; array of posts; array of reactions
//

//
// Strategy 1:  use store to upsert posts and reactions.
//

func (scs *Service) processSyncMessagesViaStore(syncMessages []syncMsg, rc *model.RemoteCluster, response remotecluster.Response) (postErrors []string, lastUpdate int64, err error) {
	postErrors = make([]string, 0)
	var channel *model.Channel

	for _, sm := range syncMessages {

		// TODO: modify perma-links (MM-31596)

		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Sync post received",
			mlog.String("post_id", sm.Post.Id),
			mlog.String("channel_id", sm.Post.ChannelId),
			mlog.Int("reaction_count", len(sm.Reactions)))

		if channel == nil {
			if channel, err = scs.server.GetStore().Channel().Get(sm.Post.ChannelId, true); err != nil {
				// if the channel doesn't exist then none of these sync messages are going to work.
				return postErrors, 0, fmt.Errorf("channel not found processing sync messages: %w", err)
			}
		}

		if err := scs.server.GetStore().SharedChannel().UpsertPost(sm.Post); err != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error saving sync Post",
				mlog.String("remote", rc.DisplayName),
				mlog.String("ChannelId", sm.Post.ChannelId),
				mlog.String("PostId", sm.Post.Id),
				mlog.Err(err),
			)
			postErrors = append(postErrors, sm.Post.Id)
			continue
		}

		for _, reaction := range sm.Reactions {
			// userid won't exist on this server
			reaction.UserId = ""
			if err := scs.server.GetStore().SharedChannel().UpsertReaction(reaction); err != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error saving sync Reaction",
					mlog.String("remote", rc.DisplayName),
					mlog.String("ChannelId", sm.Post.ChannelId),
					mlog.String("PostId", sm.Post.Id),
					mlog.Err(err),
				)
			}
		}
		lastUpdate = sm.Post.UpdateAt
	}
	return postErrors, lastUpdate, nil
}

//
// Strategy 2:  use app api to create/update posts and reactions.
//

func (scs *Service) processSyncMessagesViaApp(syncMessages []syncMsg, rc *model.RemoteCluster, response remotecluster.Response) (postErrors []string, lastUpdate int64, err error) {
	var channel *model.Channel
	postErrors = make([]string, 0)

	for _, sm := range syncMessages {

		// TODO: modify perma-links (MM-31596)

		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Sync post received",
			mlog.String("post_id", sm.Post.Id),
			mlog.String("channel_id", sm.Post.ChannelId),
			mlog.Int("reaction_count", len(sm.Reactions)))

		if channel == nil {
			if channel, err = scs.server.GetStore().Channel().Get(sm.Post.ChannelId, true); err != nil {
				// if the channel doesn't exist then none of these sync messages are going to work.
				return postErrors, 0, fmt.Errorf("channel not found processing sync messages: %w", err)
			}
		}

		var appErr *model.AppError
		rpost, err := scs.server.GetStore().Post().GetSingle(sm.Post.Id)
		if err != nil || rpost == nil {
			// post doesn't exist; create new one
			rpost, appErr = scs.app.CreatePost(sm.Post, channel, true, true)
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Creating sync post",
				mlog.String("post_id", sm.Post.Id),
				mlog.String("channel_id", sm.Post.ChannelId))
		} else {
			// update post
			rpost, appErr = scs.app.UpdatePost(sm.Post, false)
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Updating sync post",
				mlog.String("post_id", sm.Post.Id),
				mlog.String("channel_id", sm.Post.ChannelId))
		}

		if appErr != nil {
			postErrors = append(postErrors, sm.Post.Id)
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error creating/updating sync post",
				mlog.String("post_id", sm.Post.Id),
				mlog.String("channel_id", sm.Post.ChannelId),
				mlog.Err(appErr))
			continue
		}

		for _, reaction := range sm.Reactions {
			// userid won't exist on this server
			reaction.UserId = ""
			if err := scs.server.GetStore().SharedChannel().UpsertReaction(reaction); err != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error saving sync Reaction",
					mlog.String("remote", rc.DisplayName),
					mlog.String("ChannelId", sm.Post.ChannelId),
					mlog.String("PostId", sm.Post.Id),
					mlog.Err(err),
				)
			}
		}
		lastUpdate = rpost.UpdateAt
	}
	return postErrors, lastUpdate, nil
}

//
// Strategy 3:  use app api to create/update posts and reactions. Add users that have posted in channel.
//

/*
func (scs *Service) processSyncMessagesViaAppAddUsers(syncMessages []syncMsg, rc *model.RemoteCluster, response remotecluster.Response) (postErrors []string, lastUpdate int64, err error) {
	var channel *model.Channel
	postErrors = make([]string, 0)

	for _, sm := range syncMessages {

		// TODO: modify perma-links (MM-31596)

		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Sync post received",
			mlog.String("post_id", sm.Post.Id),
			mlog.String("channel_id", sm.Post.ChannelId),
			mlog.Int("reaction_count", len(sm.Reactions)))

		if channel == nil {
			if channel, err = scs.server.GetStore().Channel().Get(sm.Post.ChannelId, true); err != nil {
				// if the channel doesn't exist then none of these sync messages are going to work.
				return postErrors, 0, fmt.Errorf("channel not found processing sync messages: %w", err)
			}
		}

		var appErr *model.AppError
		rpost, err := scs.server.GetStore().Post().GetSingle(sm.Post.Id)
		if err != nil || rpost == nil {
			// post doesn't exist; create new one
			rpost, appErr = scs.app.CreatePost(sm.Post, channel, true, true)
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Creating sync post",
				mlog.String("post_id", sm.Post.Id),
				mlog.String("channel_id", sm.Post.ChannelId))
		} else {
			// update post
			rpost, appErr = scs.app.UpdatePost(sm.Post, false)
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Updating sync post",
				mlog.String("post_id", sm.Post.Id),
				mlog.String("channel_id", sm.Post.ChannelId))
		}

		if appErr != nil {
			postErrors = append(postErrors, sm.Post.Id)
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error creating/updating sync post",
				mlog.String("post_id", sm.Post.Id),
				mlog.String("channel_id", sm.Post.ChannelId),
				mlog.Err(appErr))
			continue
		}

		for _, reaction := range sm.Reactions {
			// userid won't exist on this server
			reaction.UserId = ""
			if err := scs.server.GetStore().SharedChannel().UpsertReaction(reaction); err != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error saving sync Reaction",
					mlog.String("remote", rc.DisplayName),
					mlog.String("ChannelId", sm.Post.ChannelId),
					mlog.String("PostId", sm.Post.Id),
					mlog.Err(err),
				)
			}
		}
		lastUpdate = rpost.UpdateAt
	}
	return postErrors, lastUpdate, nil
}
*/
