// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package driver

import (
	"context"
	"database/sql"
	"database/sql/driver"
)

// Conn is a DB driver conn implementation
// which will just pass-through all queries to its
// underlying connection.
type Conn struct {
	conn *sql.Conn
}

// driverConn is a super-interface combining the basic
// driver.Conn interface with some new additions later.
type driverConn interface {
	driver.Conn
	driver.ConnBeginTx
	driver.ConnPrepareContext
	driver.ExecerContext
	driver.QueryerContext
	driver.Pinger
}

var (
	// Compile-time check to ensure Conn implements the interface.
	_ driverConn = &Conn{}
)

func (c *Conn) Begin() (tx driver.Tx, err error) {
	err = c.conn.Raw(func(innerConn interface{}) error {
		tx, err = innerConn.(driver.Conn).Begin() //nolint:staticcheck
		return err
	})
	return tx, err
}

func (c *Conn) BeginTx(ctx context.Context, opts driver.TxOptions) (_ driver.Tx, err error) {
	t := &wrapperTx{}
	err = c.conn.Raw(func(innerConn interface{}) error {
		t.Tx, err = innerConn.(driver.ConnBeginTx).BeginTx(ctx, opts)
		return err
	})
	return t, err
}

func (c *Conn) Prepare(q string) (_ driver.Stmt, err error) {
	st := &wrapperStmt{}
	err = c.conn.Raw(func(innerConn interface{}) error {
		st.Stmt, err = innerConn.(driver.Conn).Prepare(q)
		return err
	})
	return st, err
}

func (c *Conn) PrepareContext(ctx context.Context, q string) (_ driver.Stmt, err error) {
	st := &wrapperStmt{}
	err = c.conn.Raw(func(innerConn interface{}) error {
		st.Stmt, err = innerConn.(driver.ConnPrepareContext).PrepareContext(ctx, q)
		return err
	})
	return st, err
}

func (c *Conn) ExecContext(ctx context.Context, q string, args []driver.NamedValue) (_ driver.Result, err error) {
	res := &wrapperResult{}
	err = c.conn.Raw(func(innerConn interface{}) error {
		res.Result, err = innerConn.(driver.ExecerContext).ExecContext(ctx, q, args)
		return err
	})
	return res, err
}

func (c *Conn) QueryContext(ctx context.Context, q string, args []driver.NamedValue) (_ driver.Rows, err error) {
	rows := &wrapperRows{}
	err = c.conn.Raw(func(innerConn interface{}) error {
		rows.Rows, err = innerConn.(driver.QueryerContext).QueryContext(ctx, q, args)
		return err
	})
	return rows, err
}

func (c *Conn) Ping(ctx context.Context) error {
	return c.conn.Raw(func(innerConn interface{}) error {
		return innerConn.(driver.Pinger).Ping(ctx)
	})
}

func (c *Conn) Close() error {
	return c.conn.Raw(func(innerConn interface{}) error {
		return innerConn.(driver.Conn).Close()
	})
}
