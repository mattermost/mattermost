// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

type syncTask struct {
	id         string
	channelId  string
	remoteId   string
	AddedAt    time.Time
	retryCount int
	retryPost  *model.Post
	schedule   time.Time
}

func newSyncTask(channelId string, remoteId string, retryPost *model.Post) syncTask {
	var postId string
	if retryPost != nil {
		postId = retryPost.Id
	}

	return syncTask{
		id:        channelId + remoteId + postId, // combination of ids to avoid duplicates
		channelId: channelId,
		remoteId:  remoteId, // empty means update all remote clusters
		retryPost: retryPost,
		schedule:  time.Now(),
	}
}

// incRetry increments the retry counter and returns true if MaxRetries not exceeded.
func (st *syncTask) incRetry() bool {
	st.retryCount++
	return st.retryCount <= MaxRetries
}

// NotifyChannelChanged is called to indicate that a shared channel has been modified,
// thus triggering an update to all remote clusters.
func (scs *Service) NotifyChannelChanged(channelId string) {
	if rcs := scs.server.GetRemoteClusterService(); rcs == nil {
		return
	}

	task := newSyncTask(channelId, "", nil)
	task.schedule = time.Now().Add(NotifyMinimumDelay)
	scs.addTask(task)
}

// ForceSyncForRemote causes all channels shared with the remote to be synchronized.
func (scs *Service) ForceSyncForRemote(rc *model.RemoteCluster) {
	if rcs := scs.server.GetRemoteClusterService(); rcs == nil {
		return
	}

	// fetch all channels shared with this remote.
	opts := model.SharedChannelRemoteFilterOpts{
		RemoteId: rc.RemoteId,
	}
	scrs, err := scs.server.GetStore().SharedChannel().GetRemotes(opts)
	if err != nil {
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Failed to fetch shared channel remotes",
			mlog.String("remote", rc.DisplayName),
			mlog.String("remoteId", rc.RemoteId),
			mlog.Err(err),
		)
		return
	}

	for _, scr := range scrs {
		task := newSyncTask(scr.ChannelId, rc.RemoteId, nil)
		task.schedule = time.Now().Add(NotifyMinimumDelay)
		scs.addTask(task)
	}
}

