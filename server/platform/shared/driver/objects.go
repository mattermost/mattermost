// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package driver

import (
	"context"
	"database/sql/driver"

	"github.com/mattermost/mattermost-server/server/v7/plugin"
)

type wrapperTx struct {
	driver.Tx
	id  string
	api plugin.Driver
}

func (t *wrapperTx) Commit() error {
	return t.api.TxCommit(t.id)
}

func (t *wrapperTx) Rollback() error {
	return t.api.TxRollback(t.id)
}

type wrapperStmt struct {
	driver.Stmt
	id  string
	api plugin.Driver
}

func (s *wrapperStmt) Close() error {
	return s.api.StmtClose(s.id)
}

func (s *wrapperStmt) NumInput() int {
	return s.api.StmtNumInput(s.id)
}

func (s *wrapperStmt) ExecContext(_ context.Context, args []driver.NamedValue) (driver.Result, error) {
	resultContainer, err := s.api.StmtExec(s.id, args)
	if err != nil {
		return nil, err
	}
	res := &wrapperResult{
		res: resultContainer,
	}
	return res, nil
}

func (s *wrapperStmt) QueryContext(_ context.Context, args []driver.NamedValue) (driver.Rows, error) {
	rowsID, err := s.api.StmtQuery(s.id, args)
	if err != nil {
		return nil, err
	}
	rows := &wrapperRows{
		id:  rowsID,
		api: s.api,
	}
	return rows, nil
}

// wrapperResult implements the driver.Result interface.
// This differs from other objects because it already contains the
// information for its methods. This does two things:
//
// 1. Simplifies server-side code by avoiding to track result ids
// in a map.
// 2. Avoids round-trip to compute result methods.
type wrapperResult struct {
	res plugin.ResultContainer
}

func (r *wrapperResult) LastInsertId() (int64, error) {
	return r.res.LastID, r.res.LastIDError
}

func (r *wrapperResult) RowsAffected() (int64, error) {
	return r.res.RowsAffected, r.res.RowsAffectedError
}

type wrapperRows struct {
	id  string
	api plugin.Driver
}

func (r *wrapperRows) Columns() []string {
	return r.api.RowsColumns(r.id)
}

func (r *wrapperRows) Close() error {
	return r.api.RowsClose(r.id)
}

func (r *wrapperRows) Next(dest []driver.Value) error {
	return r.api.RowsNext(r.id, dest)
}

func (r *wrapperRows) HasNextResultSet() bool {
	return r.api.RowsHasNextResultSet(r.id)
}

func (r *wrapperRows) NextResultSet() error {
	return r.api.RowsNextResultSet(r.id)
}

func (r *wrapperRows) ColumnTypeDatabaseTypeName(index int) string {
	return r.api.RowsColumnTypeDatabaseTypeName(r.id, index)
}

func (r *wrapperRows) ColumnTypePrecisionScale(index int) (precision, scale int64, ok bool) {
	return r.api.RowsColumnTypePrecisionScale(r.id, index)
}
