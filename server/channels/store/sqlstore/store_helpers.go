// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// checkRowsAffected validates that a query affected at least one row
// Returns store.NewErrNotFound if no rows were affected
func (ss *SqlStore) checkRowsAffected(result sql.Result, entityType, entityId string) error {
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound(entityType, entityId)
	}
	return nil
}

// buildSoftDeleteQuery creates an UPDATE query to soft-delete an entity
// Parameters:
//
//	table: table name (e.g., "PageContents", "Wikis")
//	idColumn: primary key column name (e.g., "PageId", "Id")
//	idValue: value to match
//	updateTimestamp: whether to also update UpdateAt field
func (ss *SqlStore) buildSoftDeleteQuery(table, idColumn string, idValue any, updateTimestamp bool) sq.UpdateBuilder {
	query := ss.getQueryBuilder().
		Update(table).
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{idColumn: idValue, "DeleteAt": 0})

	if updateTimestamp {
		query = query.Set("UpdateAt", model.GetMillis())
	}

	return query
}

// buildRestoreQuery creates an UPDATE query to restore a soft-deleted entity
func (ss *SqlStore) buildRestoreQuery(table, idColumn string, idValue any) sq.UpdateBuilder {
	return ss.getQueryBuilder().
		Update(table).
		Set("DeleteAt", 0).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.And{
			sq.Eq{idColumn: idValue},
			sq.NotEq{"DeleteAt": 0},
		})
}

// ExecuteInTransaction wraps multiple operations in a database transaction
// The function fn receives the transaction and should perform all operations within it
// The transaction is automatically committed on success or rolled back on error
func (ss *SqlStore) ExecuteInTransaction(fn func(tx *sqlxTxWrapper) error) error {
	transaction, err := ss.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	if err = fn(transaction); err != nil {
		return err
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

// postsToPostList converts a slice of posts to a PostList with proper ordering
func postsToPostList(posts []*model.Post) *model.PostList {
	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}
	return postList
}
