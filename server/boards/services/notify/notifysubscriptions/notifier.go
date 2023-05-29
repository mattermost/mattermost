// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifysubscriptions

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/permissions"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

const (
	defBlockNotificationFreq = time.Minute * 2
	enqueueNotifyHintTimeout = time.Second * 10
	hintQueueSize            = 20
)

var (
	errEnqueueNotifyHintTimeout = errors.New("enqueue notify hint timed out")
)

// notifier provides block change notifications for subscribers. Block change events are batched
// via notifications hints written to the database so that fewer notifications are sent for active
// blocks.
type notifier struct {
	serverRoot  string
	store       AppAPI
	permissions permissions.PermissionsService
	delivery    SubscriptionDelivery
	logger      mlog.LoggerIFace

	hints chan *model.NotificationHint

	mux  sync.Mutex
	done chan struct{}
}

func newNotifier(params BackendParams) *notifier {
	return &notifier{
		serverRoot:  params.ServerRoot,
		store:       params.AppAPI,
		permissions: params.Permissions,
		delivery:    params.Delivery,
		logger:      params.Logger,
		done:        nil,
		hints:       make(chan *model.NotificationHint, hintQueueSize),
	}
}

func (n *notifier) start() {
	n.mux.Lock()
	defer n.mux.Unlock()

	if n.done == nil {
		n.done = make(chan struct{})
		go n.loop()
	}
}

func (n *notifier) stop() {
	n.mux.Lock()
	defer n.mux.Unlock()

	if n.done != nil {
		close(n.done)
		n.done = nil
	}
}

func (n *notifier) loop() {
	done := n.done
	var nextNotify time.Time

	for {
		hint, err := n.store.GetNextNotificationHint(false)
		switch {
		case model.IsErrNotFound(err):
			// no hints in table; wait up to an hour or when `onNotifyHint` is called again
			nextNotify = time.Now().Add(time.Hour * 1)
			n.logger.Debug("notify loop - no hints in queue", mlog.Time("next_check", nextNotify))
		case err != nil:
			// try again in a minute
			nextNotify = time.Now().Add(time.Minute * 1)
			n.logger.Error("notify loop - error fetching next notification", mlog.Err(err))
		case hint.NotifyAt > utils.GetMillis():
			// next hint is not ready yet; sleep until hint.NotifyAt
			nextNotify = utils.GetTimeForMillis(hint.NotifyAt)
		default:
			// it's time to notify
			n.notify()
			continue
		}

		n.logger.Debug("subscription notifier loop",
			mlog.Time("next_notify", nextNotify),
		)

		select {
		case <-n.hints:
			// A new hint was added. Wake up and check if next hint is ready to go.
		case <-time.After(time.Until(nextNotify)):
			// Next scheduled hint should be ready now.
		case <-done:
			return
		}
	}
}

func (n *notifier) onNotifyHint(hint *model.NotificationHint) error {
	n.logger.Debug("onNotifyHint - enqueing hint", mlog.Any("hint", hint))

	select {
	case n.hints <- hint:
	case <-time.After(enqueueNotifyHintTimeout):
		return errEnqueueNotifyHintTimeout
	}
	return nil
}

func (n *notifier) notify() {
	var hint *model.NotificationHint
	var err error

	hint, err = n.store.GetNextNotificationHint(true)
	if err != nil {
		if model.IsErrNotFound(err) {
			// Expected when multiple nodes in a cluster try to process the same hint at the same time.
			// This simply means the other node won. Returning here will simply try fetching another hint.
			return
		}
		n.logger.Error("notify - error fetching next notification", mlog.Err(err))
		return
	}

	if err = n.notifySubscribers(hint); err != nil {
		n.logger.Error("Error notifying subscribers", mlog.Err(err))
	}
}

