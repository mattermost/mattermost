// +build go1.9

package mysql

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"fmt"
	"io"
	"io/ioutil"
	nurl "net/url"
	"strconv"
	"strings"
)

import (
	"github.com/go-sql-driver/mysql"
	"github.com/hashicorp/go-multierror"
)

import (
	"github.com/golang-migrate/migrate/v4/database"
)

func init() {
	database.Register("mysql", &Mysql{})
}

var DefaultMigrationsTable = "schema_migrations"

var (
	ErrDatabaseDirty    = fmt.Errorf("database is dirty")
	ErrNilConfig        = fmt.Errorf("no config")
	ErrNoDatabaseName   = fmt.Errorf("no database name")
	ErrAppendPEM        = fmt.Errorf("failed to append PEM")
	ErrTLSCertKeyConfig = fmt.Errorf("To use TLS client authentication, both x-tls-cert and x-tls-key must not be empty")
)

type Config struct {
	MigrationsTable string
	DatabaseName    string
	NoLock          bool
}

type Mysql struct {
	// mysql RELEASE_LOCK must be called from the same conn, so
	// just do everything over a single conn anyway.
	conn     *sql.Conn
	db       *sql.DB
	isLocked bool

	config *Config
}

// instance must have `multiStatements` set to true
func WithInstance(instance *sql.DB, config *Config) (database.Driver, error) {
	if config == nil {
		return nil, ErrNilConfig
	}

	if err := instance.Ping(); err != nil {
		return nil, err
	}

	if config.DatabaseName == "" {
		query := `SELECT DATABASE()`
		var databaseName sql.NullString
		if err := instance.QueryRow(query).Scan(&databaseName); err != nil {
			return nil, &database.Error{OrigErr: err, Query: []byte(query)}
		}

		if len(databaseName.String) == 0 {
			return nil, ErrNoDatabaseName
		}

		config.DatabaseName = databaseName.String
	}

	if len(config.MigrationsTable) == 0 {
		config.MigrationsTable = DefaultMigrationsTable
	}

	conn, err := instance.Conn(context.Background())
	if err != nil {
		return nil, err
	}

	mx := &Mysql{
		conn:   conn,
		db:     instance,
		config: config,
	}

	if err := mx.ensureVersionTable(); err != nil {
		return nil, err
	}

	return mx, nil
}

// extractCustomQueryParams extracts the custom query params (ones that start with "x-") from
// mysql.Config.Params (connection parameters) as to not interfere with connecting to MySQL
func extractCustomQueryParams(c *mysql.Config) (map[string]string, error) {
	if c == nil {
		return nil, ErrNilConfig
	}
	customQueryParams := map[string]string{}

	for k, v := range c.Params {
		if strings.HasPrefix(k, "x-") {
			customQueryParams[k] = v
			delete(c.Params, k)
		}
	}
	return customQueryParams, nil
}

func urlToMySQLConfig(url string) (*mysql.Config, error) {
	config, err := mysql.ParseDSN(strings.TrimPrefix(url, "mysql://"))
	if err != nil {
		return nil, err
	}

	config.MultiStatements = true

	// Keep backwards compatibility from when we used net/url.Parse() to parse the DSN.
	// net/url.Parse() would automatically unescape it for us.
	// See: https://play.golang.org/p/q9j1io-YICQ
	user, err := nurl.QueryUnescape(config.User)
	if err != nil {
		return nil, err
	}
	config.User = user

	password, err := nurl.QueryUnescape(config.Passwd)
	if err != nil {
		return nil, err
	}
	config.Passwd = password

	// use custom TLS?
	ctls := config.TLSConfig
	if len(ctls) > 0 {
		if _, isBool := readBool(ctls); !isBool && strings.ToLower(ctls) != "skip-verify" {
			rootCertPool := x509.NewCertPool()
			pem, err := ioutil.ReadFile(config.Params["x-tls-ca"])
			if err != nil {
				return nil, err
			}

			if ok := rootCertPool.AppendCertsFromPEM(pem); !ok {
				return nil, ErrAppendPEM
			}

			clientCert := make([]tls.Certificate, 0, 1)
			if ccert, ckey := config.Params["x-tls-cert"], config.Params["x-tls-key"]; ccert != "" || ckey != "" {
				if ccert == "" || ckey == "" {
					return nil, ErrTLSCertKeyConfig
				}
				certs, err := tls.LoadX509KeyPair(ccert, ckey)
				if err != nil {
					return nil, err
				}
				clientCert = append(clientCert, certs)
			}

			insecureSkipVerify := false
			if len(config.Params["x-tls-insecure-skip-verify"]) > 0 {
				x, err := strconv.ParseBool(config.Params["x-tls-insecure-skip-verify"])
				if err != nil {
					return nil, err
				}
				insecureSkipVerify = x
			}

			err = mysql.RegisterTLSConfig(ctls, &tls.Config{
				RootCAs:            rootCertPool,
				Certificates:       clientCert,
				InsecureSkipVerify: insecureSkipVerify,
			})
			if err != nil {
				return nil, err
			}
		}
	}

	return config, nil
}

