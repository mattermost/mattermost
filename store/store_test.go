// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type deadlock struct {
	numRetries int
	hasRetried int
}

func newDeadlock(numRetries int) *deadlock {
	return &deadlock{
		numRetries: numRetries,
	}
}

func (d *deadlock) f() error {
	if d.numRetries == d.hasRetried {
		return nil
	}
	d.hasRetried++
	return &mysql.MySQLError{
		Number: mySQLDeadlockCode,
	}
}

func TestDeadlockRetry(t *testing.T) {
	t.Run("NoDeadlock", func(t *testing.T) {
		d := newDeadlock(0)
		err := WithDeadlockRetry(d.f)
		require.NoError(t, err)
		assert.Equal(t, 0, d.hasRetried)
	})

	t.Run("1Deadlock", func(t *testing.T) {
		d := newDeadlock(1)
		err := WithDeadlockRetry(d.f)
		require.NoError(t, err)
		assert.Equal(t, 1, d.hasRetried)
	})

	t.Run("AlwaysDeadlock", func(t *testing.T) {
		d := newDeadlock(4)
		err := WithDeadlockRetry(d.f)
		require.Error(t, err)
		assert.Equal(t, 3, d.hasRetried)
	})
}
