// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

type syncTask struct {
	id         string
	channelID  string
	remoteID   string
	AddedAt    time.Time
	retryCount int
	retryMsg   *model.SyncMsg
	schedule   time.Time
}

func newSyncTask(channelID string, remoteID string, retryMsg *model.SyncMsg) syncTask {
	var retryID string
	if retryMsg != nil {
		retryID = retryMsg.Id
	}

	return syncTask{
		id:        channelID + remoteID + retryID, // combination of ids to avoid duplicates
		channelID: channelID,
		remoteID:  remoteID, // empty means update all remote clusters
		retryMsg:  retryMsg,
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
func (scs *Service) NotifyChannelChanged(channelID string) {
	if rcs := scs.server.GetRemoteClusterService(); rcs == nil {
		return
	}

	task := newSyncTask(channelID, "", nil)
	task.schedule = time.Now().Add(NotifyMinimumDelay)
	scs.addTask(task)
}

// NotifyUserProfileChanged is called to indicate that a user belonging to at least one
// shared channel has modified their user profile (name, username, email, custom status, profile image)
func (scs *Service) NotifyUserProfileChanged(userID string) {
	if rcs := scs.server.GetRemoteClusterService(); rcs == nil {
		return
	}

	scusers, err := scs.server.GetStore().SharedChannel().GetUsersForUser(userID)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to fetch shared channel users",
			mlog.String("userID", userID),
			mlog.Err(err),
		)
		return
	}
	if len(scusers) == 0 {
		return
	}

	notified := make(map[string]struct{})

	for _, user := range scusers {
		// update every channel + remote combination they belong to.
		// Redundant updates (ie. to same remote for multiple channels) will be
		// filtered out.
		combo := user.ChannelId + user.RemoteId
		if _, ok := notified[combo]; ok {
			continue
		}
		notified[combo] = struct{}{}
		task := newSyncTask(user.ChannelId, user.RemoteId, nil)
		task.schedule = time.Now().Add(NotifyMinimumDelay)
		scs.addTask(task)
	}
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
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to fetch shared channel remotes",
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
	metrics := scs.server.GetMetrics()

	if metrics != nil {
		scs.mux.Lock()
		size := len(scs.tasks)
		scs.mux.Unlock()
		metrics.ObserveSharedChannelsQueueSize(int64(size))
	}

	for {
		task, ok, shortestWait = scs.removeOldestTask()
		if !ok {
			break
		}

		if metrics != nil {
			metrics.ObserveSharedChannelsTaskInQueueDuration(time.Since(task.AddedAt).Seconds())
		}

		if err := scs.processTask(task); err != nil {
			// put task back into map so it will update again
			if task.incRetry() {
				scs.addTask(task)
			} else {
				scs.server.Log().Error("Failed to synchronize shared channel",
					mlog.String("channelId", task.channelID),
					mlog.String("remoteId", task.remoteID),
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
	// map is used to ensure remotes don't get sync'd twice, such as when
	// they have the autoinvited flag and have explicitly subscribed to a channel.
	remotesMap := make(map[string]*model.RemoteCluster)

	if task.remoteID == "" {
		filter := model.RemoteClusterQueryFilter{
			InChannel:     task.channelID,
			OnlyConfirmed: true,
		}
		remotes, err := scs.server.GetStore().RemoteCluster().GetAll(filter)
		if err != nil {
			return err
		}
		for _, r := range remotes {
			remotesMap[r.RemoteId] = r
		}

		// add all remotes that have the autoinvited option.
		filter = model.RemoteClusterQueryFilter{
			RequireOptions: model.BitflagOptionAutoInvited,
		}
		remotesAutoInvited, err := scs.server.GetStore().RemoteCluster().GetAll(filter)
		if err != nil {
			return err
		}
		for _, r := range remotesAutoInvited {
			remotesMap[r.RemoteId] = r
		}
	} else {
		rc, err := scs.server.GetStore().RemoteCluster().Get(task.remoteID)
		if err != nil {
			return err
		}
		if !rc.IsOnline() {
			return fmt.Errorf("Failed updating shared channel '%s' for offline remote cluster '%s'", task.channelID, rc.DisplayName)
		}
		remotesMap[rc.RemoteId] = rc
	}

	for _, rc := range remotesMap {
		rtask := task
		rtask.remoteID = rc.RemoteId
		if err := scs.syncForRemote(rtask, rc); err != nil {
			// retry...
			if rtask.incRetry() {
				scs.addTask(rtask)
			} else {
				scs.server.Log().Error("Failed to synchronize shared channel for remote cluster",
					mlog.String("channelId", rtask.channelID),
					mlog.String("remote", rc.DisplayName),
					mlog.Err(err),
				)
			}
		}
	}
	return nil
}

func (scs *Service) handlePostError(postId string, task syncTask, rc *model.RemoteCluster) {
	if task.retryMsg != nil && len(task.retryMsg.Posts) == 1 && task.retryMsg.Posts[0].Id == postId {
		// this was a retry for specific post that failed previously. Try again if within MaxRetries.
		if task.incRetry() {
			scs.addTask(task)
		} else {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "error syncing post",
				mlog.String("remote", rc.DisplayName),
				mlog.String("post_id", postId),
			)
		}
		return
	}

	// this post failed as part of a group of posts. Retry as an individual post.
	post, err := scs.server.GetStore().Post().GetSingle(postId, true)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "error fetching post for sync retry",
			mlog.String("remote", rc.DisplayName),
			mlog.String("post_id", postId),
		)
		return
	}

	syncMsg := model.NewSyncMsg(task.channelID)
	syncMsg.Posts = []*model.Post{post}

	scs.addTask(newSyncTask(task.channelID, task.remoteID, syncMsg))
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
				Message:   T("sharedchannel.cannot_deliver_post", map[string]any{"Remote": rc.DisplayName}),
				CreateAt:  post.CreateAt + 1,
			}
			scs.app.SendEphemeralPost(request.EmptyContext(scs.server.Log()), post.UserId, ephemeral)

			notified[post.UserId] = true
		}
	}
}

