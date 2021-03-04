package cockroachdb

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"io/ioutil"
	nurl "net/url"
	"regexp"
	"strconv"
)

import (
	"github.com/cockroachdb/cockroach-go/crdb"
	"github.com/hashicorp/go-multierror"
	"github.com/lib/pq"
)

import (
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
)

func init() {
	db := CockroachDb{}
	database.Register("cockroach", &db)
	database.Register("cockroachdb", &db)
	database.Register("crdb-postgres", &db)
}

var DefaultMigrationsTable = "schema_migrations"
var DefaultLockTable = "schema_lock"

var (
	ErrNilConfig      = fmt.Errorf("no config")
	ErrNoDatabaseName = fmt.Errorf("no database name")
)

type Config struct {
	MigrationsTable string
	LockTable       string
	ForceLock       bool
	DatabaseName    string
}

type CockroachDb struct {
	db       *sql.DB
	isLocked bool

	// Open and WithInstance need to guarantee that config is never nil
	config *Config
}

func WithInstance(instance *sql.DB, config *Config) (database.Driver, error) {
	if config == nil {
		return nil, ErrNilConfig
	}

	if err := instance.Ping(); err != nil {
		return nil, err
	}

	if config.DatabaseName == "" {
		query := `SELECT current_database()`
		var databaseName string
		if err := instance.QueryRow(query).Scan(&databaseName); err != nil {
			return nil, &database.Error{OrigErr: err, Query: []byte(query)}
		}

		if len(databaseName) == 0 {
			return nil, ErrNoDatabaseName
		}

		config.DatabaseName = databaseName
	}

	if len(config.MigrationsTable) == 0 {
		config.MigrationsTable = DefaultMigrationsTable
	}

	if len(config.LockTable) == 0 {
		config.LockTable = DefaultLockTable
	}

	px := &CockroachDb{
		db:     instance,
		config: config,
	}

	// ensureVersionTable is a locking operation, so we need to ensureLockTable before we ensureVersionTable.
	if err := px.ensureLockTable(); err != nil {
		return nil, err
	}

	if err := px.ensureVersionTable(); err != nil {
		return nil, err
	}

	return px, nil
}

func (c *CockroachDb) Open(url string) (database.Driver, error) {
	purl, err := nurl.Parse(url)
	if err != nil {
		return nil, err
	}

	// As Cockroach uses the postgres protocol, and 'postgres' is already a registered database, we need to replace the
	// connect prefix, with the actual protocol, so that the library can differentiate between the implementations
	re := regexp.MustCompile("^(cockroach(db)?|crdb-postgres)")
	connectString := re.ReplaceAllString(migrate.FilterCustomQuery(purl).String(), "postgres")

	db, err := sql.Open("postgres", connectString)
	if err != nil {
		return nil, err
	}

	migrationsTable := purl.Query().Get("x-migrations-table")
	if len(migrationsTable) == 0 {
		migrationsTable = DefaultMigrationsTable
	}

	lockTable := purl.Query().Get("x-lock-table")
	if len(lockTable) == 0 {
		lockTable = DefaultLockTable
	}

	forceLockQuery := purl.Query().Get("x-force-lock")
	forceLock, err := strconv.ParseBool(forceLockQuery)
	if err != nil {
		forceLock = false
	}

	px, err := WithInstance(db, &Config{
		DatabaseName:    purl.Path,
		MigrationsTable: migrationsTable,
		LockTable:       lockTable,
		ForceLock:       forceLock,
	})
	if err != nil {
		return nil, err
	}

	return px, nil
}

func (c *CockroachDb) Close() error {
	return c.db.Close()
}

// Locking is done manually with a separate lock table.  Implementing advisory locks in CRDB is being discussed
// See: https://github.com/cockroachdb/cockroach/issues/13546
func (c *CockroachDb) Lock() error {
	err := crdb.ExecuteTx(context.Background(), c.db, nil, func(tx *sql.Tx) (err error) {
		aid, err := database.GenerateAdvisoryLockId(c.config.DatabaseName)
		if err != nil {
			return err
		}

		query := "SELECT * FROM " + c.config.LockTable + " WHERE lock_id = $1"
		rows, err := tx.Query(query, aid)
		if err != nil {
			return database.Error{OrigErr: err, Err: "failed to fetch migration lock", Query: []byte(query)}
		}
		defer func() {
			if errClose := rows.Close(); errClose != nil {
				err = multierror.Append(err, errClose)
			}
		}()

		// If row exists at all, lock is present
		locked := rows.Next()
		if locked && !c.config.ForceLock {
			return database.ErrLocked
		}

		query = "INSERT INTO " + c.config.LockTable + " (lock_id) VALUES ($1)"
		if _, err := tx.Exec(query, aid); err != nil {
			return database.Error{OrigErr: err, Err: "failed to set migration lock", Query: []byte(query)}
		}

		return nil
	})

	if err != nil {
		return err
	} else {
		c.isLocked = true
		return nil
	}
}

