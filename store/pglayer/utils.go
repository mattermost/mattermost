// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

import (
	"database/sql"
	"strings"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/mlog"
)

var escapeLikeSearchChar = []string{
	"%",
	"_",
}

func sanitizeSearchTerm(term string, escapeChar string) string {
	term = strings.Replace(term, escapeChar, "", -1)

	for _, c := range escapeLikeSearchChar {
		term = strings.Replace(term, c, escapeChar+c, -1)
	}

	return term
}

// finalizeTransaction ensures a transaction is closed after use, rolling back if not already committed.
func finalizeTransaction(transaction *gorp.Transaction) {
	// Rollback returns sql.ErrTxDone if the transaction was already closed.
	if err := transaction.Rollback(); err != nil && err != sql.ErrTxDone {
		mlog.Error("Failed to rollback transaction", mlog.Err(err))
	}
}
