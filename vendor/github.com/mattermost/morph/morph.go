package morph

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/morph/models"

	"github.com/mattermost/morph/drivers"
	"github.com/mattermost/morph/sources"

	ms "github.com/mattermost/morph/drivers/mysql"
	ps "github.com/mattermost/morph/drivers/postgres"

	_ "github.com/mattermost/morph/sources/embedded"
	_ "github.com/mattermost/morph/sources/file"
)

var migrationProgressStart = "==  %s: migrating  ================================================="
var migrationProgressFinished = "==  %s: migrated (%s)  ========================================"

const maxProgressLogLength = 100

type Morph struct {
	config *Config
	driver drivers.Driver
	source sources.Source
	mutex  drivers.Locker
}

type Config struct {
	Logger      Logger
	LockTimeout time.Duration
	LockKey     string
}

type EngineOption func(*Morph)

func WithLogger(logger Logger) EngineOption {
	return func(m *Morph) {
		m.config.Logger = logger
	}
}

func WithLockTimeout(lockTimeout time.Duration) EngineOption {
	return func(m *Morph) {
		m.config.LockTimeout = lockTimeout
	}
}

func SetMigrationTableName(name string) EngineOption {
	return func(m *Morph) {
		_ = m.driver.SetConfig("MigrationsTable", name)
	}
}

func SetSatementTimeoutInSeconds(n int) EngineOption {
	return func(m *Morph) {
		_ = m.driver.SetConfig("StatementTimeoutInSecs", n)
	}
}

// WithLock creates a lock table in the database so that the migrations are
// guaranteed to be executed from a single instance. The key is used for naming
// the mutex.
func WithLock(key string) EngineOption {
	return func(m *Morph) {
		m.config.LockKey = key
	}
}

// New creates a new instance of the migrations engine from an existing db instance and a migrations source.
// If the driver implements the Lockable interface, it will also wait until it has acquired a lock.
func New(ctx context.Context, driver drivers.Driver, source sources.Source, options ...EngineOption) (*Morph, error) {
	engine := &Morph{
		config: &Config{
			Logger: newColorLogger(log.New(os.Stderr, "", log.LstdFlags)), // add default logger
		},
		source: source,
		driver: driver,
	}

	for _, option := range options {
		option(engine)
	}

	if err := driver.Ping(); err != nil {
		return nil, err
	}

	if impl, ok := driver.(drivers.Lockable); ok && engine.config.LockKey != "" {
		var mx drivers.Locker
		var err error
		switch impl.DriverName() {
		case "mysql":
			mx, err = ms.NewMutex(engine.config.LockKey, driver, engine.config.Logger)
		case "postgres":
			mx, err = ps.NewMutex(engine.config.LockKey, driver, engine.config.Logger)
		default:
			err = errors.New("driver does not support locking")
		}
		if err != nil {
			return nil, err
		}

		engine.mutex = mx
		err = mx.Lock(ctx)
		if err != nil {
			return nil, err
		}
	}

	return engine, nil
}

// Close closes the underlying database connection of the engine.
func (m *Morph) Close() error {
	if m.mutex != nil {
		err := m.mutex.Unlock()
		if err != nil {
			return err
		}
	}

	return m.driver.Close()
}

// ApplyAll applies all pending migrations.
func (m *Morph) ApplyAll() error {
	_, err := m.Apply(-1)
	return err
}

