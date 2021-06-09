// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package driver

import (
	"context"
	"database/sql/driver"
	"reflect"
)

type wrapperTx struct {
	driver.Tx
}

func (t *wrapperTx) Commit() error {
	return t.Tx.Commit()
}

func (t *wrapperTx) Rollback() error {
	return t.Tx.Rollback()
}

type wrapperStmt struct {
	driver.Stmt
}

func (s *wrapperStmt) Close() error {
	return s.Stmt.Close()
}

func (s *wrapperStmt) NumInput() int {
	return s.Stmt.NumInput()
}

func (s *wrapperStmt) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	return s.Stmt.(driver.StmtExecContext).ExecContext(ctx, args)
}

func (s *wrapperStmt) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	return s.Stmt.(driver.StmtQueryContext).QueryContext(ctx, args)
}

type wrapperResult struct {
	driver.Result
}

func (r *wrapperResult) LastInsertId() (int64, error) {
	return r.Result.LastInsertId()
}

func (r *wrapperResult) RowsAffected() (int64, error) {
	return r.Result.RowsAffected()
}

type wrapperRows struct {
	driver.Rows
}

func (r *wrapperRows) Columns() []string {
	return r.Rows.Columns()
}

func (r *wrapperRows) Close() error {
	return r.Rows.Close()
}

func (r *wrapperRows) Next(dest []driver.Value) error {
	return r.Rows.Next(dest)
}

func (r *wrapperRows) HasNextResultSet() bool {
	return r.Rows.(driver.RowsNextResultSet).HasNextResultSet()
}

func (r *wrapperRows) NextResultSet() error {
	return r.Rows.(driver.RowsNextResultSet).NextResultSet()
}

func (r *wrapperRows) ColumnTypeScanType(index int) reflect.Type {
	return r.Rows.(driver.RowsColumnTypeScanType).ColumnTypeScanType(index)
}

func (r *wrapperRows) ColumnTypeDatabaseTypeName(index int) string {
	return r.Rows.(driver.RowsColumnTypeDatabaseTypeName).ColumnTypeDatabaseTypeName(index)
}

func (r *wrapperRows) ColumnTypeLength(index int) (length int64, ok bool) {
	return r.Rows.(driver.RowsColumnTypeLength).ColumnTypeLength(index)
}

func (r *wrapperRows) ColumnTypeNullable(index int) (nullable, ok bool) {
	return r.Rows.(driver.RowsColumnTypeNullable).ColumnTypeNullable(index)
}

func (r *wrapperRows) ColumnTypePrecisionScale(index int) (precision, scale int64, ok bool) {
	return r.Rows.(driver.RowsColumnTypePrecisionScale).ColumnTypePrecisionScale(index)
}
