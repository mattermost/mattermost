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

// sqlxRow wraps *sqlx.Row together with the context cancel function for the
// query that produced it. Scan calls cancel immediately after scanning so that
// the timeout context is released as soon as the row has been consumed, rather
// than waiting for the timer to fire.
type sqlxRow struct {
	row    *sqlx.Row
	cancel context.CancelFunc
}

func (r *sqlxRow) Scan(dest ...any) error {
	defer r.cancel()
	return r.row.Scan(dest...)
}

// sqlxRows wraps *sqlx.Rows together with the context cancel function for the
// query that produced it. Close calls cancel so that timeout resources are
// released as soon as the caller is done iterating, rather than waiting for
// the timer to fire.
type sqlxRows struct {
	*sqlx.Rows
	cancel context.CancelFunc
}

// Next advances the cursor and cancels the timeout context on EOF so that
// resources are released even when the caller exhausts the rows without an
// explicit Close.
func (r *sqlxRows) Next() bool {
	ok := r.Rows.Next()
	if !ok {
		r.cancel()
	}
	return ok
}

func (r *sqlxRows) Close() error {
	defer r.cancel()
	return r.Rows.Close()
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
	QueryRow(query string, args ...any) *sqlxRow
	Query(query string, args ...any) (*sqlxRows, error)
	Select(dest any, query string, args ...any) error
	SelectBuilder(dest any, builder Builder) error
}

// namedParamRegex is used to capture all named parameters and convert them to lowercase.
// This will also lowercase any constant strings containing a :, but sqlx
// will fail the query, so it won't be checked in inadvertently.
var namedParamRegex = regexp.MustCompile(`:\w+`)

type sqlxDBWrapper struct {
	db           *sqlx.DB
	queryTimeout time.Duration
	trace        bool
	isOnline     *atomic.Bool
}

func newSqlxDBWrapper(db *sqlx.DB, timeout time.Duration, trace bool) *sqlxDBWrapper {
	w := &sqlxDBWrapper{
		db:           db,
		queryTimeout: timeout,
		trace:        trace,
		isOnline:     &atomic.Bool{},
	}
	w.isOnline.Store(true)
	return w
}

// DB returns the underlying *sqlx.DB, for use by infrastructure code that
// requires the sqlx handle directly (e.g. the config store in tests).
func (w *sqlxDBWrapper) DB() *sqlx.DB {
	return w.db
}

func (w *sqlxDBWrapper) Stats() sql.DBStats {
	return w.db.Stats()
}

func (w *sqlxDBWrapper) Close() error {
	return w.db.Close()
}

func (w *sqlxDBWrapper) SetConnMaxLifetime(d time.Duration) {
	w.db.SetConnMaxLifetime(d)
}

func (w *sqlxDBWrapper) Rebind(query string) string {
	return w.db.Rebind(query)
}

// noTimeoutKey is the context key that opts a context out of automatic timeout
// injection by ensureQueryTimeout. Use noTimeoutContext() to create such a context.
type noTimeoutKey struct{}

// ensureQueryTimeout returns ctx unchanged if it already carries a deadline or
// has been explicitly marked as timeout-exempt (via noTimeoutContext), otherwise
// wraps it with the given timeout. Callers that complete synchronously should
// defer the returned cancel. Callers that return a handle to be consumed later
// (e.g. QueryRowContext) may discard it — the timer bounds any resource leak to
// at most timeout duration.
func ensureQueryTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if _, ok := ctx.Deadline(); ok {
		return ctx, func() {}
	}
	if ctx.Value(noTimeoutKey{}) != nil {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, timeout)
}

func (w *sqlxDBWrapper) Begin() (*sqlxTxWrapper, error) {
	tx, err := w.db.Beginx()
	if err != nil {
		return nil, w.checkErr(err)
	}

	return newSqlxTxWrapper(tx, w.queryTimeout, w.trace, w), nil
}

func (w *sqlxDBWrapper) BeginWithIsolation(opts *sql.TxOptions) (*sqlxTxWrapper, error) {
	tx, err := w.db.BeginTxx(context.Background(), opts)
	if err != nil {
		return nil, w.checkErr(err)
	}

	return newSqlxTxWrapper(tx, w.queryTimeout, w.trace, w), nil
}

func (w *sqlxDBWrapper) Get(dest any, query string, args ...any) error {
	query = w.db.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErr(w.db.GetContext(ctx, dest, query, args...))
}

func (w *sqlxDBWrapper) GetBuilder(dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.Get(dest, query, args...)
}

func (w *sqlxDBWrapper) NamedExec(query string, arg any) (sql.Result, error) {
	query = namedParamRegex.ReplaceAllStringFunc(query, strings.ToLower)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), arg)
		}(time.Now())
	}

	return w.checkErrWithResult(w.db.NamedExecContext(ctx, query, arg))
}

func (w *sqlxDBWrapper) Exec(query string, args ...any) (sql.Result, error) {
	query = w.db.Rebind(query)

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
	query = w.db.Rebind(query)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErrWithResult(w.db.ExecContext(context.Background(), query, args...))
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

	return w.checkErrWithResult(w.db.ExecContext(ctx, query, args...))
}

