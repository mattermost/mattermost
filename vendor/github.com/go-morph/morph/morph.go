package morph

import (
	"errors"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/go-morph/morph/models"

	"github.com/go-morph/morph/drivers"
	"github.com/go-morph/morph/sources"

	_ "github.com/go-morph/morph/drivers/mysql"
	_ "github.com/go-morph/morph/drivers/postgres"

	_ "github.com/go-morph/morph/sources/file"
	_ "github.com/go-morph/morph/sources/go_bindata"
)

// DefaultLockTimeout sets the max time a database driver has to acquire a lock.
var DefaultLockTimeout = 15 * time.Second

var migrationProgressStart = "==  %s: migrating  ================================================="
var migrationProgressFinished = "==  %s: migrated (%s)  ========================================"

const maxProgressLogLength = 100

type Morph struct {
	config *Config
	driver drivers.Driver
	source sources.Source
}

type Config struct {
	Logger      Logger
	LockTimeout time.Duration
}

type EngineOption func(*Morph)

var defaultConfig = &Config{
	LockTimeout: DefaultLockTimeout,
	Logger:      log.New(os.Stderr, "", log.LstdFlags), // add default logger
}

func WithLogger(logger *log.Logger) EngineOption {
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

// New creates a new instance of the migrations engine from an existing db instance and a migrations source
func New(driver drivers.Driver, source sources.Source, options ...EngineOption) (*Morph, error) {
	engine := &Morph{
		config: defaultConfig,
		source: source,
		driver: driver,
	}

	for _, option := range options {
		option(engine)
	}

	if err := driver.Ping(); err != nil {
		return nil, err
	}

	return engine, nil
}

// Close closes the underlying database connection of the engine.
func (m *Morph) Close() error {
	return m.driver.Close()
}

// ApplyAll applies all pending migrations.
func (m *Morph) ApplyAll() error {
	_, err := m.Apply(-1)
	return err
}

// Applies limited number of migrations
func (m *Morph) Apply(limit int) (int, error) {
	appliedMigrations, err := m.driver.AppliedMigrations()
	if err != nil {
		return -1, err
	}

	pendingMigrations, err := computePendingMigrations(appliedMigrations, m.source.Migrations())
	if err != nil {
		return -1, err
	}

	migrations, rollbacks, err := findUpScripts(sortMigrations(pendingMigrations))
	if err != nil {
		return -1, err
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
		m.config.Logger.Println(InfoLoggerLight.Sprint(formatProgress(fmt.Sprintf(migrationProgressStart, migrationName))))
		if err := m.driver.Apply(migrations[i], true); err != nil {
			rollback, ok := rollbacks[migrationName]
			if ok {
				m.config.Logger.Println(ErrorLoggerLight.Sprint(formatProgress(fmt.Sprintf("failed to apply %s, rolling back.", migrationName))))
				m.config.Logger.Println(InfoLoggerLight.Sprint(formatProgress(fmt.Sprintf("trying to apply %s (%s)", rollback.Name, rollback.Direction))))

				if err2 := m.driver.Apply(rollback, false); err2 != nil {
					return applied, fmt.Errorf("could not rollback the migration %s: %w", migrationName, err)
				}
				m.config.Logger.Println(InfoLoggerLight.Sprint(formatProgress(fmt.Sprintf("rollback completed for %s. Aborting gracefully.", migrationName))))
				return applied, err
			}

			return applied, err
		}

		applied++
		elapsed := time.Since(start)
		m.config.Logger.Println(InfoLoggerLight.Sprint(formatProgress(fmt.Sprintf(migrationProgressFinished, migrationName, fmt.Sprintf("%.4fs", elapsed.Seconds())))))
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
		m.config.Logger.Println(InfoLoggerLight.Sprint(formatProgress(fmt.Sprintf(migrationProgressStart, migrationName))))

		down := downMigrations[migrationName]
		if err := m.driver.Apply(down, true); err != nil {
			return applied, err
		}

		applied++
		elapsed := time.Since(start)
		m.config.Logger.Println(InfoLoggerLight.Sprint(formatProgress(fmt.Sprintf(migrationProgressFinished, migrationName, fmt.Sprintf("%.4fs", elapsed.Seconds())))))
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

func findUpScripts(migrations []*models.Migration) ([]*models.Migration, map[string]*models.Migration, error) {
	rollbackMigrations := make(map[string]*models.Migration)
	toBeAppliedMigrations := make([]*models.Migration, 0)
	for _, migration := range migrations {
		if migration.Direction != models.Up {
			rollbackMigrations[migration.Name] = migration
			continue
		}
		toBeAppliedMigrations = append(toBeAppliedMigrations, migration)
	}

	for _, migration := range toBeAppliedMigrations {
		_, ok := rollbackMigrations[migration.Name]
		if !ok {
			return nil, nil, fmt.Errorf("the rollback migration file for %s is missing", migration.RawName)
		}
	}

	return toBeAppliedMigrations, rollbackMigrations, nil
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