// addTask adds or re-adds a task to the queue.
func (scs *Service) addTask(task syncTask) {
	task.AddedAt = time.Now()
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

// syncLoop is called via a dedicated goroutine to wait for notifications of channel changes and
// updates each remote based on those changes.
func (scs *Service) syncLoop(done chan struct{}) {
	// create a timer to periodically check the task queue, but only if there is
	// a delayed task in the queue.
	delay := time.NewTimer(NotifyMinimumDelay)
	defer stopTimer(delay)

	// wait for channel changed signal and update for oldest task.
	for {
		select {
		case <-scs.changeSignal:
			if wait := scs.doSync(); wait > 0 {
				stopTimer(delay)
				delay.Reset(wait)
			}
		case <-delay.C:
			if wait := scs.doSync(); wait > 0 {
				delay.Reset(wait)
			}
		case <-done:
			return
		}
	}
}

func stopTimer(timer *time.Timer) {
	timer.Stop()
	select {
	case <-timer.C:
	default:
	}
}

// doSync checks the task queue for any tasks to be processed and processes all that are ready.
// If any delayed tasks remain in queue then the duration until the next scheduled task is returned.
func (scs *Service) doSync() time.Duration {
	var task syncTask
	var ok bool
	var shortestWait time.Duration

	for {
		task, ok, shortestWait = scs.removeOldestTask()
		if !ok {
			break
		}
		if err := scs.processTask(task); err != nil {
			// put task back into map so it will update again
			if task.incRetry() {
				scs.addTask(task)
			} else {
				scs.server.GetLogger().Error("Failed to synchronize shared channel",
					mlog.String("channelId", task.channelId),
					mlog.String("remoteId", task.remoteId),
					mlog.Err(err),
				)
			}
		}
	}
	return shortestWait
}

// removeOldestTask removes and returns the oldest task in the task map.
// A task coming in via NotifyChannelChanged must stay in queue for at least
// `NotifyMinimumDelay` to ensure we don't go nuts trying to sync during a bulk update.
// If no tasks are available then false is returned.
func (scs *Service) removeOldestTask() (syncTask, bool, time.Duration) {
	scs.mux.Lock()
	defer scs.mux.Unlock()

	var oldestTask syncTask
	var oldestKey string
	var shortestWait time.Duration

	for key, task := range scs.tasks {
		// check if task is ready
		if wait := time.Until(task.schedule); wait > 0 {
			if wait < shortestWait || shortestWait == 0 {
				shortestWait = wait
			}
			continue
		}
		// task is ready; check if it's the oldest ready task
		if task.AddedAt.Before(oldestTask.AddedAt) || oldestTask.AddedAt.IsZero() {
			oldestKey = key
			oldestTask = task
		}
	}

	if oldestKey != "" {
		delete(scs.tasks, oldestKey)
		return oldestTask, true, shortestWait
	}
	return oldestTask, false, shortestWait
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

	for _, rc := range remotes {
		rtask := task
		rtask.remoteId = rc.RemoteId
		if err := scs.updateForRemote(rtask, rc); err != nil {
			// retry...
			if rtask.incRetry() {
				scs.addTask(rtask)
			} else {
				scs.server.GetLogger().Error("Failed to synchronize shared channel for remote cluster",
					mlog.String("channelId", rtask.channelId),
					mlog.String("remote", rc.DisplayName),
					mlog.String("remoteId", rtask.remoteId),
					mlog.Err(err),
				)
			}
		}
	}
	return nil
}

// updateForRemote updates a remote cluster with any new posts/reactions for a specific
// channel. If many changes are found, only the oldest X changes are sent and the channel
// is re-added to the task map. This ensures no channels are starved for updates even if some
// channels are very active.
func (scs *Service) updateForRemote(task syncTask, rc *model.RemoteCluster) error {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return fmt.Errorf("cannot update remote cluster for channel id %s; Remote Cluster Service not enabled", task.channelId)
	}

	scr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(task.channelId, rc.RemoteId)
	if err != nil {
		return err
	}

	var posts []*model.Post
	var repeat bool
	nextSince := scr.NextSyncAt

	if task.retryPost != nil {
		posts = []*model.Post{task.retryPost}
	} else {
		result, err2 := scs.getPostsSince(task.channelId, rc, scr.NextSyncAt)
		if err2 != nil {
			return err2
		}
		posts = result.posts
		repeat = result.hasMore
		nextSince = result.nextSince
	}

	if len(posts) == 0 {
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "sync task found zero posts; skipping sync",
			mlog.String("remote", rc.DisplayName),
			mlog.String("channel_id", task.channelId),
			mlog.Int64("lastSyncAt", scr.NextSyncAt),
			mlog.Int64("nextSince", nextSince),
			mlog.Bool("repeat", repeat),
		)
		return nil
	}

	scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "sync task found posts to sync",
		mlog.String("remote", rc.DisplayName),
		mlog.String("channel_id", task.channelId),
		mlog.Int64("lastSyncAt", scr.NextSyncAt),
		mlog.Int64("nextSince", nextSince),
		mlog.Int("count", len(posts)),
		mlog.Bool("repeat", repeat),
	)

	if !rc.IsOnline() {
		scs.notifyRemoteOffline(posts, rc)
		return nil
	}

	syncMessages, err := scs.postsToSyncMessages(posts, task.channelId, rc, scr.NextSyncAt)
	if err != nil {
		return err
	}

	if len(syncMessages) == 0 {
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "sync task, all messages filtered out; skipping sync",
			mlog.String("remote", rc.DisplayName),
			mlog.String("channel_id", task.channelId),
			mlog.Bool("repeat", repeat),
		)

		// All posts were filtered out, meaning no need to send them. Fast forward SharedChannelRemote's NextSyncAt.
		scs.updateNextSyncForRemote(scr.Id, rc, nextSince)

		// if there are more posts eligible to sync then schedule another sync
		if repeat {
			scs.addTask(newSyncTask(task.channelId, task.remoteId, nil))
		}
		return nil
	}

	scs.sendAttachments(syncMessages, rc)

	b, err := json.Marshal(syncMessages)
	if err != nil {
		return err
	}
	msg := model.NewRemoteClusterMsg(TopicSync, b)

	if scs.server.GetLogger().IsLevelEnabled(mlog.LvlSharedChannelServiceMessagesOutbound) {
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceMessagesOutbound, "outbound message",
			mlog.String("remote", rc.DisplayName),
			mlog.Int64("NextSyncAt", scr.NextSyncAt),
			mlog.String("msg", string(b)),
		)
	}

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)

	err = rcs.SendMsg(ctx, msg, rc, func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
		defer wg.Done()
		if err != nil {
			return // this means the response could not be parsed; already logged
		}

		var syncResp SyncResponse
		if err2 := json.Unmarshal(resp.Payload, &syncResp); err2 != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "invalid sync response after update shared channel",
				mlog.String("remote", rc.DisplayName),
				mlog.Err(err2),
			)
		}

		// Any Post(s) that failed to save on remote side are included in an array of post ids in the Response payload.
		// Handle each error by retrying the post a fixed number of times before giving up.
		for _, p := range syncResp.PostErrors {
			scs.handlePostError(p, task, rc)
		}

		// update NextSyncAt for all the users that were synchronized
		scs.updateSyncUsers(syncResp.UsersSyncd, task.channelId, rc, nextSince)
	})

	wg.Wait()

	if err == nil {
		// Optimistically update SharedChannelRemote's NextSyncAt; if any posts failed they will be retried.
		scs.updateNextSyncForRemote(scr.Id, rc, nextSince)
	}

	if repeat {
		scs.addTask(newSyncTask(task.channelId, task.remoteId, nil))
	}
	return err
}