func (m *Mysql) Open(url string) (database.Driver, error) {
	config, err := urlToMySQLConfig(url)
	if err != nil {
		return nil, err
	}

	customParams, err := extractCustomQueryParams(config)
	if err != nil {
		return nil, err
	}

	noLockParam, noLock := customParams["x-no-lock"], false
	if noLockParam != "" {
		noLock, err = strconv.ParseBool(noLockParam)
		if err != nil {
			return nil, fmt.Errorf("could not parse x-no-lock as bool: %w", err)
		}
	}

	db, err := sql.Open("mysql", config.FormatDSN())
	if err != nil {
		return nil, err
	}

	mx, err := WithInstance(db, &Config{
		DatabaseName:    config.DBName,
		MigrationsTable: customParams["x-migrations-table"],
		NoLock:          noLock,
	})
	if err != nil {
		return nil, err
	}

	return mx, nil
}

func (m *Mysql) Close() error {
	connErr := m.conn.Close()
	dbErr := m.db.Close()
	if connErr != nil || dbErr != nil {
		return fmt.Errorf("conn: %v, db: %v", connErr, dbErr)
	}
	return nil
}

func (m *Mysql) Lock() error {
	if m.isLocked {
		return database.ErrLocked
	}

	if m.config.NoLock {
		m.isLocked = true
		return nil
	}

	aid, err := database.GenerateAdvisoryLockId(
		fmt.Sprintf("%s:%s", m.config.DatabaseName, m.config.MigrationsTable))
	if err != nil {
		return err
	}

	query := "SELECT GET_LOCK(?, 10)"
	var success bool
	if err := m.conn.QueryRowContext(context.Background(), query, aid).Scan(&success); err != nil {
		return &database.Error{OrigErr: err, Err: "try lock failed", Query: []byte(query)}
	}

	if success {
		m.isLocked = true
		return nil
	}

	return database.ErrLocked
}

func (m *Mysql) Unlock() error {
	if !m.isLocked {
		return nil
	}

	if m.config.NoLock {
		m.isLocked = false
		return nil
	}

	aid, err := database.GenerateAdvisoryLockId(
		fmt.Sprintf("%s:%s", m.config.DatabaseName, m.config.MigrationsTable))
	if err != nil {
		return err
	}

	query := `SELECT RELEASE_LOCK(?)`
	if _, err := m.conn.ExecContext(context.Background(), query, aid); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}

	// NOTE: RELEASE_LOCK could return NULL or (or 0 if the code is changed),
	// in which case isLocked should be true until the timeout expires -- synchronizing
	// these states is likely not worth trying to do; reconsider the necessity of isLocked.

	m.isLocked = false
	return nil
}

func (m *Mysql) Run(migration io.Reader) error {
	migr, err := ioutil.ReadAll(migration)
	if err != nil {
		return err
	}

	query := string(migr[:])
	if _, err := m.conn.ExecContext(context.Background(), query); err != nil {
		return database.Error{OrigErr: err, Err: "migration failed", Query: migr}
	}

	return nil
}

