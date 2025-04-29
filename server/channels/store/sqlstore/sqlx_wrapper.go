// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost/server/public/shared/request"

	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	sq "github.com/mattermost/squirrel"
)

type StoreTestWrapper struct {
	orig *SqlStore
}

func NewStoreTestWrapper(orig *SqlStore) *StoreTestWrapper {
	return &StoreTestWrapper{orig}
}

func (w *StoreTestWrapper) GetMaster() storetest.SqlXExecutor {
	return w.orig.GetMaster()
}

func (w *StoreTestWrapper) DriverName() string {
	return w.orig.DriverName()
}

func (w *StoreTestWrapper) GetQueryPlaceholder() sq.PlaceholderFormat {
	return w.orig.getQueryPlaceholder()
}

// sqlxExecutor exposes sqlx operations. It is used to enable some internal store methods to
// accept both transactions (*SQLxTxWrapper) and common db handlers (*sqlxDbWrapper).
type sqlxExecutor interface {
	Get(dest any, query string, args ...any) error
	GetBuilder(dest any, builder request.Builder) error
	NamedExec(query string, arg any) (sql.Result, error)
	Exec(query string, args ...any) (sql.Result, error)
	ExecBuilder(builder request.Builder) (sql.Result, error)
	ExecRaw(query string, args ...any) (sql.Result, error)
	NamedQuery(query string, arg any) (*sqlx.Rows, error)
	QueryRowX(query string, args ...any) *sqlx.Row
	QueryX(query string, args ...any) (*sqlx.Rows, error)
	Select(dest any, query string, args ...any) error
	SelectBuilder(dest any, builder request.Builder) error
}
