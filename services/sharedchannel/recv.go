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

func (scs *Service) OnReceiveSyncMessage(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response remotecluster.Response) error {
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

	var lastUpdate int64
	postErrors := make([]string, 0)

	for _, sm := range syncMessages {

		// TODO: modify perma-links (MM-31596)

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

	if len(postErrors) > 0 {
		response[ResponsePostErrors] = postErrors
	}
	response[ResponseLastUpdateAt] = lastUpdate

	return nil
}
