// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"errors"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
	"unicode"

	"github.com/jmoiron/sqlx"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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

type Builder interface {
	ToSql() (string, []any, error)
}

// sqlxExecutor exposes sqlx operations. It is used to enable some internal store methods to
// accept both transactions (*sqlxTxWrapper) and common db handlers (*sqlxDbWrapper).
type sqlxExecutor interface {
	Get(dest any, query string, args ...any) error
	GetBuilder(dest any, builder Builder) error
	NamedExec(query string, arg any) (sql.Result, error)
	Exec(query string, args ...any) (sql.Result, error)
	ExecBuilder(builder Builder) (sql.Result, error)
	ExecRaw(query string, args ...any) (sql.Result, error)
	NamedQuery(query string, arg any) (*sqlx.Rows, error)
	QueryRowX(query string, args ...any) *sqlx.Row
	QueryX(query string, args ...any) (*sqlx.Rows, error)
	Select(dest any, query string, args ...any) error
	SelectBuilder(dest any, builder Builder) error
}

// namedParamRegex is used to capture all named parameters and convert them
// to lowercase. This is necessary to be able to use a single query for both
// Postgres and MySQL.
// This will also lowercase any constant strings containing a :, but sqlx
// will fail the query, so it won't be checked in inadvertently.
var namedParamRegex = regexp.MustCompile(`:\w+`)

type sqlxDBWrapper struct {
	*sqlx.DB
	queryTimeout time.Duration
	trace        bool
	isOnline     *atomic.Bool
}

func newSqlxDBWrapper(db *sqlx.DB, timeout time.Duration, trace bool) *sqlxDBWrapper {
	w := &sqlxDBWrapper{
		DB:           db,
		queryTimeout: timeout,
		trace:        trace,
		isOnline:     &atomic.Bool{},
	}
	w.isOnline.Store(true)
	return w
}

func (w *sqlxDBWrapper) Stats() sql.DBStats {
	return w.DB.Stats()
}

func (w *sqlxDBWrapper) Beginx() (*sqlxTxWrapper, error) {
	tx, err := w.DB.Beginx()
	if err != nil {
		return nil, w.checkErr(err)
	}

	return newSqlxTxWrapper(tx, w.queryTimeout, w.trace, w), nil
}

func (w *sqlxDBWrapper) BeginXWithIsolation(opts *sql.TxOptions) (*sqlxTxWrapper, error) {
	tx, err := w.DB.BeginTxx(context.Background(), opts)
	if err != nil {
		return nil, w.checkErr(err)
	}

	return newSqlxTxWrapper(tx, w.queryTimeout, w.trace, w), nil
}

func (w *sqlxDBWrapper) Get(dest any, query string, args ...any) error {
	query = w.DB.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErr(w.DB.GetContext(ctx, dest, query, args...))
}

func (w *sqlxDBWrapper) GetBuilder(dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.Get(dest, query, args...)
}

func (w *sqlxDBWrapper) NamedExec(query string, arg any) (sql.Result, error) {
	if w.DB.DriverName() == model.DatabaseDriverPostgres {
		query = namedParamRegex.ReplaceAllStringFunc(query, strings.ToLower)
	}
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), arg)
		}(time.Now())
	}

	return w.checkErrWithResult(w.DB.NamedExecContext(ctx, query, arg))
}

func (w *sqlxDBWrapper) Exec(query string, args ...any) (sql.Result, error) {
	query = w.DB.Rebind(query)

	return w.ExecRaw(query, args...)
}

func (w *sqlxDBWrapper) ExecBuilder(builder Builder) (sql.Result, error) {
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	return w.Exec(query, args...)
}

func (w *sqlxDBWrapper) ExecNoTimeout(query string, args ...any) (sql.Result, error) {
	query = w.DB.Rebind(query)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErrWithResult(w.DB.ExecContext(context.Background(), query, args...))
}

// ExecRaw is like Exec but without any rebinding of params. You need to pass
// the exact param types of your target database.
func (w *sqlxDBWrapper) ExecRaw(query string, args ...any) (sql.Result, error) {
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErrWithResult(w.DB.ExecContext(ctx, query, args...))
}

func (w *sqlxDBWrapper) NamedQuery(query string, arg any) (*sqlx.Rows, error) {
	if w.DB.DriverName() == model.DatabaseDriverPostgres {
		query = namedParamRegex.ReplaceAllStringFunc(query, strings.ToLower)
	}
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), arg)
		}(time.Now())
	}

	return w.checkErrWithRows(w.DB.NamedQueryContext(ctx, query, arg))
}

func (w *sqlxDBWrapper) QueryRowX(query string, args ...any) *sqlx.Row {
	query = w.DB.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.DB.QueryRowxContext(ctx, query, args...)
}

func (w *sqlxDBWrapper) QueryX(query string, args ...any) (*sqlx.Rows, error) {
	query = w.DB.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErrWithRows(w.DB.QueryxContext(ctx, query, args...))
}

func (w *sqlxDBWrapper) Select(dest any, query string, args ...any) error {
	return w.SelectCtx(context.Background(), dest, query, args...)
}

