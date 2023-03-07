// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package driver

import (
	"context"
	"database/sql/driver"

	"github.com/mattermost/mattermost-server/server/v7/plugin"
)

// Conn is a DB driver conn implementation
// which executes queries using the Plugin DB API.
type Conn struct {
	id  string
	api plugin.Driver
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
	txID, err := c.api.Tx(c.id, driver.TxOptions{})
	if err != nil {
		return nil, err
	}

	t := &wrapperTx{
		id:  txID,
		api: c.api,
	}
	return t, nil
}

func (c *Conn) BeginTx(_ context.Context, opts driver.TxOptions) (driver.Tx, error) {
	txID, err := c.api.Tx(c.id, opts)
	if err != nil {
		return nil, err
	}

	t := &wrapperTx{
		id:  txID,
		api: c.api,
	}
	return t, nil
}

func (c *Conn) Prepare(q string) (driver.Stmt, error) {
	stID, err := c.api.Stmt(c.id, q)
	if err != nil {
		return nil, err
	}

	st := &wrapperStmt{
		id:  stID,
		api: c.api,
	}
	return st, nil
}

func (c *Conn) PrepareContext(_ context.Context, q string) (driver.Stmt, error) {
	stID, err := c.api.Stmt(c.id, q)
	if err != nil {
		return nil, err
	}
	st := &wrapperStmt{
		id:  stID,
		api: c.api,
	}
	return st, nil
}

func (c *Conn) ExecContext(_ context.Context, q string, args []driver.NamedValue) (driver.Result, error) {
	resultContainer, err := c.api.ConnExec(c.id, q, args)
	if err != nil {
		return nil, err
	}
	res := &wrapperResult{
		res: resultContainer,
	}
	return res, nil
}

func (c *Conn) QueryContext(_ context.Context, q string, args []driver.NamedValue) (driver.Rows, error) {
	rowsID, err := c.api.ConnQuery(c.id, q, args)
	if err != nil {
		return nil, err
	}

	rows := &wrapperRows{
		id:  rowsID,
		api: c.api,
	}
	return rows, nil
}

func (c *Conn) Ping(_ context.Context) error {
	return c.api.ConnPing(c.id)
}

func (c *Conn) Close() error {
	return c.api.ConnClose(c.id)
}
