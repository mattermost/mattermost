package dlock

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/lieut-data/mattermost-plugin-api/dlock/dlocktest"
	"github.com/stretchr/testify/require"
)

// TODO(ilgooz): test all branches including related ones to Store errors and ExpireInSeconds.
// TODO(ilgooz): can move tests from sync/mutex_test.go.

func TestLock(t *testing.T) {
	dl := New("a", dlocktest.New())
	var wg sync.WaitGroup
	wg.Add(3)
	for i := 0; i < 3; i++ {
		go func() {
			defer wg.Done()
			for i := 0; i < 10; i++ {
				dl.Lock(context.Background())
				time.Sleep(100 * time.Microsecond)
				dl.Unlock()
			}
		}()
	}
	wg.Wait()
}

func TestTryLock(t *testing.T) {
	dl := New("a", dlocktest.New())
	dl.Lock(context.Background())
	isLockObtained, err := dl.TryLock()
	require.NoError(t, err)
	require.False(t, isLockObtained)
}

func TestLockDifferentKeys(t *testing.T) {
	dla := New("a", dlocktest.New())
	dlb := New("b", dlocktest.New())
	dla.Lock(context.Background())
	dlb.Lock(context.Background())
	dla.Unlock()
	dlb.Unlock()
}
