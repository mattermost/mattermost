// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	postReadStatusBufferSize     = sendQueueSize * 100
	postReadStatusFlushThreshold = postReadStatusBufferSize / 8
	postReadStatusBatchInterval  = 500 * time.Millisecond
)

// QueuePostReadStatus enqueues post read status entries for bulk writing.
func (ps *PlatformService) QueuePostReadStatus(postIDs []string, userID string) {
	now := model.GetMillis()
	for _, postID := range postIDs {
		status := &model.PostReadStatus{
			PostId:   postID,
			UserId:   userID,
			CreateAt: now,
		}
		select {
		case ps.postReadStatusChan <- status:
		default:
			ps.Log().Warn("Post read status channel is full. Falling back to direct write.")
			statuses := make([]*model.PostReadStatus, 0, len(postIDs))
			for _, pid := range postIDs {
				statuses = append(statuses, &model.PostReadStatus{
					PostId:   pid,
					UserId:   userID,
					CreateAt: now,
				})
			}
			if err := ps.Store.PostReadStatus().SaveMultiple(statuses); err != nil {
				ps.Log().Warn("Failed to save post read statuses directly", mlog.Err(err))
			}
			return
		}
	}
}

// processPostReadStatusUpdates processes post read status updates in batches.
func (ps *PlatformService) processPostReadStatusUpdates() {
	defer close(ps.postReadStatusDoneSignal)

	type key struct {
		postID string
		userID string
	}
	batch := make(map[key]*model.PostReadStatus)
	ticker := time.NewTicker(postReadStatusBatchInterval)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}

		statuses := make([]*model.PostReadStatus, 0, len(batch))
		for _, s := range batch {
			statuses = append(statuses, s)
		}

		if err := ps.Store.PostReadStatus().SaveMultiple(statuses); err != nil {
			ps.Log().Warn("Failed to save post read statuses", mlog.Err(err))
		}

		clear(batch)
	}

	for {
		select {
		case status := <-ps.postReadStatusChan:
			k := key{postID: status.PostId, userID: status.UserId}
			batch[k] = status

			if len(batch) >= postReadStatusFlushThreshold {
				flush()
			}
		case <-ticker.C:
			flush()
		case <-ps.postReadStatusExitSignal:
			flush()
			return
		}
	}
}
