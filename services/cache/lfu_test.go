// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"testing"
	"time"

	"github.com/dgraph-io/ristretto"
	"github.com/stretchr/testify/assert"
)

func TestLFU(t *testing.T) {
	assert := assert.New(t)

	l := NewLFU(&ristretto.Config{
		NumCounters: 1e7,     // number of keys to track frequency of (10M).
		MaxCost:     1 << 30, // maximum cost of cache (1GB).
		BufferItems: 64,      // number of keys per Get buffer.
	})

	// name := l.Name()
	// t.Logf("name: %s\n", name)

	len, _ := l.Len()
	assert.Equal(0, len, "length should be 0 after cache is initialized.")

	// set a value with a cost of 1
	// l.Set("key", "value", 1)
	l.Set("key", "value")

	// wait for value to pass through buffers
	time.Sleep(10 * time.Millisecond)

	len, _ = l.Len()
	assert.Equal(1, len, "length should be 1 after item is added to the cache.")

	var value string

	if err := l.Get("key", &value); err != nil {
		panic("missing value")
	}

	// t.Logf("value: %s\n", value)

	assert.Equal(value, "value", "they should be equal.")

	// l.Remove("key")

	// t.Logf(l.Keys())

	_ = l.Purge()

	len, _ = l.Len()
	assert.Equal(0, len, "length should be 0 after cache is purged.")
}
