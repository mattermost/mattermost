// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type syncTask struct {
	id         string
	channelId  string
	remoteId   string
	AddedAt    time.Time
	retryCount int
}

func newSyncTask(channelId string, remoteId string) syncTask {
	return syncTask{
		id:        channelId + remoteId, // combination of channelId and remoteId to avoid duplicates
		channelId: channelId,
		remoteId:  remoteId,   // empty means update all remote clusters
		AddedAt:   time.Now(), // entries can be sorted oldest to newest
	}
}

// NotifyChannelChanged is called to indicate that a shared channel has been modified,
// thus triggering an update to all remote clusters.
func (scs *Service) NotifyChannelChanged(channelId string) {
	task := newSyncTask(channelId, "")
	scs.addTask(task)
}

func (scs *Service) addTask(task syncTask) {
	scs.mux.Lock()
	if _, ok := scs.tasks[task.id]; !ok {
		scs.tasks[task.id] = task
	}
	scs.mux.Unlock()

	// wake up the sync goroutine
	select {
	case scs.changeSignal <- struct{}{}:
	default:
		// that's ok, the sync routine is already busy
	}
}

// syncLoop creates a pool of goroutines which wait for notifications of channel changes and
// updates each remote based on those changes.
func (scs *Service) syncLoop(done chan struct{}) {
	// wait for channel changed signal and update for oldest channel id.
	for {
		select {
		case <-scs.changeSignal:
			for {
				task, ok := scs.removeOldestTask()
				if !ok {
					break
				}
				if err := scs.processTask(task); err != nil {
					scs.server.GetLogger().Error("Failed to update shared channel", mlog.String("channelId", task.channelId), mlog.String("remoteId", task.remoteId), mlog.Err(err))
					// put task back into map so it will update again
					scs.addTask(task)
				}
			}
		case <-done:
			return
		}
	}
}

// removeOldestTask removes and returns the oldest task in the task map.
// If no tasks are available then false is returned.
func (scs *Service) removeOldestTask() (syncTask, bool) {
	scs.mux.Lock()
	defer scs.mux.Unlock()

	var oldestTask syncTask
	var oldestKey string

	for k, v := range scs.tasks {
		if v.AddedAt.Before(oldestTask.AddedAt) || oldestTask.AddedAt.IsZero() {
			oldestKey = k
			oldestTask = v
		}
	}

	if oldestKey != "" {
		delete(scs.tasks, oldestKey)
		return oldestTask, true
	}
	return oldestTask, false
}

// processTask updates one or more remote clusters with any new channel content.
func (scs *Service) processTask(task syncTask) error {
	var err error
	var remotes []*model.RemoteCluster

	if task.remoteId == "" {
		filter := model.RemoteClusterQueryFilter{
			InChannel:     task.channelId,
			OnlyConfirmed: true,
		}
		remotes, err = scs.server.GetStore().RemoteCluster().GetAll(filter)
		if err != nil {
			return err
		}
	} else {
		rc, err := scs.server.GetStore().RemoteCluster().Get(task.remoteId)
		if err != nil {
			return err
		}
		if !rc.IsOnline() {
			return fmt.Errorf("Failed updating shared channel '%s' for offline remote cluster '%s'", task.channelId, rc.DisplayName)
		}
		remotes = []*model.RemoteCluster{rc}
	}

	errs := merror.New()
	for _, rc := range remotes {
		if err := scs.updateForRemote(task.channelId, rc); err != nil {
			errs.Append(err)
			// retry...
			if task.retryCount < MaxRetries {
				retryTask := newSyncTask(task.channelId, rc.RemoteId)
				retryTask.retryCount = task.retryCount + 1
				scs.addTask(retryTask)
			}
		}
	}
	return errs.ErrorOrNil()
}

