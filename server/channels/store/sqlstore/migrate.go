// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"bytes"
	"cmp"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"path"
	"slices"
	"strconv"
	"sync"

	"github.com/mattermost/morph"
	ps "github.com/mattermost/morph/drivers/postgres"
	"github.com/mattermost/morph/models"
	"github.com/mattermost/morph/sources"
	mbindata "github.com/mattermost/morph/sources/embedded"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/db"
)

var ErrUntrustedMigrationPlan = errors.New("migration plan does not match the migrations of this binary")

type Migrator struct {
	engine *morph.Morph
	store  *SqlStore
}

func NewMigrator(settings model.SqlSettings, logger mlog.LoggerIFace, dryRun bool) (*Migrator, error) {
	ss := &SqlStore{
		rrCounter:   0,
		srCounter:   0,
		settings:    &settings,
		logger:      logger,
		quitMonitor: make(chan struct{}),
		wgMonitor:   &sync.WaitGroup{},
	}

	err := ss.initConnection()
	if err != nil {
		return nil, fmt.Errorf("error in initializing connection: %w", err)
	}

	ver, err := ss.GetDbVersion(true)
	if err != nil {
		return nil, fmt.Errorf("error while getting DB version: %w", err)
	}

	if err = ss.checkVersion(ver); err != nil {
		return nil, fmt.Errorf("error while checking DB version: %w", err)
	}

	engine, err := ss.initMorph(dryRun, true)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize morph: %w", err)
	}

	return &Migrator{
		engine: engine,
		store:  ss,
	}, nil
}

func (m *Migrator) Close() error {
	if err := m.engine.Close(); err != nil {
		return fmt.Errorf("failed to close morph engine: %w", err)
	}

	m.store.Close()

	return nil
}

func (m *Migrator) GetFileName(plan *models.Plan) (string, error) {
	if len(plan.Migrations) == 0 {
		return "", fmt.Errorf("plan is empty")
	}

	to := plan.Migrations[len(plan.Migrations)-1].Version
	from, err := m.store.GetDBSchemaVersion()
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("migration_plan_%d_%d", from, to), nil
}

func (ss *SqlStore) embeddedMigrationSource() (sources.Source, error) {
	assets := db.Assets()

	assetsList, err := assets.ReadDir(path.Join("migrations", ss.DriverName()))
	if err != nil {
		return nil, err
	}

	assetNamesForDriver := make([]string, len(assetsList))
	for i, entry := range assetsList {
		assetNamesForDriver[i] = entry.Name()
	}

	return mbindata.WithInstance(&mbindata.AssetSource{
		Names: assetNamesForDriver,
		AssetFunc: func(name string) ([]byte, error) {
			return assets.ReadFile(path.Join("migrations", ss.DriverName(), name))
		},
	})
}

func (ss *SqlStore) initMorph(dryRun, enableLogging bool) (*morph.Morph, error) {
	src, err := ss.embeddedMigrationSource()
	if err != nil {
		return nil, err
	}

	driver, err := ps.WithInstance(ss.GetMaster().DB().DB)
	if err != nil {
		return nil, err
	}

	var logWriter io.Writer
	if enableLogging {
		logWriter = &morphWriter{}
	} else {
		logWriter = io.Discard
	}

	opts := []morph.EngineOption{
		morph.WithLogger(log.New(logWriter, "", log.Lshortfile)),
		morph.WithLock("mm-lock-key"),
		morph.SetStatementTimeoutInSeconds(*ss.settings.MigrationsStatementTimeoutSeconds),
		morph.SetDryRun(dryRun),
	}

	engine, err := morph.New(context.Background(), driver, src, opts...)
	if err != nil {
		return nil, err
	}

	return engine, nil
}

func (ss *SqlStore) migrate(direction migrationDirection, dryRun, enableMorphLogging bool) error {
	engine, err := ss.initMorph(dryRun, enableMorphLogging)
	if err != nil {
		return err
	}
	defer engine.Close()

	switch direction {
	case migrationsDirectionDown:
		_, err = engine.ApplyDown(-1)
		return err
	default:
		return engine.ApplyAll()
	}
}