func (scs *Service) sendAttachments(syncMessages []syncMsg, rc *model.RemoteCluster) {
	for _, sm := range syncMessages {
		for _, fi := range sm.Attachments {
			if err := scs.sendAttachmentForRemote(fi, sm.Post, rc); err != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "error syncing attachment for post",
					mlog.String("remote", rc.DisplayName),
					mlog.String("post_id", sm.Post.Id),
					mlog.String("file_id", fi.Id),
					mlog.Err(err),
				)
			}
		}
	}
}

func (scs *Service) handlePostError(postId string, task syncTask, rc *model.RemoteCluster) {
	if task.retryPost != nil && task.retryPost.Id == postId {
		// this was a retry for specific post that failed previously. Try again if within MaxRetries.
		if task.incRetry() {
			scs.addTask(task)
		} else {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "error syncing post",
				mlog.String("remote", rc.DisplayName),
				mlog.String("post_id", postId),
			)
		}
		return
	}

	// this post failed as part of a group of posts. Retry as an individual post.
	post, err := scs.server.GetStore().Post().GetSingle(postId, true)
	if err != nil {
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "error fetching post for sync retry",
			mlog.String("remote", rc.DisplayName),
			mlog.String("post_id", postId),
		)
		return
	}
	scs.addTask(newSyncTask(task.channelId, task.remoteId, post))
}

// notifyRemoteOffline creates an ephemeral post to the author for any posts created recently to remotes
// that are offline.
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

func (scs *Service) updateNextSyncForRemote(scrId string, rc *model.RemoteCluster, nextSyncAt int64) {
	if nextSyncAt == 0 {
		return
	}
	if err := scs.server.GetStore().SharedChannel().UpdateRemoteNextSyncAt(scrId, nextSyncAt); err != nil {
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "error updating NextSyncAt for shared channel remote",
			mlog.String("remote", rc.DisplayName),
			mlog.Err(err),
		)
		return
	}
	scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "updated NextSyncAt for remote",
		mlog.String("remote_id", rc.RemoteId),
		mlog.String("remote", rc.DisplayName),
		mlog.Int64("next_update_at", nextSyncAt),
	)
}

func (scs *Service) updateSyncUsers(userIds []string, channelID string, rc *model.RemoteCluster, lastSyncAt int64) {
	for _, uid := range userIds {
		scu, err := scs.server.GetStore().SharedChannel().GetUser(uid, channelID, rc.RemoteId)
		if err != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "error getting user for lastSyncAt update",
				mlog.String("remote", rc.DisplayName),
				mlog.String("user_id", uid),
				mlog.Err(err),
			)
			continue
		}

		if err := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(scu.Id, lastSyncAt); err != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "error updating lastSyncAt for user",
				mlog.String("remote", rc.DisplayName),
				mlog.String("user_id", uid),
				mlog.String("channel_id", channelID),
				mlog.Err(err),
			)
		} else {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "updated lastSyncAt for user",
				mlog.String("remote", rc.DisplayName),
				mlog.String("user_id", scu.UserId),
				mlog.String("channel_id", channelID),
				mlog.Int64("last_update_at", lastSyncAt),
			)
		}
	}
}

func (scs *Service) getUserTranslations(userId string) i18n.TranslateFunc {
	var locale string
	user, err := scs.server.GetStore().User().Get(context.Background(), userId)
	if err == nil {
		locale = user.Locale
	}

	if locale == "" {
		locale = model.DEFAULT_LOCALE
	}
	return i18n.GetUserTranslations(locale)
}