// Locking is done manually with a separate lock table.  Implementing advisory locks in CRDB is being discussed
// See: https://github.com/cockroachdb/cockroach/issues/13546
func (c *CockroachDb) Unlock() error {
	aid, err := database.GenerateAdvisoryLockId(c.config.DatabaseName)
	if err != nil {
		return err
	}

	// In the event of an implementation (non-migration) error, it is possible for the lock to not be released.  Until
	// a better locking mechanism is added, a manual purging of the lock table may be required in such circumstances
	query := "DELETE FROM " + c.config.LockTable + " WHERE lock_id = $1"
	if _, err := c.db.Exec(query, aid); err != nil {
		if e, ok := err.(*pq.Error); ok {
			// 42P01 is "UndefinedTableError" in CockroachDB
			// https://github.com/cockroachdb/cockroach/blob/master/pkg/sql/pgwire/pgerror/codes.go
			if e.Code == "42P01" {
				// On drops, the lock table is fully removed;  This is fine, and is a valid "unlocked" state for the schema
				c.isLocked = false
				return nil
			}
		}
		return database.Error{OrigErr: err, Err: "failed to release migration lock", Query: []byte(query)}
	}

	c.isLocked = false
	return nil
}

func (c *CockroachDb) Run(migration io.Reader) error {
	migr, err := ioutil.ReadAll(migration)
	if err != nil {
		return err
	}

	// run migration
	query := string(migr[:])
	if _, err := c.db.Exec(query); err != nil {
		return database.Error{OrigErr: err, Err: "migration failed", Query: migr}
	}

	return nil
}

func (c *CockroachDb) SetVersion(version int, dirty bool) error {
	return crdb.ExecuteTx(context.Background(), c.db, nil, func(tx *sql.Tx) error {
		if _, err := tx.Exec(`DELETE FROM "` + c.config.MigrationsTable + `"`); err != nil {
			return err
		}

		// Also re-write the schema version for nil dirty versions to prevent
		// empty schema version for failed down migration on the first migration
		// See: https://github.com/golang-migrate/migrate/issues/330
		if version >= 0 || (version == database.NilVersion && dirty) {
			if _, err := tx.Exec(`INSERT INTO "`+c.config.MigrationsTable+`" (version, dirty) VALUES ($1, $2)`, version, dirty); err != nil {
				return err
			}
		}

		return nil
	})
}

func (c *CockroachDb) Version() (version int, dirty bool, err error) {
	query := `SELECT version, dirty FROM "` + c.config.MigrationsTable + `" LIMIT 1`
	err = c.db.QueryRow(query).Scan(&version, &dirty)

	switch {
	case err == sql.ErrNoRows:
		return database.NilVersion, false, nil

	case err != nil:
		if e, ok := err.(*pq.Error); ok {
			// 42P01 is "UndefinedTableError" in CockroachDB
			// https://github.com/cockroachdb/cockroach/blob/master/pkg/sql/pgwire/pgerror/codes.go
			if e.Code == "42P01" {
				return database.NilVersion, false, nil
			}
		}
		return 0, false, &database.Error{OrigErr: err, Query: []byte(query)}

	default:
		return version, dirty, nil
	}
}

func (c *CockroachDb) Drop() (err error) {
	// select all tables in current schema
	query := `SELECT table_name FROM information_schema.tables WHERE table_schema=(SELECT current_schema())`
	tables, err := c.db.Query(query)
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
	if err := tables.Err(); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}

	if len(tableNames) > 0 {
		// delete one by one ...
		for _, t := range tableNames {
			query = `DROP TABLE IF EXISTS ` + t + ` CASCADE`
			if _, err := c.db.Exec(query); err != nil {
				return &database.Error{OrigErr: err, Query: []byte(query)}
			}
		}
	}

	return nil
}

// ensureVersionTable checks if versions table exists and, if not, creates it.
// Note that this function locks the database, which deviates from the usual
// convention of "caller locks" in the CockroachDb type.
func (c *CockroachDb) ensureVersionTable() (err error) {
	if err = c.Lock(); err != nil {
		return err
	}

	defer func() {
		if e := c.Unlock(); e != nil {
			if err == nil {
				err = e
			} else {
				err = multierror.Append(err, e)
			}
		}
	}()

	// check if migration table exists
	var count int
	query := `SELECT COUNT(1) FROM information_schema.tables WHERE table_name = $1 AND table_schema = (SELECT current_schema()) LIMIT 1`
	if err := c.db.QueryRow(query, c.config.MigrationsTable).Scan(&count); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}
	if count == 1 {
		return nil
	}

	// if not, create the empty migration table
	query = `CREATE TABLE "` + c.config.MigrationsTable + `" (version INT NOT NULL PRIMARY KEY, dirty BOOL NOT NULL)`
	if _, err := c.db.Exec(query); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}
	return nil
}

func (c *CockroachDb) ensureLockTable() error {
	// check if lock table exists
	var count int
	query := `SELECT COUNT(1) FROM information_schema.tables WHERE table_name = $1 AND table_schema = (SELECT current_schema()) LIMIT 1`
	if err := c.db.QueryRow(query, c.config.LockTable).Scan(&count); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}
	if count == 1 {
		return nil
	}

	// if not, create the empty lock table
	query = `CREATE TABLE "` + c.config.LockTable + `" (lock_id INT NOT NULL PRIMARY KEY)`
	if _, err := c.db.Exec(query); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}

	return nil
}