// QueryRowContext forwards to the underlying *sqlx.DB, adding the wrapper timeout
// if the caller's context carries no deadline. The cancel is released when the
// caller calls Scan on the returned *sqlxRow.
func (w *sqlxDBWrapper) QueryRowContext(ctx context.Context, query string, args ...any) *sqlxRow {
	query = w.db.Rebind(query)
	ctx, cancel := ensureQueryTimeout(ctx, w.queryTimeout)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return &sqlxRow{row: w.db.QueryRowxContext(ctx, query, args...), cancel: cancel}
}

func (w *sqlxDBWrapper) QueryRow(query string, args ...any) *sqlxRow {
	query = w.db.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return &sqlxRow{row: w.db.QueryRowxContext(ctx, query, args...), cancel: cancel}
}

func (w *sqlxDBWrapper) Query(query string, args ...any) (*sqlxRows, error) {
	query = w.db.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	rows, err := w.db.QueryxContext(ctx, query, args...)
	if err != nil {
		cancel()
		return nil, w.checkErr(err)
	}
	return &sqlxRows{Rows: rows, cancel: cancel}, nil
}

// ExecContext forwards to the underlying DB, adding the wrapper timeout if the
// caller's context carries no deadline.
func (w *sqlxDBWrapper) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	query = w.db.Rebind(query)
	ctx, cancel := ensureQueryTimeout(ctx, w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErrWithResult(w.db.ExecContext(ctx, query, args...))
}

func (w *sqlxDBWrapper) Select(dest any, query string, args ...any) error {
	return w.SelectContext(context.Background(), dest, query, args...)
}

func (w *sqlxDBWrapper) SelectContext(ctx context.Context, dest any, query string, args ...any) error {
	query = w.db.Rebind(query)
	ctx, cancel := ensureQueryTimeout(ctx, w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErr(w.db.SelectContext(ctx, dest, query, args...))
}

// QueryContext forwards to the underlying DB, adding the wrapper timeout if the
// caller's context carries no deadline. The cancel is released when the caller
// calls Close on the returned *sqlxRows (or when Next reaches EOF).
func (w *sqlxDBWrapper) QueryContext(ctx context.Context, query string, args ...any) (*sqlxRows, error) {
	query = w.db.Rebind(query)
	ctx, cancel := ensureQueryTimeout(ctx, w.queryTimeout)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	rows, err := w.db.QueryxContext(ctx, query, args...)
	if err != nil {
		cancel()
		return nil, w.checkErr(err)
	}
	return &sqlxRows{Rows: rows, cancel: cancel}, nil
}

func (w *sqlxDBWrapper) SelectBuilder(dest any, builder Builder) error {
	return w.SelectBuilderCtx(context.Background(), dest, builder)
}

func (w *sqlxDBWrapper) SelectBuilderCtx(ctx context.Context, dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.SelectContext(ctx, dest, query, args...)
}

type sqlxTxWrapper struct {
	tx           *sqlx.Tx
	queryTimeout time.Duration
	trace        bool
	dbw          *sqlxDBWrapper
}

func newSqlxTxWrapper(tx *sqlx.Tx, timeout time.Duration, trace bool, dbw *sqlxDBWrapper) *sqlxTxWrapper {
	return &sqlxTxWrapper{
		tx:           tx,
		queryTimeout: timeout,
		trace:        trace,
		dbw:          dbw,
	}
}

func (w *sqlxTxWrapper) Commit() error {
	return w.tx.Commit()
}

func (w *sqlxTxWrapper) Rollback() error {
	return w.tx.Rollback()
}

func (w *sqlxTxWrapper) Get(dest any, query string, args ...any) error {
	query = w.tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErr(w.tx.GetContext(ctx, dest, query, args...))
}

func (w *sqlxTxWrapper) GetBuilder(dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.dbw.checkErr(w.Get(dest, query, args...))
}

func (w *sqlxTxWrapper) Exec(query string, args ...any) (sql.Result, error) {
	query = w.tx.Rebind(query)

	return w.dbw.checkErrWithResult(w.ExecRaw(query, args...))
}

func (w *sqlxTxWrapper) ExecNoTimeout(query string, args ...any) (sql.Result, error) {
	query = w.tx.Rebind(query)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErrWithResult(w.tx.ExecContext(context.Background(), query, args...))
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

	return w.dbw.checkErrWithResult(w.tx.ExecContext(ctx, query, args...))
}

func (w *sqlxTxWrapper) NamedExec(query string, arg any) (sql.Result, error) {
	query = namedParamRegex.ReplaceAllStringFunc(query, strings.ToLower)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), arg)
		}(time.Now())
	}

	return w.dbw.checkErrWithResult(w.tx.NamedExecContext(ctx, query, arg))
}

func (w *sqlxTxWrapper) QueryRow(query string, args ...any) *sqlxRow {
	query = w.tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return &sqlxRow{row: w.tx.QueryRowxContext(ctx, query, args...), cancel: cancel}
}

func (w *sqlxTxWrapper) Query(query string, args ...any) (*sqlxRows, error) {
	query = w.tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	rows, err := w.tx.QueryxContext(ctx, query, args...)
	if err != nil {
		cancel()
		return nil, w.dbw.checkErr(err)
	}
	return &sqlxRows{Rows: rows, cancel: cancel}, nil
}

func (w *sqlxTxWrapper) Select(dest any, query string, args ...any) error {
	query = w.tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErr(w.tx.SelectContext(ctx, dest, query, args...))
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