func (w *sqlxDBWrapper) SelectCtx(ctx context.Context, dest any, query string, args ...any) error {
	query = w.DB.Rebind(query)
	ctx, cancel := context.WithTimeout(ctx, w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErr(w.DB.SelectContext(ctx, dest, query, args...))
}

func (w *sqlxDBWrapper) SelectBuilder(dest any, builder Builder) error {
	return w.SelectBuilderCtx(context.Background(), dest, builder)
}

func (w *sqlxDBWrapper) SelectBuilderCtx(ctx context.Context, dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.SelectCtx(ctx, dest, query, args...)
}

type sqlxTxWrapper struct {
	*sqlx.Tx
	queryTimeout time.Duration
	trace        bool
	dbw          *sqlxDBWrapper
}

func newSqlxTxWrapper(tx *sqlx.Tx, timeout time.Duration, trace bool, dbw *sqlxDBWrapper) *sqlxTxWrapper {
	return &sqlxTxWrapper{
		Tx:           tx,
		queryTimeout: timeout,
		trace:        trace,
		dbw:          dbw,
	}
}

func (w *sqlxTxWrapper) Get(dest any, query string, args ...any) error {
	query = w.Tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErr(w.Tx.GetContext(ctx, dest, query, args...))
}

func (w *sqlxTxWrapper) GetBuilder(dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.dbw.checkErr(w.Get(dest, query, args...))
}

func (w *sqlxTxWrapper) Exec(query string, args ...any) (sql.Result, error) {
	query = w.Tx.Rebind(query)

	return w.dbw.checkErrWithResult(w.ExecRaw(query, args...))
}

func (w *sqlxTxWrapper) ExecNoTimeout(query string, args ...any) (sql.Result, error) {
	query = w.Tx.Rebind(query)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErrWithResult(w.Tx.ExecContext(context.Background(), query, args...))
}

func (w *sqlxTxWrapper) ExecBuilder(builder Builder) (sql.Result, error) {
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	return w.Exec(query, args...)
}

// ExecRaw is like Exec but without any rebinding of params. You need to pass
// the exact param types of your target database.
func (w *sqlxTxWrapper) ExecRaw(query string, args ...any) (sql.Result, error) {
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErrWithResult(w.Tx.ExecContext(ctx, query, args...))
}

func (w *sqlxTxWrapper) NamedExec(query string, arg any) (sql.Result, error) {
	if w.Tx.DriverName() == model.DatabaseDriverPostgres {
		query = namedParamRegex.ReplaceAllStringFunc(query, strings.ToLower)
	}
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), arg)
		}(time.Now())
	}

	return w.dbw.checkErrWithResult(w.Tx.NamedExecContext(ctx, query, arg))
}

func (w *sqlxTxWrapper) NamedQuery(query string, arg any) (*sqlx.Rows, error) {
	if w.Tx.DriverName() == model.DatabaseDriverPostgres {
		query = namedParamRegex.ReplaceAllStringFunc(query, strings.ToLower)
	}
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), arg)
		}(time.Now())
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

	// staticcheck fails to check that res gets re-assigned later.
	res := &result{} //nolint:staticcheck
	select {
	case res = <-resChan:
	case <-ctx.Done():
		res = &result{
			rows: nil,
			err:  ctx.Err(),
		}
	}

	return res.rows, w.dbw.checkErr(res.err)
}

func (w *sqlxTxWrapper) QueryRowX(query string, args ...any) *sqlx.Row {
	query = w.Tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.Tx.QueryRowxContext(ctx, query, args...)
}

func (w *sqlxTxWrapper) QueryX(query string, args ...any) (*sqlx.Rows, error) {
	query = w.Tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErrWithRows(w.Tx.QueryxContext(ctx, query, args...))
}

func (w *sqlxTxWrapper) Select(dest any, query string, args ...any) error {
	query = w.Tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErr(w.Tx.SelectContext(ctx, dest, query, args...))
}

func (w *sqlxTxWrapper) SelectBuilder(dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.Select(dest, query, args...)
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

func printArgs(query string, dur time.Duration, args ...any) {
	query = strings.Map(removeSpace, query)
	fields := make([]mlog.Field, 0, len(args)+1)
	fields = append(fields, mlog.Duration("duration", dur))
	for i, arg := range args {
		fields = append(fields, mlog.Any("arg"+strconv.Itoa(i), arg))
	}
	mlog.Debug(query, fields...)
}

func (w *sqlxDBWrapper) checkErrWithResult(res sql.Result, err error) (sql.Result, error) {
	return res, w.checkErr(err)
}

func (w *sqlxDBWrapper) checkErrWithRows(res *sqlx.Rows, err error) (*sqlx.Rows, error) {
	return res, w.checkErr(err)
}

func (w *sqlxDBWrapper) checkErr(err error) error {
	var netError *net.OpError
	if errors.As(err, &netError) && (!netError.Temporary() && !netError.Timeout()) {
		w.isOnline.Store(false)
	}
	return err
}

func (w *sqlxDBWrapper) Online() bool {
	return w.isOnline.Load()
}
