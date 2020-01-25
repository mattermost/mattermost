package dlock_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/lieut-data/mattermost-plugin-api/dlock"
	"github.com/lieut-data/mattermost-plugin-api/dlock/dlocktest"
)

// TODO(ilgooz): test all branches including related ones to Store errors and ExpireInSeconds.
// TODO(ilgooz): can move tests from sync/mutex_test.go.

func TestLock(t *testing.T) {
	dl := dlock.New("a", dlocktest.New())
	var wg sync.WaitGroup

	for i := 0; i < 1; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 10; i++ {
				err := dl.Lock(context.Background())
				require.NoError(t, err)

				time.Sleep(100 * time.Microsecond)

				err = dl.Unlock()
				require.NoError(t, err)
			}
		}()
	}

	wg.Wait()
}

func TestTryLock(t *testing.T) {
	dl := dlock.New("a", dlocktest.New())

	err := dl.Lock(context.Background())
	require.NoError(t, err)

	isLockObtained, err := dl.TryLock()
	require.NoError(t, err)
	require.False(t, isLockObtained)
}

func TestLockDifferentKeys(t *testing.T) {
	dla := dlock.New("a", dlocktest.New())
	dlb := dlock.New("b", dlocktest.New())

	err := dla.Lock(context.Background())
	require.NoError(t, err)
	err = dlb.Lock(context.Background())
	require.NoError(t, err)

	err = dla.Unlock()
	require.NoError(t, err)
	err = dlb.Unlock()
	require.NoError(t, err)
}
