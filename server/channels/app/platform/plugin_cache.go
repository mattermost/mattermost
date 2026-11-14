// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const (
	pluginCacheSize          = 50000
	pluginCacheDefaultExpiry = 1 * time.Hour

	// PluginCacheMaxKeyLength is the maximum length of a plugin cache key.
	PluginCacheMaxKeyLength = 150
	// PluginCacheMaxValueSize is the maximum size in bytes of a plugin cache value.
	PluginCacheMaxValueSize = 256 * 1024
)

type pluginCacheOp string

const (
	pluginCacheOpSet    pluginCacheOp = "set"
	pluginCacheOpDelete pluginCacheOp = "delete"
)

type pluginCacheMessage struct {
	Op         pluginCacheOp `json:"op"`
	Key        string        `json:"key"`
	Value      []byte        `json:"value,omitempty"`
	TTLSeconds int64         `json:"ttl_seconds,omitempty"`
}

func pluginCacheKey(pluginID, key string) string {
	return pluginID + ":" + key
}

func validatePluginCacheKey(key string, value []byte) error {
	if key == "" {
		return errors.New("key must not be empty")
	}
	if len(key) > PluginCacheMaxKeyLength {
		return fmt.Errorf("key exceeds %d characters", PluginCacheMaxKeyLength)
	}
	if len(value) > PluginCacheMaxValueSize {
		return fmt.Errorf("value exceeds %d bytes", PluginCacheMaxValueSize)
	}
	return nil
}

// PluginCacheSet stores a value in the plugin cache, namespaced by plugin ID.
// With the LRU provider, the write is replicated to the other cluster nodes.
// With the Redis provider, the cache is already shared by all nodes.
func (ps *PlatformService) PluginCacheSet(pluginID, key string, value []byte, ttl time.Duration) error {
	if err := validatePluginCacheKey(key, value); err != nil {
		return err
	}
	if value == nil {
		value = []byte{}
	}

	nsKey := pluginCacheKey(pluginID, key)
	var err error
	if ttl > 0 {
		err = ps.pluginCache.SetWithExpiry(nsKey, value, ttl)
	} else {
		err = ps.pluginCache.SetWithDefaultExpiry(nsKey, value)
	}
	if err != nil {
		return err
	}

	ps.sendPluginCacheMessage(&pluginCacheMessage{
		Op:         pluginCacheOpSet,
		Key:        nsKey,
		Value:      value,
		TTLSeconds: int64(ttl / time.Second),
	})
	return nil
}

// PluginCacheGet returns the cached value, or nil if the key is missing.
func (ps *PlatformService) PluginCacheGet(pluginID, key string) ([]byte, error) {
	var value []byte
	err := ps.pluginCache.Get(pluginCacheKey(pluginID, key), &value)
	if errors.Is(err, cache.ErrKeyNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return value, nil
}

// PluginCacheDelete removes a key from the plugin cache on all cluster nodes.
func (ps *PlatformService) PluginCacheDelete(pluginID, key string) error {
	nsKey := pluginCacheKey(pluginID, key)
	if err := ps.pluginCache.Remove(nsKey); err != nil {
		return err
	}
	ps.sendPluginCacheMessage(&pluginCacheMessage{Op: pluginCacheOpDelete, Key: nsKey})
	return nil
}

func (ps *PlatformService) sendPluginCacheMessage(msg *pluginCacheMessage) {
	if ps.clusterIFace == nil || ps.cacheProvider.Type() == model.CacheTypeRedis {
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		ps.logger.Warn("Failed to encode plugin cache message", mlog.Err(err))
		return
	}
	ps.clusterIFace.SendClusterMessage(&model.ClusterMessage{
		Event:    model.ClusterEventPluginCache,
		SendType: model.ClusterSendBestEffort,
		Data:     data,
	})
}

func (ps *PlatformService) clusterPluginCacheHandler(msg *model.ClusterMessage) {
	var m pluginCacheMessage
	if err := json.Unmarshal(msg.Data, &m); err != nil {
		ps.logger.Warn("Failed to decode plugin cache message", mlog.Err(err))
		return
	}

	var err error
	switch m.Op {
	case pluginCacheOpSet:
		if m.TTLSeconds > 0 {
			err = ps.pluginCache.SetWithExpiry(m.Key, m.Value, time.Duration(m.TTLSeconds)*time.Second)
		} else {
			err = ps.pluginCache.SetWithDefaultExpiry(m.Key, m.Value)
		}
	case pluginCacheOpDelete:
		err = ps.pluginCache.Remove(m.Key)
	}
	if err != nil {
		ps.logger.Warn("Failed to apply plugin cache message", mlog.String("op", string(m.Op)), mlog.Err(err))
	}
}