func (m *Mysql) SetVersion(version int, dirty bool) error {
	tx, err := m.conn.BeginTx(context.Background(), &sql.TxOptions{})
	if err != nil {
		return &database.Error{OrigErr: err, Err: "transaction start failed"}
	}

	query := "TRUNCATE `" + m.config.MigrationsTable + "`"
	if _, err := tx.ExecContext(context.Background(), query); err != nil {
		if errRollback := tx.Rollback(); errRollback != nil {
			err = multierror.Append(err, errRollback)
		}
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}

	// Also re-write the schema version for nil dirty versions to prevent
	// empty schema version for failed down migration on the first migration
	// See: https://github.com/golang-migrate/migrate/issues/330
	if version >= 0 || (version == database.NilVersion && dirty) {
		query := "INSERT INTO `" + m.config.MigrationsTable + "` (version, dirty) VALUES (?, ?)"
		if _, err := tx.ExecContext(context.Background(), query, version, dirty); err != nil {
			if errRollback := tx.Rollback(); errRollback != nil {
				err = multierror.Append(err, errRollback)
			}
			return &database.Error{OrigErr: err, Query: []byte(query)}
		}
	}

	if err := tx.Commit(); err != nil {
		return &database.Error{OrigErr: err, Err: "transaction commit failed"}
	}

	return nil
}

func (m *Mysql) Version() (version int, dirty bool, err error) {
	query := "SELECT version, dirty FROM `" + m.config.MigrationsTable + "` LIMIT 1"
	err = m.conn.QueryRowContext(context.Background(), query).Scan(&version, &dirty)
	switch {
	case err == sql.ErrNoRows:
		return database.NilVersion, false, nil

	case err != nil:
		if e, ok := err.(*mysql.MySQLError); ok {
			if e.Number == 0 {
				return database.NilVersion, false, nil
			}
		}
		return 0, false, &database.Error{OrigErr: err, Query: []byte(query)}

	default:
		return version, dirty, nil
	}
}

func (m *Mysql) Drop() (err error) {
	// select all tables
	query := `SHOW TABLES LIKE '%'`
	tables, err := m.conn.QueryContext(context.Background(), query)
	if err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}
	defer func() {
		if errClose := tables.Close(); errClose != nil {
			err = multierror.Append(err, errClose)
		}
	}()

	// delete one table after another
	tableNames := make([]string, 0)
	for tables.Next() {
		var tableName string
		if err := tables.Scan(&tableName); err != nil {
			return err
		}
		if len(tableName) > 0 {
			tableNames = append(tableNames, tableName)
		}
	}

	if len(tableNames) > 0 {
		// disable checking foreign key constraints until finished
		query = `SET foreign_key_checks = 0`
		if _, err := m.conn.ExecContext(context.Background(), query); err != nil {
			return &database.Error{OrigErr: err, Query: []byte(query)}
		}

		defer func() {
			// enable foreign key checks
			_, _ = m.conn.ExecContext(context.Background(), `SET foreign_key_checks = 1`)
		}()

		// delete one by one ...
		for _, t := range tableNames {
			query = "DROP TABLE IF EXISTS `" + t + "`"
			if _, err := m.conn.ExecContext(context.Background(), query); err != nil {
				return &database.Error{OrigErr: err, Query: []byte(query)}
			}
		}
	}

	return nil
}

// ensureVersionTable checks if versions table exists and, if not, creates it.
// Note that this function locks the database, which deviates from the usual
// convention of "caller locks" in the Mysql type.
func (m *Mysql) ensureVersionTable() (err error) {
	if err = m.Lock(); err != nil {
		return err
	}

	defer func() {
		if e := m.Unlock(); e != nil {
			if err == nil {
				err = e
			} else {
				err = multierror.Append(err, e)
			}
		}
	}()

	// check if migration table exists
	var result string
	query := `SHOW TABLES LIKE "` + m.config.MigrationsTable + `"`
	if err := m.conn.QueryRowContext(context.Background(), query).Scan(&result); err != nil {
		if err != sql.ErrNoRows {
			return &database.Error{OrigErr: err, Query: []byte(query)}
		}
	} else {
		return nil
	}

	// if not, create the empty migration table
	query = "CREATE TABLE `" + m.config.MigrationsTable + "` (version bigint not null primary key, dirty boolean not null)"
	if _, err := m.conn.ExecContext(context.Background(), query); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}
	return nil
}

// Returns the bool value of the input.
// The 2nd return value indicates if the input was a valid bool value
// See https://github.com/go-sql-driver/mysql/blob/a059889267dc7170331388008528b3b44479bffb/utils.go#L71
func readBool(input string) (value bool, valid bool) {
	switch input {
	case "1", "true", "TRUE", "True":
		return true, true
	case "0", "false", "FALSE", "False":
		return false, true
	}

	// Not a valid bool value
	return
}
