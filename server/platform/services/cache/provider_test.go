// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestNewCache(t *testing.T) {
	t.Run("with only size option given", func(t *testing.T) {
		p := NewProvider()

		size := 1
		c, err := p.NewCache(&CacheOptions{
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
		p := NewProvider()

		size := 1
		c, err := p.NewCache(&CacheOptions{
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
		p := NewProvider()

		size := 1
		expiry := 1 * time.Second
		event := model.ClusterEvent("clusterEvent")
		c, err := p.NewCache(&CacheOptions{
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
		p := NewProvider()

		size := 1
		c, err := p.NewCache(&CacheOptions{
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
		p := NewProvider()

		size := 1
		c, err := p.NewCache(&CacheOptions{
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
		p := NewProvider()

		size := 1
		expiry := 1 * time.Second
		event := model.ClusterEvent("clusterEvent")
		c, err := p.NewCache(&CacheOptions{
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

func TestConnectClose(t *testing.T) {
	p := NewProvider()

	err := p.Connect()
	require.NoError(t, err)

	err = p.Close()
	require.NoError(t, err)
}
