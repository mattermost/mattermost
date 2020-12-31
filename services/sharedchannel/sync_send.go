// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"fmt"
	"time"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/wiggin77/merror"
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
	go func() {
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
	}()
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

	cache := make(msgCache)
	errs := merror.New()
	for _, rc := range remotes {
		if err := scs.updateForRemote(task.channelId, rc, cache); err != nil {
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
func (scs *Service) updateForRemote(channelId string, rc *model.RemoteCluster, cache msgCache) error {
	scr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(channelId, rc.RemoteId)
	if err != nil {
		return err
	}

	opts := model.GetPostsSinceOptions{
		ChannelId: channelId,
		Time:      scr.LastSyncAt,
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

	msg, err := scs.postsToMsg(pSlice[:max], cache)
	if err != nil {
		return err
	}

	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return fmt.Errorf("cannot update remote cluster for channel id %s; Remote Cluster Service not enabled", channelId)
	}

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	err = rcs.SendMsg(ctx, msg, rc, func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp remotecluster.Response, err error) {
		if err != nil {
			return
		}

		// TODO: Any Post(s) that failed to save on remote side are included in an array of Post ids in syncResponse[ResponsePostErrors].
		//       Write ephemeral message to post author notifying for each post that failed.

		// update SharedChannelRemote's LastSyncAt if send was successful
		ls := resp[ResponseLastUpdateAt]
		lastSync, ok := ls.(int64)
		if !ok || lastSync == 0 {
			scs.server.GetLogger().Error("invalid last sync response after update shared channel",
				mlog.String("remote", rc.DisplayName), mlog.Err(err), mlog.Any("last_update_at", ls))
			return
		}

		if err := scs.server.GetStore().SharedChannel().UpdateRemoteLastSyncAt(rc.RemoteId, lastSync); err != nil {
			scs.server.GetLogger().Error("error updating LastSyncAt for shared channel remote", mlog.String("remote", rc.DisplayName), mlog.Err(err))
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
	notified := make(map[string]struct{})

	// range the slice in reverse so the newest posts are visited first; this ensures an ephemeral
	// get added where it is mostly likely to be seen.
	for i := len(posts) - 1; i >= 0; i-- {
		post := posts[i]
		if _, ok := notified[post.UserId]; ok {
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

			notified[post.UserId] = struct{}{}
		}
	}
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
