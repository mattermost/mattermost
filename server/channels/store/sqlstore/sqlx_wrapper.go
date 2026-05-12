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
	QueryRowX(query string, args ...any) *sqlxRow
	QueryX(query string, args ...any) (*sqlx.Rows, error)
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

func (w *sqlxDBWrapper) Beginx() (*sqlxTxWrapper, error) {
	tx, err := w.db.Beginx()
	if err != nil {
		return nil, w.checkErr(err)
	}

	return newSqlxTxWrapper(tx, w.queryTimeout, w.trace, w), nil
}

func (w *sqlxDBWrapper) BeginXWithIsolation(opts *sql.TxOptions) (*sqlxTxWrapper, error) {
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

func (w *sqlxDBWrapper) NamedQuery(query string, arg any) (*sqlx.Rows, error) {
	query = namedParamRegex.ReplaceAllStringFunc(query, strings.ToLower)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), arg)
		}(time.Now())
	}

	return w.checkErrWithRows(w.db.NamedQueryContext(ctx, query, arg))
}

// QueryRowxContext forwards to the underlying *sqlx.DB with the caller-supplied context.
// The caller is responsible for applying an appropriate timeout.
func (w *sqlxDBWrapper) QueryRowxContext(ctx context.Context, query string, args ...any) *sqlx.Row {
	return w.db.QueryRowxContext(ctx, query, args...)
}

func (w *sqlxDBWrapper) QueryRow(query string, args ...any) *sqlxRow {
	return w.QueryRowX(query, args...)
}

func (w *sqlxDBWrapper) QueryRowX(query string, args ...any) *sqlxRow {
	query = w.db.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return &sqlxRow{row: w.db.QueryRowxContext(ctx, query, args...), cancel: cancel}
}

func (w *sqlxDBWrapper) QueryX(query string, args ...any) (*sqlx.Rows, error) {
	query = w.db.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErrWithRows(w.db.QueryxContext(ctx, query, args...))
}

// Query forwards to the underlying *sql.DB without adding a timeout.
// Callers that need timeout enforcement should use Select or QueryX instead.
func (w *sqlxDBWrapper) Query(query string, args ...any) (*sql.Rows, error) {
	rows, err := w.db.Query(query, args...)
	return rows, w.checkErr(err)
}

// ExecContext forwards to the underlying DB with the caller-supplied context.
// The caller is responsible for applying an appropriate timeout.
func (w *sqlxDBWrapper) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return w.checkErrWithResult(w.db.ExecContext(ctx, query, args...))
}

func (w *sqlxDBWrapper) Select(dest any, query string, args ...any) error {
	return w.SelectCtx(context.Background(), dest, query, args...)
}

func (w *sqlxDBWrapper) SelectCtx(ctx context.Context, dest any, query string, args ...any) error {
	query = w.db.Rebind(query)
	ctx, cancel := context.WithTimeout(ctx, w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErr(w.db.SelectContext(ctx, dest, query, args...))
}

// QueryRowContext forwards to the underlying DB with the caller-supplied context.
// The caller is responsible for applying an appropriate timeout.
func (w *sqlxDBWrapper) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return w.db.QueryRowContext(ctx, query, args...)
}

// QueryContext forwards to the underlying DB with the caller-supplied context.
// The caller is responsible for applying an appropriate timeout.
func (w *sqlxDBWrapper) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	rows, err := w.db.QueryContext(ctx, query, args...)
	return rows, w.checkErr(err)
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

func (w *sqlxTxWrapper) NamedQuery(query string, arg any) (*sqlx.Rows, error) {
	query = namedParamRegex.ReplaceAllStringFunc(query, strings.ToLower)
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
		rows, err := w.tx.NamedQuery(query, arg)
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

func (w *sqlxTxWrapper) QueryRowX(query string, args ...any) *sqlxRow {
	query = w.tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return &sqlxRow{row: w.tx.QueryRowxContext(ctx, query, args...), cancel: cancel}
}

func (w *sqlxTxWrapper) QueryX(query string, args ...any) (*sqlx.Rows, error) {
	query = w.tx.Rebind(query)
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErrWithRows(w.tx.QueryxContext(ctx, query, args...))
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

// Query forwards to the underlying *sqlx.Tx without adding a timeout.
// Callers that need timeout enforcement should use Select or QueryX instead.
func (w *sqlxTxWrapper) Query(query string, args ...any) (*sql.Rows, error) {
	rows, err := w.tx.Query(query, args...)
	return rows, w.dbw.checkErr(err)
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
