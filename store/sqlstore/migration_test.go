// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
)

type testMutexProvider struct {
	mutex *sync.Mutex
}

func (p *testMutexProvider) NewMutex(name string) sync.Locker {
	return p.mutex
}

func MigrationTest(t *testing.T, fn func(*testing.T, *MigrationRunner, *SqlSupplier)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		t.Run(st.Name, func(t *testing.T) {
			opt := MigrationOptions{
				LockTimeoutSecs: 1,
				BackoffTimeSecs: 1,
				NumRetries:      2,
			}

			runner := NewMigrationRunner(st.SqlSupplier, &testMutexProvider{&sync.Mutex{}}, opt)
			fn(t, runner, st.SqlSupplier)
		})
	}
}

func TestAsyncMigrations(t *testing.T) {
	t.Run("CreateIndex", func(t *testing.T) { MigrationTest(t, createIndexTest) })
	t.Run("CreateIndexTableLocked", func(t *testing.T) { MigrationTest(t, createIndexTestTableLocked) })
	t.Run("DropIndex", func(t *testing.T) { MigrationTest(t, dropIndexTest) })
	t.Run("DropIndexTableLocked", func(t *testing.T) { MigrationTest(t, dropIndexTestTableLocked) })
}

type mockMigration struct {
	SleepTime time.Duration
	Done      chan struct{}
	mu        sync.Mutex
	result    model.AsyncMigrationStatus
}

func (m *mockMigration) SetResult(result model.AsyncMigrationStatus) {
	m.mu.Lock()
	m.result = result
	m.mu.Unlock()
}

func (m *mockMigration) GetResult() model.AsyncMigrationStatus {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.result
}

func (m *mockMigration) Name() string {
	return "sleep"
}

func (m *mockMigration) GetStatus() (model.AsyncMigrationStatus, error) {
	return model.MigrationStatusRun, nil
}

func (m *mockMigration) Execute(ctx context.Context, conn *sql.Conn) (model.AsyncMigrationStatus, error) {
	select {
	case <-m.Done: // if the first migration is complete, the second will return failed state here
		m.SetResult(model.MigrationStatusFailed)
		return model.MigrationStatusFailed, errors.New("failed")
	case <-time.After(m.SleepTime):
		close(m.Done)
		m.SetResult(model.MigrationStatusComplete)
		return model.MigrationStatusComplete, nil
	case <-ctx.Done():
		m.SetResult(model.MigrationStatusUnknown)
		return model.MigrationStatusUnknown, errors.New("canceled")
	}
}

func TestAsyncMigrationLocking(t *testing.T) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()

	opt := MigrationOptions{
		LockTimeoutSecs: 1,
		BackoffTimeSecs: 1,
		NumRetries:      2,
	}
	mutexProvider := testMutexProvider{&sync.Mutex{}}
	doneChan := make(chan struct{})
	migration1 := mockMigration{SleepTime: 1 * time.Second, Done: doneChan}
	runner1 := NewMigrationRunner(storeTypes[0].SqlSupplier, &mutexProvider, opt)
	runner1.Add(&migration1)

	migration2 := mockMigration{SleepTime: 1 * time.Millisecond, Done: doneChan}
	runner2 := NewMigrationRunner(storeTypes[0].SqlSupplier, &mutexProvider, opt)
	runner2.Add(&migration2)

	// execute 2 runners and check if the migrations where not run simultaneously
	runner1.Run()
	time.Sleep(100 * time.Millisecond)
	runner2.Run()
	<-doneChan
	time.Sleep(100 * time.Millisecond)
	runner2.Cancel()

	assert.Equal(t, model.MigrationStatusComplete, migration1.GetResult())
	assert.Equal(t, model.MigrationStatusFailed, migration2.GetResult())
}
