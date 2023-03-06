package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/sirupsen/logrus"

	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

// maxJSONLength holds the limit we set for JSON data in postgres
// Since JSON data type is unboounded, we need to set a limit
// that we'll control manually.
const maxJSONLength = 256 * 1024 // 256KB

type SQLStore struct {
	db        *sqlx.DB
	builder   sq.StatementBuilderType
	scheduler app.JobOnceScheduler
}

// New constructs a new instance of SQLStore.
func New(pluginAPI PluginAPIClient, scheduler app.JobOnceScheduler) (*SQLStore, error) {
	var db *sqlx.DB

	origDB, err := pluginAPI.Store.GetMasterDB()
	if err != nil {
		return nil, err
	}
	db = sqlx.NewDb(origDB, pluginAPI.Store.DriverName())

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if pluginAPI.Store.DriverName() == model.DatabaseDriverPostgres {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	if pluginAPI.Store.DriverName() == model.DatabaseDriverMysql {
		db.MapperFunc(func(s string) string { return s })
	}

	return &SQLStore{
		db,
		builder,
		scheduler,
	}, nil
}

// queryer is an interface describing a resource that can query.
//
// It exactly matches sqlx.Queryer, existing simply to constrain sqlx usage to this file.
type queryer interface {
	sqlx.Queryer
}

// builder is an interface describing a resource that can construct SQL and arguments.
//
// It exists to allow consuming any squirrel.*Builder type.
type builder interface {
	ToSql() (string, []interface{}, error)
}

// get queries for a single row, building the sql, and writing the result into dest.
//
// Use this to simplify querying for a single row or column. Dest may be a pointer to a simple
// type, or a struct with fields to be populated from the returned columns.
func (sqlStore *SQLStore) getBuilder(q sqlx.Queryer, dest interface{}, b builder) error {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	sqlString = sqlStore.db.Rebind(sqlString)

	return sqlx.Get(q, dest, sqlString, args...)
}

// selectBuilder queries for one or more rows, building the sql, and writing the result into dest.
//
// Use this to simplify querying for multiple rows (and possibly columns). Dest may be a slice of
// a simple, or a slice of a struct with fields to be populated from the returned columns.
func (sqlStore *SQLStore) selectBuilder(q sqlx.Queryer, dest interface{}, b builder) error {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	sqlString = sqlStore.db.Rebind(sqlString)

	return sqlx.Select(q, dest, sqlString, args...)
}

// execer is an interface describing a resource that can execute write queries.
//
// It allows the use of *sqlx.Db and *sqlx.Tx.
type execer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
	DriverName() string
}

type queryExecer interface {
	queryer
	execer
}

// exec executes the given query using positional arguments, automatically rebinding for the db.
func (sqlStore *SQLStore) exec(e execer, sqlString string, args ...interface{}) (sql.Result, error) {
	sqlString = sqlStore.db.Rebind(sqlString)
	return e.Exec(sqlString, args...)
}

// exec executes the given query, building the necessary sql.
func (sqlStore *SQLStore) execBuilder(e execer, b builder) (sql.Result, error) {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build sql")
	}

	return sqlStore.exec(e, sqlString, args...)
}

// finalizeTransaction ensures a transaction is closed after use, rolling back if not already committed.
func (sqlStore *SQLStore) finalizeTransaction(tx *sqlx.Tx) {
	// Rollback returns sql.ErrTxDone if the transaction was already closed.
	if err := tx.Rollback(); err != nil && err != sql.ErrTxDone {
		logrus.WithError(err).Error("Failed to rollback transaction")
	}
}
