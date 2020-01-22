// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This files was copied/modified from https://github.com/hashicorp/golang-lru
// which was (see below)

// This package provides a simple LRU cache. It is based on the
// LRU implementation in groupcache:
// https://github.com/golang/groupcache/tree/master/lru

package lru

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLRU(t *testing.T) {
	l := New(128)

	for i := 0; i < 256; i++ {
		l.Add(fmt.Sprintf("%d", i), i)
	}
	require.Equalf(t, l.Len(), 128, "bad len: %v", l.Len())

	for i, k := range l.Keys() {
		v, ok := l.Get(k)
		require.True(t, ok, "bad key: %v", k)
		require.Equalf(t, fmt.Sprintf("%d", v), k, "bad key: %v", k)
		require.Equalf(t, i+128, v, "bad key: %v", k)
	}
	for i := 0; i < 128; i++ {
		_, ok := l.Get(fmt.Sprintf("%d", i))
		require.False(t, ok, "should be evicted")
	}
	for i := 128; i < 256; i++ {
		_, ok := l.Get(fmt.Sprintf("%d", i))
		require.True(t, ok, "should not be evicted")
	}
	for i := 128; i < 192; i++ {
		l.Remove(fmt.Sprintf("%d", i))
		_, ok := l.Get(fmt.Sprintf("%d", i))
		require.False(t, ok, "should be deleted")
	}

	l.Get("192") // expect 192 to be last key in l.Keys()

	for i, k := range l.Keys() {
		require.Falsef(t, i < 63 && k != fmt.Sprintf("%d", i+193), "out of order key: %v", k)
		require.Falsef(t, i == 63 && k != "192", "out of order key: %v", k)
	}

	l.Purge()
	require.Equalf(t, l.Len(), 0, "bad len: %v", l.Len())
	_, ok := l.Get("200")
	require.False(t, ok, "should contain nothing")
}

func TestLRUExpire(t *testing.T) {
	l := New(128)

	l.AddWithExpiresInSecs("1", 1, 1)
	l.AddWithExpiresInSecs("2", 2, 1)
	l.AddWithExpiresInSecs("3", 3, 0)

	time.Sleep(time.Millisecond * 2100)

	r1, ok := l.Get("1")
	require.False(t, ok, r1)

	_, ok2 := l.Get("3")
	require.True(t, ok2, "should exist")
}

func TestLRUGetOrAdd(t *testing.T) {
	l := New(128)

	// First GetOrAdd should save
	value, loaded := l.GetOrAdd("1", 1, 0)
	assert.Equal(t, 1, value)
	assert.False(t, loaded)

	// Second GetOrAdd should load original value, ignoring new value
	value, loaded = l.GetOrAdd("1", 10, 0)
	assert.Equal(t, 1, value)
	assert.True(t, loaded)

	// Third GetOrAdd should still load original value
	value, loaded = l.GetOrAdd("1", 1, 0)
	assert.Equal(t, 1, value)
	assert.True(t, loaded)

	// First GetOrAdd on a new key should save
	value, loaded = l.GetOrAdd("2", 2, 0)
	assert.Equal(t, 2, value)
	assert.False(t, loaded)

	l.Remove("1")

	// GetOrAdd after a remove should save
	value, loaded = l.GetOrAdd("1", 10, 0)
	assert.Equal(t, 10, value)
	assert.False(t, loaded)

	// GetOrAdd after another key was removed should load original value for key
	value, loaded = l.GetOrAdd("2", 2, 0)
	assert.Equal(t, 2, value)
	assert.True(t, loaded)

	// GetOrAdd should expire
	value, loaded = l.GetOrAdd("3", 3, 500*time.Millisecond)
	assert.Equal(t, 3, value)
	assert.False(t, loaded)
	value, loaded = l.GetOrAdd("3", 4, 500*time.Millisecond)
	assert.Equal(t, 3, value)
	assert.True(t, loaded)
	time.Sleep(1 * time.Second)
	value, loaded = l.GetOrAdd("3", 5, 500*time.Millisecond)
	assert.Equal(t, 5, value)
	assert.False(t, loaded)
}
