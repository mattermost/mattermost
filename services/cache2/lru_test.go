// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache2

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLRU(t *testing.T) {
	l := NewLRU(&LRUOptions{128, 0, ""})

	for i := 0; i < 256; i++ {
		l.Set(fmt.Sprintf("%d", i), i)
	}
	len, err := l.Len()
	require.Nil(t, err)
	require.Equalf(t, len, 128, "bad len: %v", len)

	keys, err := l.Keys()
	require.Nil(t, err)
	for i, k := range keys {
		var v int
		errGet := l.Get(k, &v)
		require.Nil(t, errGet, "bad key: %v", k)
		require.Equalf(t, fmt.Sprintf("%d", v), k, "bad key: %v", k)
		require.Equalf(t, i+128, v, "bad value: %v", k)
	}
	for i := 0; i < 128; i++ {
		var v int
		errGet := l.Get(fmt.Sprintf("%d", i), &v)
		require.Equal(t, ErrKeyNotFound, errGet, "should be evicted")
	}
	for i := 128; i < 256; i++ {
		var v int
		errGet := l.Get(fmt.Sprintf("%d", i), &v)
		require.Nil(t, errGet, "should not be evicted")
	}
	for i := 128; i < 192; i++ {
		l.Remove(fmt.Sprintf("%d", i))
		var v int
		errGet := l.Get(fmt.Sprintf("%d", i), &v)
		require.Equal(t, ErrKeyNotFound, errGet, "should be deleted")
	}

	var v int
	err = l.Get("192", &v) // expect 192 to be last key in l.Keys()
	require.Nil(t, err, "should exist")
	require.Equalf(t, 192, v, "bad value: %v", v)

	keys, err = l.Keys()
	require.Nil(t, err)
	for i, k := range keys {
		require.Falsef(t, i < 63 && k != fmt.Sprintf("%d", i+193), "out of order key: %v", k)
		require.Falsef(t, i == 63 && k != "192", "out of order key: %v", k)
	}

	l.Purge()
	len, err = l.Len()
	require.Nil(t, err)
	require.Equalf(t, len, 0, "bad len: %v", len)
	err = l.Get("200", &v)
	require.Equal(t, err, ErrKeyNotFound, "should contain nothing")
}

func TestLRUExpire(t *testing.T) {
	l := NewLRU(&LRUOptions{128, 0, ""})

	l.SetWithExpiry("1", 1, 1*time.Second)
	l.SetWithExpiry("2", 2, 1*time.Second)
	l.SetWithExpiry("3", 3, 0*time.Second)

	time.Sleep(time.Millisecond * 2100)

	var r1 int
	err := l.Get("1", &r1)
	require.Equal(t, err, ErrKeyNotFound, "should not exist")

	var r2 int
	err2 := l.Get("3", &r2)
	require.Nil(t, err2, "should exist")
	require.Equal(t, 3, r2)
}
