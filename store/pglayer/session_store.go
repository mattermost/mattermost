// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgSessionStore struct {
	sqlstore.SqlSessionStore
}

func (me PgSessionStore) Cleanup(expiryTime int64, batchSize int64) {
	mlog.Debug("Cleaning up session store.")

	var query string
	query = "DELETE FROM Sessions WHERE Id = any (array (SELECT Id FROM Sessions WHERE ExpiresAt != 0 AND :ExpiresAt > ExpiresAt LIMIT :Limit))"

	var rowsAffected int64 = 1

	for rowsAffected > 0 {
		if sqlResult, err := me.GetMaster().Exec(query, map[string]interface{}{"ExpiresAt": expiryTime, "Limit": batchSize}); err != nil {
			mlog.Error("Unable to cleanup session store.", mlog.Err(err))
			return
		} else {
			var rowErr error
			rowsAffected, rowErr = sqlResult.RowsAffected()
			if rowErr != nil {
				mlog.Error("Unable to cleanup session store.", mlog.Err(err))
				return
			}
		}

		time.Sleep(sqlstore.SESSIONS_CLEANUP_DELAY_MILLISECONDS * time.Millisecond)
	}
}
