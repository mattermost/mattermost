// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

const MaxNumberOfPostToIndex = 10000
const ChannelsPerChunk = 10

/*
Populate Threads migration strategy
1. Store start timestamp
2. Split all channels into chunks (max CHANNELS_PER_CHUNK)
	2.1 For each channel, collect last MAX_NUMBER_OF_POSTS_TO_INDEX posts
	2.2 For each channel, take all memberships
		For each membership (userid/channelid pair) - find all threads where that user is mentioned and create ThreadMembership/Thread
3. Once all is done
	3.1 Store new start timestamp
	3.2 If there are new posts since previous start timestamp, process the channel in which that post was created by running 2.2
4. Re-run 3 maybe?
5. Recalculate total_msg_count_root, msg_count_root, mention_count_root for Channels/ChannelMembers
*/

type PopulateThreadsProgress struct {
	Timestamp     time.Time `json:"start_time"`
	Stage         string    `json:"stage"`
	LastChannelId string    `json:"last_channel_id"`
}

func (p *PopulateThreadsProgress) ToJson() string {
	b, _ := json.Marshal(p)
	return string(b)
}

func PopulateThreadsProgressFromJson(data io.Reader) *PopulateThreadsProgress {
	var o *PopulateThreadsProgress
	json.NewDecoder(data).Decode(&o)
	return o
}

func (p *PopulateThreadsProgress) IsValid() bool {
	if !model.IsValidId(p.LastChannelId) {
		return false
	}

	switch p.Stage {
	case "Channels":
	case "Cleanup":
	case "Recalc":
	default:
		return false
	}

	return true
}

func createThread(sqlStore store.Store, posts *model.PostList, channelID, threadID string) (*model.Thread, error) {
	var participants []string
	lastReply := int64(0)
	replyCount := int64(0)
	// posts are ordered in descending order, so the first post we find as part of the thread is the oldest one
	for _, id := range posts.Order {
		if posts.Posts[id].RootId == threadID {
			lastReply = posts.Posts[id].CreateAt
			break
		}
	}
	for _, post := range posts.Posts {
		if post.RootId == threadID {
			replyCount += 1
		}
	}
	return sqlStore.Thread().Save(&model.Thread{
		PostId:       threadID,
		ChannelId:    channelID,
		ReplyCount:   replyCount,
		LastReplyAt:  lastReply,
		Participants: participants,
	})

}
func migrateChunk(sqlStore store.Store, a *app.App, lastChannelId string) (string, error) {
	var err error
	channels, err := sqlStore.Channel().GetAllChannelsForExportAfter(ChannelsPerChunk, lastChannelId)
	if err != nil {
		return "", err
	}
	if len(channels) < 1 {
		return "", nil
	}
	for _, channel := range channels {
		team, err := sqlStore.Team().Get(channel.TeamId)
		if err != nil {
			return "", err
		}
		oldMax := model.MAX_POSTS_TO_FETCH
		model.MAX_POSTS_TO_FETCH = MaxNumberOfPostToIndex
		posts, err := sqlStore.Post().GetPosts(model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: MaxNumberOfPostToIndex - 1}, true)
		model.MAX_POSTS_TO_FETCH = oldMax
		if err != nil {
			return "", err
		}
		memberships, err := sqlStore.Channel().GetMembers(channel.Id, 0, 10000)
		if err != nil {
			return "", err
		}
		profileMap, err := sqlStore.User().GetAllProfilesInChannel(context.Background(), channel.Id, true)
		channelMemberNotifyPropsMap, err := sqlStore.Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
		groups, err := a.GetGroupsAllowedForReferenceInChannel(&channel.Channel, team)
		isUserMentioned := func(p *model.Post, userID string) bool {
			allowChannelMentions := a.AllowChannelMentions(p, len(profileMap))
			keywords := a.GetMentionKeywordsInChannel(profileMap, allowChannelMentions, channelMemberNotifyPropsMap)
			mentions := app.GetExplicitMentions(p, keywords, groups)
			_, ok := mentions.Mentions[userID]
			return ok
		}
		for _, membership := range *memberships {
			membership := membership
			for _, post := range posts.Posts {
				// if it's a reply and user is mentioned in it or it the parent post
				// or they are the author
				userMentionedInPost := isUserMentioned(post, membership.UserId)
				if post.RootId != "" &&
					((userMentionedInPost || isUserMentioned(posts.Posts[post.RootId], membership.UserId)) ||
						post.UserId == membership.UserId) {
					// create the thread if it doesn't exist
					if _, err = sqlStore.Thread().Get(post.RootId); err != nil {
						if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
							return "", err
						}

						if _, err = createThread(sqlStore, posts, post.RootId, channel.Id); err != nil {
							return "", err
						}
					}
					// create/update membership
					_, err = sqlStore.Thread().MaintainMembership(membership.UserId, post.RootId, true, userMentionedInPost, true, false, true)
					if err != nil {
						return "", err
					}
				}
			}
			_, err = sqlStore.Channel().UpdateMember(&membership)
			if err != nil {
				return "", err
			}
		}
	}
	return channels[len(channels)-1].Id, nil
}

func (worker *Worker) runPopulateThreadsMigration(lastDone string) (bool, string, *model.AppError) {
	var progress *PopulateThreadsProgress
	if lastDone == "" {
		// Haven't started the migration yet.
		progress = new(PopulateThreadsProgress)
		progress.Stage = "Channels"
		progress.LastChannelId = strings.Repeat("0", 26)
	} else {
		progress = PopulateThreadsProgressFromJson(strings.NewReader(lastDone))
		if !progress.IsValid() {
			return false, "", model.NewAppError("MigrationsWorker.runPopulateThreadsMigration", "migrations.worker.runPopulateThreadsMigration.invalid_progress", map[string]interface{}{"progress": progress.ToJson()}, "", http.StatusInternalServerError)
		}
	}

	if progress.Stage == "Channels" {
		// Run a TeamMembers migration batch.
		result, err := migrateChunk(worker.srv.Store, worker.app, progress.LastChannelId)
		if err != nil {
			return false, progress.ToJson(), model.NewAppError("MigrationsWorker.runPopulateThreadsMigration", "app.team.migrate_team_members.update.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if result == "" {
			// We haven't progressed. That means that we've reached the end of this stage of the migration, and should now advance to the next stage.
			progress.LastChannelId = strings.Repeat("0", 26)
			progress.Stage = "Cleanup"
			return false, progress.ToJson(), nil
		}

		progress.LastChannelId = result
	} else if progress.Stage == "Cleanup" {
		progress.Stage = "Recalc"
		return false, progress.ToJson(), nil
	} else if progress.Stage == "Recalc" {
		worker.srv.Store.Thread().RootCountMigration()
		return true, progress.ToJson(), nil
	}

	return false, progress.ToJson(), nil
}