// updateForRemote updates a remote cluster with any new posts/reactions for a specific
// channel. If many changes are found, only the oldest X changes are sent and the channel
// is re-added to the task map. This ensures no channels are starved for updates even if some
// channels are very active.
func (scs *Service) updateForRemote(channelId string, rc *model.RemoteCluster) error {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return fmt.Errorf("cannot update remote cluster for channel id %s; Remote Cluster Service not enabled", channelId)
	}

	scr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(channelId, rc.RemoteId)
	if err != nil {
		return err
	}

	opts := model.GetPostsSinceOptions{
		ChannelId:     channelId,
		Time:          scr.LastSyncAt,
		SortAscending: true,
	}
	posts, err := scs.server.GetStore().Post().GetPostsSince(opts, true)
	if err != nil {
		return err
	}

	var repeat bool

	pSlice := posts.ToSlice()
	max := len(pSlice)
	if max > MaxPostsPerSync {
		max = MaxPostsPerSync
		repeat = true
	}

	if !rc.IsOnline() {
		scs.notifyRemoteOffline(pSlice, rc)
		return nil
	}

	msg, err := scs.postsToMsg(pSlice[:max], rc, scr.LastSyncAt)
	if err != nil {
		return err
	}

	if len(msg.Payload) == 0 {
		// everything was filtered out, nothing to send.
		if repeat {
			contTask := newSyncTask(channelId, rc.RemoteId)
			scs.addTask(contTask)
		}
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	err = rcs.SendMsg(ctx, msg, rc, func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp remotecluster.Response, err error) {
		if err != nil {
			return
		}

		//
		// TODO: Any Post(s) that failed to save on remote side are included in an array of post ids in the Response payload.
		//       Write ephemeral message to post author notifying for each post that failed, perhaps after X retries.
		//

		var syncResp SyncResponse
		if err2 := json.Unmarshal(resp.Payload, &syncResp); err2 != nil {
			scs.server.GetLogger().Warn("invalid sync response after update shared channel",
				mlog.String("remote", rc.DisplayName),
				mlog.Err(err2),
			)
		}

		// LastSyncAt will be zero if nothing got updated
		if syncResp.LastSyncAt == 0 {
			return
		}

		// update SharedChannelRemote's LastSyncAt if send was successful
		if rerr := scs.server.GetStore().SharedChannel().UpdateRemoteLastSyncAt(scr.Id, syncResp.LastSyncAt); rerr != nil {
			scs.server.GetLogger().Warn("error updating LastSyncAt for shared channel remote",
				mlog.String("remote", rc.DisplayName),
				mlog.Err(rerr),
			)
		} else {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "updated lastSyncAt for remote",
				mlog.String("remote_id", rc.RemoteId),
				mlog.String("remote", rc.DisplayName),
				mlog.Int64("last_update_at", syncResp.LastSyncAt),
			)
		}

		// update LastSyncAt for all the users that were synchronized
		if rerr := scs.updateSyncUsers(syncResp.UsersSyncd, rc, syncResp.LastSyncAt); rerr != nil {
			scs.server.GetLogger().Warn("invalid last sync response (ResponseUsersSynced) after update shared channel",
				mlog.String("remote", rc.DisplayName),
				mlog.Err(rerr),
			)
		}
	})

	if err == nil && repeat {
		contTask := newSyncTask(channelId, rc.RemoteId)
		scs.addTask(contTask)
	}
	return err
}

// notifyRemoteOffline creates an ephemeral post to the author for any posts created recently.
func (scs *Service) notifyRemoteOffline(posts []*model.Post, rc *model.RemoteCluster) {
	// only send one ephemeral post per author.
	notified := make(map[string]bool)

	// range the slice in reverse so the newest posts are visited first; this ensures an ephemeral
	// get added where it is mostly likely to be seen.
	for i := len(posts) - 1; i >= 0; i-- {
		post := posts[i]
		if didNotify := notified[post.UserId]; didNotify {
			continue
		}

		postCreateAt := model.GetTimeForMillis(post.CreateAt)

		if post.DeleteAt == 0 && post.UserId != "" && time.Since(postCreateAt) < NotifyRemoteOfflineThreshold {
			T := scs.getUserTranslations(post.UserId)
			ephemeral := &model.Post{
				ChannelId: post.ChannelId,
				Message:   T("sharedchannel.cannot_deliver_post", map[string]interface{}{"Remote": rc.DisplayName}),
				CreateAt:  post.CreateAt + 1,
			}
			scs.app.SendEphemeralPost(post.UserId, ephemeral)

			notified[post.UserId] = true
		}
	}
}

func (scs *Service) updateSyncUsers(userIds []string, rc *model.RemoteCluster, lastSyncAt int64) error {
	merrs := merror.New()
	for _, uid := range userIds {
		scu, err := scs.server.GetStore().SharedChannel().GetUser(uid, rc.RemoteId)
		if err != nil {
			merrs.Append(err)
			continue
		}

		if err := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(scu.Id, lastSyncAt); err != nil {
			merrs.Append(err)
		} else {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "updated lastSyncAt for user",
				mlog.String("user_id", scu.UserId), mlog.Int64("last_update_at", lastSyncAt))
		}
	}
	return merrs.ErrorOrNil()
}

func (scs *Service) getUserTranslations(userId string) i18n.TranslateFunc {
	var locale string
	user, err := scs.server.GetStore().User().Get(userId)
	if err == nil {
		locale = user.Locale
	}

	if locale == "" {
		locale = model.DEFAULT_LOCALE
	}
	return utils.GetUserTranslations(locale)
}
