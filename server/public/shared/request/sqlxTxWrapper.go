package request

import (
	"context"
	"database/sql"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/pkg/errors"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
	"unicode"
)

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

type SQLxTxWrapper struct {
	*sqlx.Tx
	queryTimeout time.Duration
	trace        bool
	dbw          *SQLxDBWrapper
}

func newSqlxTxWrapper(tx *sqlx.Tx, timeout time.Duration, trace bool, dbw *SQLxDBWrapper) *SQLxTxWrapper {
	return &SQLxTxWrapper{
		Tx:           tx,
		queryTimeout: timeout,
		trace:        trace,
		dbw:          dbw,
	}
}

func (w *SQLxTxWrapper) Get(dest any, query string, args ...any) error {
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

func (w *SQLxTxWrapper) GetBuilder(dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.dbw.checkErr(w.Get(dest, query, args...))
}

func (w *SQLxTxWrapper) Exec(query string, args ...any) (sql.Result, error) {
	query = w.Tx.Rebind(query)

	return w.dbw.checkErrWithResult(w.ExecRaw(query, args...))
}

func (w *SQLxTxWrapper) ExecNoTimeout(query string, args ...any) (sql.Result, error) {
	query = w.Tx.Rebind(query)

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErrWithResult(w.Tx.ExecContext(context.Background(), query, args...))
}

func (w *SQLxTxWrapper) ExecBuilder(builder Builder) (sql.Result, error) {
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	return w.Exec(query, args...)
}

// ExecRaw is like Exec but without any rebinding of params. You need to pass
// the exact param types of your target database.
func (w *SQLxTxWrapper) ExecRaw(query string, args ...any) (sql.Result, error) {
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.dbw.checkErrWithResult(w.Tx.ExecContext(ctx, query, args...))
}

// namedParamRegex is used to capture all named parameters and convert them
// to lowercase. This is necessary to be able to use a single query for both
// Postgres and MySQL.
// This will also lowercase any constant strings containing a :, but sqlx
// will fail the query, so it won't be checked in inadvertently.
var namedParamRegex = regexp.MustCompile(`:\w+`)

func (w *SQLxTxWrapper) NamedExec(query string, arg any) (sql.Result, error) {
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

func (w *SQLxTxWrapper) NamedQuery(query string, arg any) (*sqlx.Rows, error) {
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

func (w *SQLxTxWrapper) QueryRowX(query string, args ...any) *sqlx.Row {
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

func (w *SQLxTxWrapper) QueryX(query string, args ...any) (*sqlx.Rows, error) {
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

func (w *SQLxTxWrapper) Select(dest any, query string, args ...any) error {
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

func (w *SQLxTxWrapper) SelectBuilder(dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.Select(dest, query, args...)
}

type Builder interface {
	ToSql() (string, []any, error)
}

type SQLxDBWrapper struct {
	*sqlx.DB
	queryTimeout time.Duration
	trace        bool
	isOnline     *atomic.Bool
}

func NewSqlxDBWrapper(db *sqlx.DB, timeout time.Duration, trace bool) *SQLxDBWrapper {
	w := &SQLxDBWrapper{
		DB:           db,
		queryTimeout: timeout,
		trace:        trace,
		isOnline:     &atomic.Bool{},
	}
	w.isOnline.Store(true)
	return w
}

func (w *SQLxDBWrapper) Stats() sql.DBStats {
	return w.DB.Stats()
}

func (w *SQLxDBWrapper) Beginx() (*SQLxTxWrapper, error) {
	tx, err := w.DB.Beginx()
	if err != nil {
		return nil, w.checkErr(err)
	}

	return newSqlxTxWrapper(tx, w.queryTimeout, w.trace, w), nil
}

func (w *SQLxDBWrapper) BeginXWithIsolation(opts *sql.TxOptions) (*SQLxTxWrapper, error) {
	tx, err := w.DB.BeginTxx(context.Background(), opts)
	if err != nil {
		return nil, w.checkErr(err)
	}

	return newSqlxTxWrapper(tx, w.queryTimeout, w.trace, w), nil
}

func (w *SQLxDBWrapper) Get(dest any, query string, args ...any) error {
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

func (w *SQLxDBWrapper) GetBuilder(dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.Get(dest, query, args...)
}

func (w *SQLxDBWrapper) NamedExec(query string, arg any) (sql.Result, error) {
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

func (w *SQLxDBWrapper) Exec(query string, args ...any) (sql.Result, error) {
	query = w.DB.Rebind(query)

	return w.ExecRaw(query, args...)
}

func (w *SQLxDBWrapper) ExecBuilder(builder Builder) (sql.Result, error) {
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	return w.Exec(query, args...)
}

func (w *SQLxDBWrapper) ExecNoTimeout(query string, args ...any) (sql.Result, error) {
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
func (w *SQLxDBWrapper) ExecRaw(query string, args ...any) (sql.Result, error) {
	ctx, cancel := context.WithTimeout(context.Background(), w.queryTimeout)
	defer cancel()

	if w.trace {
		defer func(then time.Time) {
			printArgs(query, time.Since(then), args)
		}(time.Now())
	}

	return w.checkErrWithResult(w.DB.ExecContext(ctx, query, args...))
}

func (w *SQLxDBWrapper) NamedQuery(query string, arg any) (*sqlx.Rows, error) {
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

func (w *SQLxDBWrapper) QueryRowX(query string, args ...any) *sqlx.Row {
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

func (w *SQLxDBWrapper) QueryX(query string, args ...any) (*sqlx.Rows, error) {
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

func (w *SQLxDBWrapper) Select(dest any, query string, args ...any) error {
	return w.SelectCtx(context.Background(), dest, query, args...)
}

func (w *SQLxDBWrapper) SelectCtx(ctx context.Context, dest any, query string, args ...any) error {
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

func (w *SQLxDBWrapper) SelectBuilder(dest any, builder Builder) error {
	return w.SelectBuilderCtx(context.Background(), dest, builder)
}

func (w *SQLxDBWrapper) SelectBuilderCtx(ctx context.Context, dest any, builder Builder) error {
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	return w.SelectCtx(ctx, dest, query, args...)
}

func (w *SQLxDBWrapper) checkErrWithResult(res sql.Result, err error) (sql.Result, error) {
	return res, w.checkErr(err)
}

func (w *SQLxDBWrapper) checkErrWithRows(res *sqlx.Rows, err error) (*sqlx.Rows, error) {
	return res, w.checkErr(err)
}

func (w *SQLxDBWrapper) checkErr(err error) error {
	var netError *net.OpError
	if errors.As(err, &netError) && (!netError.Temporary() && !netError.Timeout()) {
		w.isOnline.Store(false)
	}
	return err
}

func (w *SQLxDBWrapper) Online() bool {
	return w.isOnline.Load()
}
