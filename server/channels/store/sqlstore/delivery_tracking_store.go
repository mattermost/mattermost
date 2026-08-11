// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"slices"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlDeliveryTrackingStore struct {
	*SqlStore
}

func newSqlDeliveryTrackingStore(sqlStore *SqlStore) store.DeliveryTrackingStore {
	return &SqlDeliveryTrackingStore{SqlStore: sqlStore}
}

func (s *SqlDeliveryTrackingStore) SaveTrackedChannelIDs(rctx request.CTX, channelIDs []string) error {
	tx, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "SqlDeliveryTrackingStore.SaveTrackedChannelIDs failed to begin transaction")
	}
	defer finalizeTransactionX(tx, &err)

	deleteBuilder := s.getQueryBuilder().Delete("PostDeliveryTrackingChannels")
	if _, err := tx.ExecBuilder(deleteBuilder); err != nil {
		return errors.Wrap(err, "SqlDeliveryTrackingStore.SaveTrackedChannelIDs failed to delete existing tracked channels")
	}

	// Dedup so the unique constraint isn't violated, and drop empty ids.
	uniqueChannelIDs := slices.DeleteFunc(utils.Dedup(channelIDs), func(channelID string) bool {
		return channelID == ""
	})

	if len(uniqueChannelIDs) > 0 {
		insertBuilder := s.getQueryBuilder().
			Insert("PostDeliveryTrackingChannels").
			Columns("ChannelId")

		for _, channelID := range uniqueChannelIDs {
			insertBuilder = insertBuilder.Values(channelID)
		}

		if _, err := tx.ExecBuilder(insertBuilder); err != nil {
			return errors.Wrap(err, "SqlDeliveryTrackingStore.SaveTrackedChannelIDs failed to insert new tracked channels")
		}
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "SqlDeliveryTrackingStore.SaveTrackedChannelIDs failed to commit transaction")
	}

	return nil
}

// ClearCaches is a no-op; only the local cache layer holds a cache.
func (s *SqlDeliveryTrackingStore) ClearCaches() {
}

func (s *SqlDeliveryTrackingStore) GetTrackedChannelIDs(rctx request.CTX) ([]string, error) {
	query := s.getQueryBuilder().
		Select("ChannelId").
		From("PostDeliveryTrackingChannels")

	channelIDs := []string{}
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&channelIDs, query); err != nil {
		return nil, errors.Wrap(err, "SqlDeliveryTrackingStore.GetTrackedChannelIDs failed to select tracked channels")
	}

	return channelIDs, nil
}

func (s *SqlDeliveryTrackingStore) IsChannelTracked(rctx request.CTX, channelID string) (bool, error) {
	query := s.getQueryBuilder().
		Select("1").
		From("PostDeliveryTrackingChannels").
		Where(sq.Eq{"ChannelId": channelID}).
		Limit(1)

	var exists []int
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&exists, query); err != nil {
		return false, errors.Wrapf(err, "SqlDeliveryTrackingStore.IsChannelTracked failed for channel_id=%s", channelID)
	}

	return len(exists) > 0, nil
}

func (s *SqlDeliveryTrackingStore) IsChannelTrackable(rctx request.CTX, channelID string) (bool, error) {
	// Only the type is selected: the callers need one bit, and hydrating the whole channel
	// would be far more expensive on a path that runs per recorded delivery.
	query := s.getQueryBuilder().
		Select("Type").
		From("Channels").
		Where(sq.Eq{"Id": channelID}).
		Limit(1)

	var types []model.ChannelType
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&types, query); err != nil {
		return false, errors.Wrapf(err, "SqlDeliveryTrackingStore.IsChannelTrackable failed for channel_id=%s", channelID)
	}

	if len(types) == 0 {
		return false, nil
	}

	return types[0] != model.ChannelTypeDirect && types[0] != model.ChannelTypeGroup, nil
}
