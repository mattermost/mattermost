// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	MigrationDefaultLockTimeout = 3
	MigrationDefaultBackoffTime = 5
	MigrationDefaultNumRetries  = 3
)

type AsyncMigrationStatus string

const (
	AsyncMigrationStatusUnknown  AsyncMigrationStatus = ""
	AsyncMigrationStatusRun      AsyncMigrationStatus = "run"      // migration should be run
	AsyncMigrationStatusSkip     AsyncMigrationStatus = "skip"     // migration should be skipped (not sure if needed?)
	AsyncMigrationStatusComplete AsyncMigrationStatus = "complete" // migration was already executed
	AsyncMigrationStatusFailed   AsyncMigrationStatus = "failed"   // migration has failed
)

// AsyncMigration executes a single database migration that allows concurrent DML
type AsyncMigration interface {
	// name of migration, must be unique among migrations - used for saving status in database
	Name() string
	// returns if migration should be run / was already executed
	GetStatus(SqlStore) (AsyncMigrationStatus, error)
	// exectutes migration, gets started transaction with lock timeouts set
	Execute(context.Context, SqlStore, *sql.Conn) (AsyncMigrationStatus, error)
}

// MigrationRunner runs queued async migrations
type MigrationRunner struct {
	supplier   SqlStore
	migrations []AsyncMigration
	done       chan struct{}
	options    MigrationOptions
	cancelFn   context.CancelFunc
}

type MigrationOptions struct {
	LockTimeout int // Lock timeout in seconds
	BackoffTime int // Time to wait between retries
	NumRetries  int // Number of retries in case of failed migration
}

func NewMigrationRunner(s SqlStore, o MigrationOptions) *MigrationRunner {
	if o.LockTimeout == 0 {
		o.LockTimeout = MigrationDefaultLockTimeout
	}
	if o.BackoffTime == 0 {
		o.BackoffTime = MigrationDefaultBackoffTime
	}
	if o.NumRetries == 0 {
		o.NumRetries = MigrationDefaultNumRetries
	}
	return &MigrationRunner{
		supplier: s,
		done:     make(chan struct{}),
		options:  o,
	}
}

// Add checks if the migration should be executed and adds it to queue
func (r *MigrationRunner) Add(m AsyncMigration) error {
	// check status in Systems table
	currentStatus, appErr := r.supplier.System().GetByName("migration_" + m.Name())
	if appErr == nil {
		if currentStatus.Value == string(AsyncMigrationStatusComplete) || currentStatus.Value == string(AsyncMigrationStatusSkip) {
			return nil
		}
	}
	// get status from migration
	status, err := m.GetStatus(r.supplier)
	if err != nil {
		return err
	}
	if status == AsyncMigrationStatusComplete || status == AsyncMigrationStatusSkip {
		return nil
	}
	r.migrations = append(r.migrations, m)
	return nil
}

// Run all queued migrations sequentially
func (r *MigrationRunner) Run() error {
	go func() {
		ctx, cancelFn := context.WithCancel(context.Background())
		defer cancelFn()
		defer close(r.done)
		r.cancelFn = cancelFn

		for _, m := range r.migrations {
			// function that will try to execute migration
			migrate := func() error {
				var err error
				conn, err := createConnectionWithLockTimeout(ctx, r.supplier, r.options.LockTimeout)
				if err != nil {
					mlog.Error("Failed to setup connection", mlog.Err(err))
					return err
				}
				defer releaseConnection(ctx, r.supplier, conn)

				// run migration
				status, err := m.Execute(ctx, r.supplier, conn)
				if err != nil {
					mlog.Error("Failed to execute migration", mlog.Err(err))
					return err
				}
				if status == AsyncMigrationStatusComplete || status == AsyncMigrationStatusSkip {
					// save migration status
					r.supplier.System().SaveOrUpdate(&model.System{Name: "migration_" + m.Name(), Value: string(status)})
				} else if status == AsyncMigrationStatusFailed {
					mlog.Error("Failed migration " + m.Name())
					return errors.New("Failed migration")
				} else {
					// should we return error here to retry?
					return errors.New("Invalid result from migration")
				}
				return nil
			}
			// retry migration if it fails
			for i := 0; i < r.options.NumRetries; i++ {
				err := migrate()
				if err == nil {
					break
				}
				select {
				case <-ctx.Done():
					return
				// wait before trying again
				case <-time.After(time.Duration(r.options.BackoffTime) * time.Second):
				}
			}
		}
	}()
	return nil
}

// Wait returns after all migrations are processed (executed, skipped or failed)
func (r *MigrationRunner) Wait() {
	<-r.done
}

// Cancel running migrations
func (r *MigrationRunner) Cancel() {
	if r.cancelFn != nil {
		r.cancelFn()
	}
}

// get an explicit connection because that guarantees a single session for all queries
func createConnectionWithLockTimeout(ctx context.Context, s SqlStore, timeout int) (*sql.Conn, error) {
	conn, err := s.GetMaster().Db.Conn(ctx)
	if err != nil {
		return nil, err
	}
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err = conn.ExecContext(ctx, fmt.Sprintf("SET SESSION lock_timeout = '%ds'", timeout))
		if err != nil {
			return nil, err
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		// set timeout for session, we have to revert it later
		_, err = conn.ExecContext(ctx, fmt.Sprintf("SET SESSION lock_wait_timeout = %d", timeout))
		if err != nil {
			return nil, err
		}
	} else {
		return nil, errors.New("Unsupported driver")
	}
	return conn, nil
}

// releaseConnection reverts session variables to defaults and returns connection to pool
func releaseConnection(ctx context.Context, s SqlStore, conn *sql.Conn) {
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		conn.ExecContext(ctx, "SET SESSION lock_timeout TO DEFAULT")
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		conn.ExecContext(ctx, "SET SESSION lock_wait_timeout = @@GLOBAL.lock_wait_timeout")
	}
	conn.Close()
}
