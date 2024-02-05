// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

/*
func newBase() base {
	var b base
	b.g1 = newG[int]()
	b.g2 = newG[string]()

	return b
}

type base struct {
	g1 G[int]
	g2 G[string]
}

type GFactory struct {

}

func (gf* GFactory ) newG[T any]() G[T] {
	return G[T]{}
}

type G[T any] struct {
	t T
}
*/

func TestNewCache(t *testing.T) {
	t.Run("with only size option given", func(t *testing.T) {
		size := 1
		c, err := NewCache[string](&CacheOptions{
			Size: size,
		})
		require.NoError(t, err)

		err = c.Set("key1", "val1")
		require.NoError(t, err)
		err = c.Set("key2", "val2")
		require.NoError(t, err)
		err = c.Set("key3", "val3")
		require.NoError(t, err)
		l, err := c.Len()
		require.NoError(t, err)
		require.Equal(t, size, l)
	})

	t.Run("with only size option given", func(t *testing.T) {
		size := 1
		c, err := NewCache[string](&CacheOptions{
			Size: size,
		})
		require.NoError(t, err)

		err = c.Set("key1", "val1")
		require.NoError(t, err)
		err = c.Set("key2", "val2")
		require.NoError(t, err)
		err = c.Set("key3", "val3")
		require.NoError(t, err)
		l, err := c.Len()
		require.NoError(t, err)
		require.Equal(t, size, l)
	})

	t.Run("with all options specified", func(t *testing.T) {
		size := 1
		expiry := 1 * time.Second
		event := model.ClusterEvent("clusterEvent")
		c, err := NewCache[string](&CacheOptions{
			Size:                   size,
			Name:                   "name",
			DefaultExpiry:          expiry,
			InvalidateClusterEvent: event,
		})
		require.NoError(t, err)

		require.Equal(t, event, c.GetInvalidateClusterEvent())

		err = c.SetWithDefaultExpiry("key1", "val1")
		require.NoError(t, err)
		err = c.SetWithDefaultExpiry("key2", "val2")
		require.NoError(t, err)
		err = c.SetWithDefaultExpiry("key3", "val3")
		require.NoError(t, err)
		l, err := c.Len()
		require.NoError(t, err)
		require.Equal(t, size, l)

		time.Sleep(expiry + 1*time.Second)

		var v string
		err = c.Get("key1", &v)
		require.Equal(t, ErrKeyNotFound, err)
		err = c.Get("key2", &v)
		require.Equal(t, ErrKeyNotFound, err)
		err = c.Get("key3", &v)
		require.Equal(t, ErrKeyNotFound, err)
	})
}

func TestNewCache_Striped(t *testing.T) {
	t.Run("with only size option given", func(t *testing.T) {
		size := 1
		c, err := NewCache[string](&CacheOptions{
			Size:           size,
			Striped:        true,
			StripedBuckets: 1,
		})
		require.NoError(t, err)

		err = c.Set("key1", "val1")
		require.NoError(t, err)
		err = c.Set("key2", "val2")
		require.NoError(t, err)
		err = c.Set("key3", "val3")
		require.NoError(t, err)
		l, err := c.Len()
		require.NoError(t, err)
		require.Equal(t, size+1, l) // +10% from striping
	})

	t.Run("with only size option given", func(t *testing.T) {
		size := 1
		c, err := NewCache[string](&CacheOptions{
			Size:           size,
			Striped:        true,
			StripedBuckets: 1,
		})
		require.NoError(t, err)

		err = c.Set("key1", "val1")
		require.NoError(t, err)
		err = c.Set("key2", "val2")
		require.NoError(t, err)
		err = c.Set("key3", "val3")
		require.NoError(t, err)
		l, err := c.Len()
		require.NoError(t, err)
		require.Equal(t, size+1, l) // +10% rounded up from striped lru
	})

	t.Run("with all options specified", func(t *testing.T) {
		size := 1
		expiry := 1 * time.Second
		event := model.ClusterEvent("clusterEvent")
		c, err := NewCache[string](&CacheOptions{
			Size:                   size,
			Name:                   "name",
			DefaultExpiry:          expiry,
			InvalidateClusterEvent: event,
			Striped:                true,
			StripedBuckets:         1,
		})
		require.NoError(t, err)

		require.Equal(t, event, c.GetInvalidateClusterEvent())

		err = c.SetWithDefaultExpiry("key1", "val1")
		require.NoError(t, err)
		err = c.SetWithDefaultExpiry("key2", "val2")
		require.NoError(t, err)
		err = c.SetWithDefaultExpiry("key3", "val3")
		require.NoError(t, err)
		l, err := c.Len()
		require.NoError(t, err)
		require.Equal(t, size+1, l) // +10% from striping

		time.Sleep(expiry + 1*time.Second)

		var v string
		err = c.Get("key1", &v)
		require.Equal(t, ErrKeyNotFound, err)
		err = c.Get("key2", &v)
		require.Equal(t, ErrKeyNotFound, err)
		err = c.Get("key3", &v)
		require.Equal(t, ErrKeyNotFound, err)
	})
}
