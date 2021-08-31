package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	mysqlDBType    = "mysql"
	sqliteDBType   = "sqlite3"
	postgresDBType = "postgres"
)

// SQLStore is a SQL database.
type SQLStore struct {
	db               *sql.DB
	dbType           string
	tablePrefix      string
	connectionString string
	logger           *mlog.Logger
}

// New creates a new SQL implementation of the store.
func New(dbType, connectionString, tablePrefix string, logger *mlog.Logger, db *sql.DB) (*SQLStore, error) {
	logger.Info("connectDatabase", mlog.String("dbType", dbType), mlog.String("connStr", connectionString))
	store := &SQLStore{
		// TODO: add replica DB support too.
		db:               db,
		dbType:           dbType,
		tablePrefix:      tablePrefix,
		connectionString: connectionString,
		logger:           logger,
	}

	err := store.Migrate()
	if err != nil {
		logger.Error(`Table creation / migration failed`, mlog.Err(err))

		return nil, err
	}

	err = store.InitializeTemplates()
	if err != nil {
		logger.Error(`InitializeTemplates failed`, mlog.Err(err))

		return nil, err
	}

	return store, nil
}

// Shutdown close the connection with the store.
func (s *SQLStore) Shutdown() error {
	return s.db.Close()
}

// DBHandle returns the raw sql.DB handle.
// It is used by the mattermostauthlayer to run their own
// raw SQL queries.
func (s *SQLStore) DBHandle() *sql.DB {
	return s.db
}

func (s *SQLStore) getQueryBuilder() sq.StatementBuilderType {
	builder := sq.StatementBuilder
	if s.dbType == postgresDBType || s.dbType == sqliteDBType {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	return builder.RunWith(s.db)
}

func (s *SQLStore) escapeField(fieldName string) string { //nolint:unparam
	if s.dbType == mysqlDBType {
		return "`" + fieldName + "`"
	}
	if s.dbType == postgresDBType || s.dbType == sqliteDBType {
		return "\"" + fieldName + "\""
	}
	return fieldName
}
