// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/jmoiron/sqlx"
	sq "github.com/mattermost/squirrel"
)

// testSqlStore provides test-level access to the underlying SQL store. It is
// implemented by StoreTestWrapper.
type testSqlStore interface {
	GetMaster() SqlXExecutor
	DriverName() string
	GetQueryPlaceholder() sq.PlaceholderFormat
}

// SqlXExecutor exposes raw sqlx operations needed by store tests.
type SqlXExecutor interface {
	Get(dest any, query string, args ...any) error
	NamedExec(query string, arg any) (sql.Result, error)
	Exec(query string, args ...any) (sql.Result, error)
	ExecRaw(query string, args ...any) (sql.Result, error)
	NamedQuery(query string, arg any) (*sqlx.Rows, error)
	QueryRowX(query string, args ...any) *sqlx.Row
	QueryX(query string, args ...any) (*sqlx.Rows, error)
	Select(dest any, query string, args ...any) error
}
