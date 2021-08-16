// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type sqlxDBWrapper struct {
	*sqlx.DB
	queryTimeout time.Duration
	trace        bool
}

func newSqlxDBWrapper(db *sqlx.DB, timeoutSecs int, trace bool) *sqlxDBWrapper {
	return &sqlxDBWrapper{
		DB:           db,
		queryTimeout: time.Duration(timeoutSecs) * time.Second,
		trace:        trace,
	}
}

func (w *sqlxDBWrapper) Beginx() (*sqlxTxWrapper, error) {
	tx, err := w.DB.Beginx()
	if err != nil {
		return nil, err
	}

	return newSqlxTxWrapper(tx, w.queryTimeout, w.trace), nil
}

func (w *sqlxDBWrapper) Get(dest interface{}, query string, args ...interface{}) error {
	query = w.DB.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, args)
	}

	return w.DB.GetContext(ctx, dest, query, args...)
}

func (w *sqlxDBWrapper) NamedExec(query string, arg interface{}) (sql.Result, error) {
	if w.DB.DriverName() == model.DatabaseDriverPostgres {
		query = strings.ToLower(query)
	}
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, arg)
	}

	return w.DB.NamedExecContext(ctx, query, arg)
}

func (w *sqlxDBWrapper) NamedQuery(query string, arg interface{}) (*sqlx.Rows, error) {
	if w.DB.DriverName() == model.DatabaseDriverPostgres {
		query = strings.ToLower(query)
	}
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, arg)
	}

	return w.DB.NamedQueryContext(ctx, query, arg)
}

func (w *sqlxDBWrapper) QueryRowX(query string, args ...interface{}) *sqlx.Row {
	query = w.DB.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, args)
	}

	return w.DB.QueryRowxContext(ctx, query, args...)
}

func (w *sqlxDBWrapper) QueryX(query string, args ...interface{}) (*sqlx.Rows, error) {
	query = w.DB.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, args)
	}

	return w.DB.QueryxContext(ctx, query, args)
}

func (w *sqlxDBWrapper) Select(dest interface{}, query string, args ...interface{}) error {
	query = w.DB.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, args)
	}

	return w.DB.SelectContext(ctx, dest, query, args...)
}

type sqlxTxWrapper struct {
	*sqlx.Tx
	queryTimeout time.Duration
	trace        bool
}

func newSqlxTxWrapper(tx *sqlx.Tx, timeout time.Duration, trace bool) *sqlxTxWrapper {
	return &sqlxTxWrapper{
		Tx:           tx,
		queryTimeout: timeout,
		trace:        trace,
	}
}

func (w *sqlxTxWrapper) Get(dest interface{}, query string, args ...interface{}) error {
	query = w.Tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, args)
	}

	return w.Tx.GetContext(ctx, dest, query, args...)
}

func (w *sqlxTxWrapper) NamedExec(query string, arg interface{}) (sql.Result, error) {
	if w.Tx.DriverName() == model.DatabaseDriverPostgres {
		query = strings.ToLower(query)
	}
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, arg)
	}

	return w.Tx.NamedExecContext(ctx, query, arg)
}

func (w *sqlxTxWrapper) NamedQuery(query string, arg interface{}) (*sqlx.Rows, error) {
	if w.Tx.DriverName() == model.DatabaseDriverPostgres {
		query = strings.ToLower(query)
	}
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, arg)
	}

	// There is no tx.NamedQueryContext support in the sqlx API. (https://github.com/jmoiron/sqlx/issues/447)
	// So we need to implement this ourselves.
	type result struct {
		rows *sqlx.Rows
		err  error
	}

	// Need to add a buffer of 1 to prevent goroutine leak.
	resChan := make(chan *result, 1)
	go func() {
		rows, err := w.Tx.NamedQuery(query, arg)
		resChan <- &result{
			rows: rows,
			err:  err,
		}
	}()

	select {
	case res := <-resChan:
		return res.rows, res.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (w *sqlxTxWrapper) QueryRowX(query string, args ...interface{}) *sqlx.Row {
	query = w.Tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, args)
	}

	return w.Tx.QueryRowxContext(ctx, query, args...)
}

func (w *sqlxTxWrapper) QueryX(query string, args ...interface{}) (*sqlx.Rows, error) {
	query = w.Tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, args)
	}

	return w.Tx.QueryxContext(ctx, query, args)
}

func (w *sqlxTxWrapper) Select(dest interface{}, query string, args ...interface{}) error {
	query = w.Tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		printArgs(query, args)
	}
	return w.Tx.SelectContext(ctx, dest, query, args...)
}

func removeSpace(r rune) rune {
	// Strip everything except ' '
	// This also strips out more than one space,
	// but we ignore it for now until someone complains.
	if unicode.IsSpace(r) && r != ' ' {
		return -1
	}
	return r
}

func printArgs(query string, args ...interface{}) {
	query = strings.Map(removeSpace, query)
	switch len(args) {
	case 0:
		mlog.Debug(query)
	default:
		fields := make([]mlog.Field, 0, len(args))
		for i, arg := range args {
			fields = append(fields, mlog.Any("arg"+strconv.Itoa(i), arg))
		}
		mlog.Debug(query, fields...)
	}
}