func (n *notifier) notifySubscribers(hint *model.NotificationHint) error {
	// 	get the subscriber list
	subs, err := n.store.GetSubscribersForBlock(hint.BlockID)
	if err != nil {
		return err
	}
	if len(subs) == 0 {
		n.logger.Debug("notifySubscribers - no subscribers", mlog.Any("hint", hint))
		return nil
	}

	// subs slice is sorted by `NotifiedAt`, therefore subs[0] contains the oldest NotifiedAt needed
	oldestNotifiedAt := subs[0].NotifiedAt

	// need the block's board and card.
	board, card, err := n.store.GetBoardAndCardByID(hint.BlockID)
	if err != nil || board == nil || card == nil {
		return fmt.Errorf("could not get board & card for block %s: %w", hint.BlockID, err)
	}

	n.logger.Debug("notifySubscribers - subscribers",
		mlog.Any("hint", hint),
		mlog.String("board_id", board.ID),
		mlog.String("card_id", card.ID),
		mlog.Int("sub_count", len(subs)),
	)

	dg := &diffGenerator{
		board:        board,
		card:         card,
		store:        n.store,
		hint:         hint,
		lastNotifyAt: oldestNotifiedAt,
		logger:       n.logger,
	}
	diffs, err := dg.generateDiffs()
	if err != nil {
		return err
	}

	n.logger.Debug("notifySubscribers - diffs",
		mlog.Any("hint", hint),
		mlog.Int("diff_count", len(diffs)),
	)

	if len(diffs) == 0 {
		return nil
	}

	diffAuthors := make(StringMap)
	for _, d := range diffs {
		diffAuthors.Append(d.Authors)
	}

	opts := DiffConvOpts{
		Language: "en", // TODO: use correct language when i18n is available on server.
		MakeCardLink: func(block *model.Block, board *model.Board, card *model.Block) string {
			return fmt.Sprintf("[%s](%s)", block.Title, utils.MakeCardLink(n.serverRoot, board.TeamID, board.ID, card.ID))
		},
		MakeBoardLink: func(board *model.Board) string {
			return fmt.Sprintf("[%s](%s)", board.Title, utils.MakeBoardLink(n.serverRoot, board.TeamID, board.ID))
		},
		Logger: n.logger,
	}

	attachments, err := Diffs2SlackAttachments(diffs, opts)
	if err != nil {
		return err
	}

	merr := merror.New()
	if len(attachments) > 0 {
		for _, sub := range subs {
			// don't notify the author of their own changes.
			authorName, isAuthor := diffAuthors[sub.SubscriberID]
			if isAuthor && len(diffAuthors) == 1 {
				n.logger.Debug("notifySubscribers - skipping author",
					mlog.Any("hint", hint),
					mlog.String("author_id", sub.SubscriberID),
					mlog.String("author_username", authorName),
				)
				continue
			}

			// make sure the subscriber still has permissions for the board.
			if !n.permissions.HasPermissionToBoard(sub.SubscriberID, board.ID, model.PermissionViewBoard) {
				n.logger.Debug("notifySubscribers - skipping non-board member",
					mlog.Any("hint", hint),
					mlog.String("subscriber_id", sub.SubscriberID),
					mlog.String("board_id", board.ID),
				)
				continue
			}

			n.logger.Debug("notifySubscribers - deliver",
				mlog.Any("hint", hint),
				mlog.String("modified_by_id", hint.ModifiedByID),
				mlog.String("subscriber_id", sub.SubscriberID),
				mlog.String("subscriber_type", string(sub.SubscriberType)),
			)

			if err = n.delivery.SubscriptionDeliverSlackAttachments(board.TeamID, sub.SubscriberID, sub.SubscriberType, attachments); err != nil {
				merr.Append(fmt.Errorf("cannot deliver notification to subscriber %s [%s]: %w",
					sub.SubscriberID, sub.SubscriberType, err))
			}
		}
	} else {
		n.logger.Debug("notifySubscribers - skip delivery; no chg",
			mlog.Any("hint", hint),
			mlog.String("modified_by_id", hint.ModifiedByID),
		)
	}

	// find the new NotifiedAt based on the newest diff.
	var notifiedAt int64
	for _, d := range diffs {
		if d.UpdateAt > notifiedAt {
			notifiedAt = d.UpdateAt
		}
		for _, c := range d.Diffs {
			if c.UpdateAt > notifiedAt {
				notifiedAt = c.UpdateAt
			}
		}
	}

	// update the last notified_at for all subscribers since we at least attempted to notify all of them.
	err = dg.store.UpdateSubscribersNotifiedAt(dg.hint.BlockID, notifiedAt)
	if err != nil {
		merr.Append(fmt.Errorf("could not update subscribers notified_at for block %s: %w", dg.hint.BlockID, err))
	}

	return merr.ErrorOrNil()
}