func (m *Migrator) GeneratePlan(shouldRecover bool) (*models.Plan, error) {
	diff, err := m.engine.Diff(models.Up)
	if err != nil {
		return nil, err
	}

	plan, err := m.engine.GeneratePlan(diff, shouldRecover)
	if err != nil {
		return nil, err
	}

	return plan, nil
}

// MigrateWithPlan migrates the database using the provided plan. The plan is
// rejected unless every migration in it can be vouched for by this binary.
func (m *Migrator) MigrateWithPlan(plan *models.Plan, dryRun bool) error {
	if err := m.verifyPlan(plan); err != nil {
		return err
	}

	return m.engine.ApplyPlan(plan)
}

// verifyPlan requires each plan entry to match the embedded migration of the
// same file name. Entries unknown to this binary are only accepted when they
// are newer than every embedded migration and already applied to the
// database, which is the case when downgrading with an older binary.
func (m *Migrator) verifyPlan(plan *models.Plan) error {
	src, err := m.store.embeddedMigrationSource()
	if err != nil {
		return fmt.Errorf("failed to read embedded migrations: %w", err)
	}

	embedded := make(map[string]*models.Migration)
	var latestVersion uint32
	for _, migration := range src.Migrations() {
		embedded[migration.RawName] = migration
		latestVersion = max(latestVersion, migration.Version)
	}

	appliedMigrations, err := m.store.GetAppliedMigrations()
	if err != nil {
		return err
	}

	type versionName struct {
		version uint32
		name    string
	}
	applied := make(map[versionName]bool, len(appliedMigrations))
	for _, migration := range appliedMigrations {
		applied[versionName{uint32(migration.Version), migration.Name}] = true
	}

	for _, migration := range slices.Concat(plan.Migrations, plan.RevertMigrations) {
		if migration == nil {
			return fmt.Errorf("%w: plan contains an empty migration", ErrUntrustedMigrationPlan)
		}

		if expected, ok := embedded[migration.RawName]; ok {
			if migration.Version != expected.Version ||
				migration.Name != expected.Name ||
				migration.Direction != expected.Direction ||
				!bytes.Equal(migration.Bytes, expected.Bytes) {
				return fmt.Errorf("%w: %s differs from the embedded migration", ErrUntrustedMigrationPlan, migration.RawName)
			}
			continue
		}

		if migration.Version <= latestVersion || !applied[versionName{migration.Version, migration.Name}] {
			return fmt.Errorf("%w: %s is neither embedded nor a newer applied migration", ErrUntrustedMigrationPlan, migration.RawName)
		}
	}

	return nil
}

// PreMigrate runs the pre-migration handlers that normally execute during
// server startup. Callers on the CLI up-migration path (e.g. `mattermost db
// migrate`, used by cloud upgrades) must invoke this before MigrateWithPlan so
// the same fixes apply outside of server startup. Skipped under dryRun because
// preMigration writes directly via GetMaster().Exec and does not participate
// in Morph's dry-run.
// This is intentionally only called for forward migrations and skipped for
// downgrades.
func (m *Migrator) PreMigrate() error {
	return m.store.preMigration()
}

func (m *Migrator) DowngradeMigrations(dryRun bool, versions ...string) error {
	migrations, err := m.engine.Diff(models.Down)
	if err != nil {
		return err
	}

	migrationsToDowngrade := make([]*models.Migration, 0, len(versions))
	for _, version := range versions {
		for _, migration := range migrations {
			versionNumber, sErr := strconv.Atoi(version)
			if sErr != nil {
				return sErr
			}
			if migration.Version == uint32(versionNumber) {
				migrationsToDowngrade = append(migrationsToDowngrade, migration)
			}
		}
	}

	slices.SortFunc(migrationsToDowngrade, func(a, b *models.Migration) int {
		return cmp.Compare(b.Version, a.Version)
	})

	if len(migrationsToDowngrade) != len(versions) {
		mlog.Warn("could not match give migration versions, going to downgrade only the migrations those are available.")
	}

	plan, err := m.engine.GeneratePlan(migrationsToDowngrade, false)
	if err != nil {
		return err
	}

	return m.engine.ApplyPlan(plan)
}
