// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mysqllayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/helper"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type MySQLChannelMemberHistoryStore struct {
	sqlstore.SqlChannelMemberHistoryStore
}

func (s MySQLChannelMemberHistoryStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError) {
	buildQueryFn := func() string {
		return `DELETE FROM ChannelMemberHistory
			WHERE LeaveTime IS NOT NULL
			AND LeaveTime <= :EndTime
			LIMIT :Limit`
	}

	return helper.ChannelMemberHistoryPermanentDeleteBatch(s, endTime, limit, buildQueryFn)
}
