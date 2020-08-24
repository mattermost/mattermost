// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"fmt"
	"testing"
	"time"

	"github.com/dgraph-io/ristretto"
	"github.com/stretchr/testify/assert"
)

func TestLFU(t *testing.T) {
	// l := NewLFU(&LFUOptions{
	// 	Size:                   128,
	// 	DefaultExpiry:          0,
	// 	InvalidateClusterEvent: "",
	// 	// NumCounters: 1e7,     // number of keys to track frequency of (10M).
	// 	// MaxCost:     1 << 30, // maximum cost of cache (1GB).
	// 	// BufferItems: 64,      // number of keys per Get buffer.
	// })

	l := NewLFU(&ristretto.Config{
		NumCounters: 1e7,     // number of keys to track frequency of (10M).
		MaxCost:     1 << 30, // maximum cost of cache (1GB).
		BufferItems: 64,      // number of keys per Get buffer.
	})

	name := l.Name()
	fmt.Printf("name: %s\n", name)

	len, _ := l.Len()
	fmt.Printf("len: %d\n", len)

	// set a value with a cost of 1
	// l.Set("key", "value", 1)
	l.Set("key", "value")

	// wait for value to pass through buffers
	time.Sleep(10 * time.Millisecond)

	len, _ = l.Len()
	fmt.Printf("len: %d\n", len)

	var value string

	if err := l.Get("key", &value); err != nil {
		panic("missing value")
	}

	assert := assert.New(t)

	fmt.Printf("value: %s\n", value)

	// expected := "value"
	// actual := string(value)

	assert.Equal(value, "value", "they should be equal")

	// l.Remove("key")

	// fmt.Println(l.Keys())

	_ = l.Purge()

	len, _ = l.Len()
	fmt.Printf("len: %d\n", len)
}