// Applies limited number of migrations upwards.
func (m *Morph) Apply(limit int) (int, error) {
	appliedMigrations, err := m.driver.AppliedMigrations()
	if err != nil {
		return -1, err
	}

	pendingMigrations, err := computePendingMigrations(appliedMigrations, m.source.Migrations())
	if err != nil {
		return -1, err
	}

	migrations := make([]*models.Migration, 0)
	sortedMigrations := sortMigrations(pendingMigrations)

	for _, migration := range sortedMigrations {
		if migration.Direction != models.Up {
			continue
		}
		migrations = append(migrations, migration)
	}

	steps := limit
	if len(migrations) < steps {
		return -1, fmt.Errorf("there are only %d migrations avaliable, but you requested %d", len(migrations), steps)
	}

	if limit < 0 {
		steps = len(migrations)
	}

	var applied int
	for i := 0; i < steps; i++ {
		start := time.Now()
		migrationName := migrations[i].Name
		m.config.Logger.Println(formatProgress(fmt.Sprintf(migrationProgressStart, migrationName)))
		if err := m.driver.Apply(migrations[i], true); err != nil {
			return applied, err
		}

		applied++
		elapsed := time.Since(start)
		m.config.Logger.Println(formatProgress(fmt.Sprintf(migrationProgressFinished, migrationName, fmt.Sprintf("%.4fs", elapsed.Seconds()))))
	}

	return applied, nil
}

// ApplyDown rollbacks a limited number of migrations
// if limit is given below zero, all down scripts are going to be applied.
func (m *Morph) ApplyDown(limit int) (int, error) {
	appliedMigrations, err := m.driver.AppliedMigrations()
	if err != nil {
		return -1, err
	}

	sortedMigrations := reverseSortMigrations(appliedMigrations)
	downMigrations, err := findDownScripts(sortedMigrations, m.source.Migrations())
	if err != nil {
		return -1, err
	}

	steps := limit
	if len(sortedMigrations) < steps {
		return -1, fmt.Errorf("there are only %d migrations avaliable, but you requested %d", len(sortedMigrations), steps)
	}

	if limit < 0 {
		steps = len(sortedMigrations)
	}

	var applied int
	for i := 0; i < steps; i++ {
		start := time.Now()
		migrationName := sortedMigrations[i].Name
		m.config.Logger.Println(formatProgress(fmt.Sprintf(migrationProgressStart, migrationName)))

		down := downMigrations[migrationName]
		if err := m.driver.Apply(down, true); err != nil {
			return applied, err
		}

		applied++
		elapsed := time.Since(start)
		m.config.Logger.Println(formatProgress(fmt.Sprintf(migrationProgressFinished, migrationName, fmt.Sprintf("%.4fs", elapsed.Seconds()))))
	}

	return applied, nil
}

func reverseSortMigrations(migrations []*models.Migration) []*models.Migration {
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version > migrations[j].Version
	})
	return migrations
}

func sortMigrations(migrations []*models.Migration) []*models.Migration {
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].RawName < migrations[j].RawName
	})
	return migrations
}

func computePendingMigrations(appliedMigrations []*models.Migration, sourceMigrations []*models.Migration) ([]*models.Migration, error) {
	// sourceMigrations has to be greater or equal to databaseMigrations
	if len(appliedMigrations) > len(sourceMigrations) {
		return nil, errors.New("migration mismatch, there are more migrations applied than those were specified in source")
	}

	dict := make(map[string]*models.Migration)
	for _, appliedMigration := range appliedMigrations {
		dict[appliedMigration.Name] = appliedMigration
	}

	var pendingMigrations []*models.Migration
	for _, sourceMigration := range sourceMigrations {
		if _, ok := dict[sourceMigration.Name]; !ok {
			pendingMigrations = append(pendingMigrations, sourceMigration)
		}
	}

	return pendingMigrations, nil
}

func findDownScripts(appliedMigrations []*models.Migration, sourceMigrations []*models.Migration) (map[string]*models.Migration, error) {
	tmp := make(map[string]*models.Migration)
	for _, m := range sourceMigrations {
		if m.Direction != models.Down {
			continue
		}
		tmp[m.Name] = m
	}

	for _, m := range appliedMigrations {
		_, ok := tmp[m.Name]
		if !ok {
			return nil, fmt.Errorf("could not find down script for %s", m.Name)
		}
	}

	return tmp, nil
}

func formatProgress(p string) string {
	if len(p) < maxProgressLogLength {
		return p + strings.Repeat("=", maxProgressLogLength-len(p))
	}

	if len(p) > maxProgressLogLength {
		return p[:maxProgressLogLength]
	}

	return p
}
