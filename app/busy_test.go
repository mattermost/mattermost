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

	require.False(t, busy.IsBusy())

	busy.Set(time.Second * 30)
	require.True(t, busy.IsBusy())

	expire := busy.Expires()
	require.Greater(t, expire.Unix(), time.Now().Add(time.Second*10).Unix())

	busy.Clear()
	require.False(t, busy.IsBusy())
}

func TestBusyExpires(t *testing.T) {
	busy := &Busy{}

	isNotBusy := func() bool {
		return !busy.IsBusy()
	}

	busy.Set(time.Millisecond * 100)
	require.True(t, busy.IsBusy())
	require.Eventually(t, isNotBusy, time.Second*5, time.Millisecond*20)

}