func (scs *Service) updateCursorForRemote(scrId string, rc *model.RemoteCluster, cursor model.GetPostsSinceForSyncCursor) {
	if err := scs.server.GetStore().SharedChannel().UpdateRemoteCursor(scrId, cursor); err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "error updating cursor for shared channel remote",
			mlog.String("remote", rc.DisplayName),
			mlog.Err(err),
		)
		return
	}
	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "updated cursor for remote",
		mlog.String("remote_id", rc.RemoteId),
		mlog.String("remote", rc.DisplayName),
		mlog.Int("last_post_create_at", cursor.LastPostCreateAt),
		mlog.String("last_post_create_id", cursor.LastPostCreateID),
		mlog.Int("last_post_update_at", cursor.LastPostUpdateAt),
		mlog.String("last_post_update_id", cursor.LastPostUpdateID),
	)
}

func (scs *Service) getUserTranslations(userId string) i18n.TranslateFunc {
	var locale string
	user, err := scs.server.GetStore().User().Get(context.Background(), userId)
	if err == nil {
		locale = user.Locale
	}

	if locale == "" {
		locale = model.DefaultLocale
	}
	return i18n.GetUserTranslations(locale)
}

// shouldUserSync determines if a user needs to be synchronized.
// User should be synchronized if it has no entry in the SharedChannelUsers table for the specified channel,
// or there is an entry but the LastSyncAt is less than user.UpdateAt
func (scs *Service) shouldUserSync(user *model.User, channelID string, rc *model.RemoteCluster) (sync bool, syncImage bool, err error) {
	// don't sync users with the remote they originated from.
	if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
		return false, false, nil
	}

	scu, err := scs.server.GetStore().SharedChannel().GetSingleUser(user.Id, channelID, rc.RemoteId)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return false, false, err
		}

		// user not in the SharedChannelUsers table, so we must add them.
		scu = &model.SharedChannelUser{
			UserId:    user.Id,
			RemoteId:  rc.RemoteId,
			ChannelId: channelID,
		}
		if _, err = scs.server.GetStore().SharedChannel().SaveUser(scu); err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error adding user to shared channel users",
				mlog.String("user_id", user.Id),
				mlog.String("channel_id", user.Id),
				mlog.String("remote_id", rc.RemoteId),
				mlog.Err(err),
			)
		} else {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Added user to shared channel users",
				mlog.String("user_id", user.Id),
				mlog.String("channel_id", user.Id),
				mlog.String("remote_id", rc.RemoteId),
			)
		}
		return true, true, nil
	}

	return user.UpdateAt > scu.LastSyncAt, user.LastPictureUpdate > scu.LastSyncAt, nil
}

func (scs *Service) syncProfileImage(user *model.User, channelID string, rc *model.RemoteCluster) {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return
	}

	if rc.IsPlugin() {
		scs.sendProfileImageToPlugin(user, channelID, rc)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), ProfileImageSyncTimeout)
	defer cancel()

	rcs.SendProfileImage(ctx, user.Id, rc, scs.app, func(userId string, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
		if resp.IsSuccess() {
			scs.recordProfileImageSuccess(user.Id, channelID, rc.RemoteId)
			return
		}

		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error synchronizing users profile image",
			mlog.String("user_id", user.Id),
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(err),
		)
	})
}

func (scs *Service) sendProfileImageToPlugin(user *model.User, channelID string, rc *model.RemoteCluster) {
	if err := scs.app.OnSharedChannelsProfileImageSyncMsg(user, rc); err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error synchronizing users profile image for plugin",
			mlog.String("user_id", user.Id),
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(err),
		)
	}
	scs.recordProfileImageSuccess(user.Id, channelID, rc.RemoteId)
}

func (scs *Service) recordProfileImageSuccess(userID, channelID, remoteID string) {
	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Users profile image synchronized",
		mlog.String("user_id", userID),
		mlog.String("channel_id", channelID),
		mlog.String("remote_id", remoteID),
	)

	// update LastSyncAt for user in SharedChannelUsers table
	if err := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(userID, channelID, remoteID); err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error updating users LastSyncTime after profile image update",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
			mlog.Err(err),
		)
	}
}
