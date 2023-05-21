// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifysubscriptions

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/notify"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/permissions"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

const (
	backendName = "notifySubscriptions"
)

type BackendParams struct {
	ServerRoot             string
	AppAPI                 AppAPI
	Permissions            permissions.PermissionsService
	Delivery               SubscriptionDelivery
	Logger                 mlog.LoggerIFace
	NotifyFreqCardSeconds  int
	NotifyFreqBoardSeconds int
}

// Backend provides the notification backend for subscriptions.
type Backend struct {
	appAPI                 AppAPI
	permissions            permissions.PermissionsService
	delivery               SubscriptionDelivery
	notifier               *notifier
	logger                 mlog.LoggerIFace
	notifyFreqCardSeconds  int
	notifyFreqBoardSeconds int
}

func New(params BackendParams) *Backend {
	return &Backend{
		appAPI:                 params.AppAPI,
		delivery:               params.Delivery,
		permissions:            params.Permissions,
		notifier:               newNotifier(params),
		logger:                 params.Logger,
		notifyFreqCardSeconds:  params.NotifyFreqCardSeconds,
		notifyFreqBoardSeconds: params.NotifyFreqBoardSeconds,
	}
}

func (b *Backend) Start() error {
	b.logger.Debug("Starting subscriptions backend",
		mlog.Int("freq_card", b.notifyFreqCardSeconds),
		mlog.Int("freq_board", b.notifyFreqBoardSeconds),
	)
	b.notifier.start()
	return nil
}

func (b *Backend) ShutDown() error {
	b.logger.Debug("Stopping subscriptions backend")
	b.notifier.stop()
	_ = b.logger.Flush()
	return nil
}

func (b *Backend) Name() string {
	return backendName
}

func (b *Backend) getBlockUpdateFreq(blockType model.BlockType) time.Duration {
	// check for env variable override
	sFreq := os.Getenv("MM_BOARDS_NOTIFY_FREQ_SECONDS")
	if sFreq != "" && sFreq != "0" {
		if freq, err := strconv.ParseInt(sFreq, 10, 64); err != nil {
			b.logger.Error("Environment variable MM_BOARDS_NOTIFY_FREQ_SECONDS invalid (ignoring)", mlog.Err(err))
		} else {
			return time.Second * time.Duration(freq)
		}
	}

	switch blockType {
	case model.TypeCard:
		return time.Second * time.Duration(b.notifyFreqCardSeconds)
	default:
		return defBlockNotificationFreq
	}
}

func (b *Backend) BlockChanged(evt notify.BlockChangeEvent) error {
	if evt.Board == nil {
		b.logger.Warn("No board found for block, skipping notify",
			mlog.String("block_id", evt.BlockChanged.ID),
		)
		return nil
	}

	merr := merror.New()
	var err error

	// if new card added, automatically subscribe the author.
	if evt.Action == notify.Add && evt.BlockChanged.Type == model.TypeCard {
		sub := &model.Subscription{
			BlockType:      model.TypeCard,
			BlockID:        evt.BlockChanged.ID,
			SubscriberType: model.SubTypeUser,
			SubscriberID:   evt.ModifiedBy.UserID,
		}

		if _, err = b.appAPI.CreateSubscription(sub); err != nil {
			b.logger.Warn("Cannot subscribe card author to card",
				mlog.String("card_id", evt.BlockChanged.ID),
				mlog.Err(err),
			)
		}
	}

	// notify board subscribers
	subs, err := b.appAPI.GetSubscribersForBlock(evt.Board.ID)
	if err != nil {
		merr.Append(fmt.Errorf("cannot fetch subscribers for board %s: %w", evt.Board.ID, err))
	}
	if err = b.notifySubscribers(subs, evt.Board.ID, model.TypeBoard, evt.ModifiedBy.UserID); err != nil {
		merr.Append(fmt.Errorf("cannot notify board subscribers for board %s: %w", evt.Board.ID, err))
	}

	if evt.Card == nil {
		return merr.ErrorOrNil()
	}

	// notify card subscribers
	subs, err = b.appAPI.GetSubscribersForBlock(evt.Card.ID)
	if err != nil {
		merr.Append(fmt.Errorf("cannot fetch subscribers for card %s: %w", evt.Card.ID, err))
	}
	if err = b.notifySubscribers(subs, evt.Card.ID, model.TypeCard, evt.ModifiedBy.UserID); err != nil {
		merr.Append(fmt.Errorf("cannot notify card subscribers for card %s: %w", evt.Card.ID, err))
	}

	// notify block subscribers (if/when other types can be subscribed to)
	if evt.Board.ID != evt.BlockChanged.ID && evt.Card.ID != evt.BlockChanged.ID {
		subs, err := b.appAPI.GetSubscribersForBlock(evt.BlockChanged.ID)
		if err != nil {
			merr.Append(fmt.Errorf("cannot fetch subscribers for block %s: %w", evt.BlockChanged.ID, err))
		}
		if err := b.notifySubscribers(subs, evt.BlockChanged.ID, evt.BlockChanged.Type, evt.ModifiedBy.UserID); err != nil {
			merr.Append(fmt.Errorf("cannot notify block subscribers for block %s: %w", evt.BlockChanged.ID, err))
		}
	}
	return merr.ErrorOrNil()
}

// notifySubscribers triggers a change notification for subscribers by writing a notification hint to the database.
func (b *Backend) notifySubscribers(subs []*model.Subscriber, blockID string, idType model.BlockType, modifiedByID string) error {
	if len(subs) == 0 {
		return nil
	}

	hint := &model.NotificationHint{
		BlockType:    idType,
		BlockID:      blockID,
		ModifiedByID: modifiedByID,
	}

	hint, err := b.appAPI.UpsertNotificationHint(hint, b.getBlockUpdateFreq(idType))
	if err != nil {
		return fmt.Errorf("cannot upsert notification hint: %w", err)
	}
	if err := b.notifier.onNotifyHint(hint); err != nil {
		return err
	}

	return nil
}

// OnMention satisfies the `MentionListener` interface and is called whenever a @mention notification
// is sent. Here we create a subscription for the mentioned user to the card.
func (b *Backend) OnMention(userID string, evt notify.BlockChangeEvent) {
	if evt.Card == nil {
		b.logger.Debug("Cannot subscribe mentioned user to nil card",
			mlog.String("user_id", userID),
			mlog.String("block_id", evt.BlockChanged.ID),
		)
		return
	}

	// user mentioned must be a board member to subscribe to card.
	if !b.permissions.HasPermissionToBoard(userID, evt.Board.ID, model.PermissionViewBoard) {
		b.logger.Debug("Not subscribing mentioned non-board member to card",
			mlog.String("user_id", userID),
			mlog.String("block_id", evt.BlockChanged.ID),
		)
		return
	}

	sub := &model.Subscription{
		BlockType:      model.TypeCard,
		BlockID:        evt.Card.ID,
		SubscriberType: model.SubTypeUser,
		SubscriberID:   userID,
	}

	var err error
	if _, err = b.appAPI.CreateSubscription(sub); err != nil {
		b.logger.Warn("Cannot subscribe mentioned user to card",
			mlog.String("user_id", userID),
			mlog.String("card_id", evt.Card.ID),
			mlog.Err(err),
		)
		return
	}

	b.logger.Debug("Subscribed mentioned user to card",
		mlog.String("user_id", userID),
		mlog.String("card_id", evt.Card.ID),
	)
}
