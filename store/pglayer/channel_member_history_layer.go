// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/helper"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgChannelMemberHistoryStore struct {
	sqlstore.SqlChannelMemberHistoryStore
}

func (s PgChannelMemberHistoryStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError) {
	buildQueryFn := func() string {
		return `DELETE FROM ChannelMemberHistory
		WHERE ctid IN (
		SELECT ctid FROM ChannelMemberHistory
		WHERE LeaveTime IS NOT NULL
		AND LeaveTime <= :EndTime
		LIMIT :Limit
	);`
	}

	helper.ChannelMemberHistoryPermanentDeleteBatch(s, endTime, limit, buildQueryFn)
}
