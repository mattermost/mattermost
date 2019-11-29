// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestBusySet(t *testing.T) {
	busy := &Busy{}

	isNotBusy := func() bool {
		return !busy.IsBusy()
	}

	require.False(t, busy.IsBusy())

	busy.Set(time.Millisecond * 100)
	require.True(t, busy.IsBusy())
	// should automatically expire after 100ms
	require.Eventually(t, isNotBusy, time.Second*5, time.Millisecond*20)

	// test set after auto expiry
	busy.Set(time.Second * 30)
	require.True(t, busy.IsBusy())
	expire := busy.Expires()
	require.Greater(t, expire.Unix(), time.Now().Add(time.Second*10).Unix())

	// test extending existing expiry
	busy.Set(time.Minute * 5)
	require.True(t, busy.IsBusy())
	expire = busy.Expires()
	require.Greater(t, expire.Unix(), time.Now().Add(time.Minute*2).Unix())

	busy.Clear()
	require.False(t, busy.IsBusy())
}

func TestBusyExpires(t *testing.T) {
	busy := &Busy{}

	isNotBusy := func() bool {
		return !busy.IsBusy()
	}

	// get expiry before it is set
	expire := busy.Expires()
	// should be time.Time zero value
	require.Equal(t, time.Time{}.Unix(), expire.Unix())

	// get expiry after it is set
	busy.Set(time.Minute * 5)
	expire = busy.Expires()
	require.Greater(t, expire.Unix(), time.Now().Add(time.Minute*2).Unix())

	// get expiry after clear
	busy.Clear()
	expire = busy.Expires()
	// should be time.Time zero value
	require.Equal(t, time.Time{}.Unix(), expire.Unix())

	// get expiry after auto-expire
	busy.Set(time.Millisecond * 100)
	require.Eventually(t, isNotBusy, time.Second*5, time.Millisecond*20)
	expire = busy.Expires()
	// should be time.Time zero value
	require.Equal(t, time.Time{}.Unix(), expire.Unix())
}
