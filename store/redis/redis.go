// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package redis

import (
	"fmt"
	"strings"
	"time"

	"github.com/go-redis/redis"
	"github.com/mattermost/mattermost-server/v5/store"
)

const separator = "_"

type RedisCache struct {
	size                   int
	name                   string
	defaultExpiry          int64
	invalidateClusterEvent string
	client                 *redis.Client
}

// RedisCacheFactory is an implementation of CacheFactory to create a new cache in redis
type RedisCacheFactory struct {
	client *redis.Client
}

func getClient() (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	pong, err := client.Ping().Result()
	fmt.Println(pong, err)
	return client, err

}

func newRedis(size int, client *redis.Client) *RedisCache {
	return &RedisCache{
		size:   size,
		client: client,
	}
}

func newRedisWithParams(size int, client *redis.Client, name string, defaultExpiry int64, invalidateClusterEvent string) *RedisCache {
	redisCache := newRedis(size, client)
	redisCache.name = name
	redisCache.defaultExpiry = defaultExpiry
	redisCache.invalidateClusterEvent = invalidateClusterEvent
	return redisCache
}

func (c *RedisCacheFactory) NewCache(size int) store.Cache {
	return newRedis(size, c.client)
}

func (c *RedisCacheFactory) NewCacheWithParams(size int, name string, defaultExpiry int64, invalidateClusterEvent string) store.Cache {
	return newRedisWithParams(size, c.client, name, defaultExpiry, invalidateClusterEvent)
}

func (c *RedisCache) getRedisName(key string) string {
	return c.name + separator + key
}

func (c *RedisCache) getRedisAllName() string {
	return c.name + separator + "*"
}

// Add adds the given key and value to the store without an expiry.
func (c *RedisCache) Add(key, value interface{}) {
	c.AddWithExpiresInSecs(key, value, 0)
}

// Add adds the given key and value to the store with the default expiry.
func (c *RedisCache) AddWithDefaultExpires(key, value interface{}) {
	c.AddWithExpiresInSecs(key, value, c.defaultExpiry)
}

// AddWithExpiresInSecs adds the given key and value to the cache with the given expiry.
func (c *RedisCache) AddWithExpiresInSecs(key, value interface{}, expireAtSecs int64) {
	c.add(key.(string), value, time.Duration(expireAtSecs)*time.Second)
}

// Get returns the value stored in the cache for a key, or nil if no value is present. The ok result indicates whether value was found in the cache.
func (c *RedisCache) Get(key interface{}) (value interface{}, ok bool) {
	return c.getValue(key.(string))
}

func (c *RedisCache) getValue(key string) (value interface{}, ok bool) {
	redisName := c.getRedisName(key)

	val, err := c.client.Get(redisName).Result()
	if err == redis.Nil {
		return nil, false
	} else if err != nil {
		return nil, false
	} else {
		return val, true
	}

}

func (c *RedisCache) add(key string, value interface{}, ttl time.Duration) {

	redisName := c.getRedisName(key)

	exists, err := c.client.Exists(redisName).Result()
	if err != nil {
		//todo
	} else {
		if exists == 1 {
			c.client.Set(c.name+separator+key, value, ttl)
		} else {
			keys, err := c.client.Keys(c.getRedisAllName()).Result()
			if err != nil {
				//todo
			} else {
				if currentLen := len(keys); currentLen >= c.size {
					//todo
				} else {
					c.client.Set(redisName, value, ttl)
				}

			}
		}
	}

}

// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
func (c *RedisCache) GetInvalidateClusterEvent() string {
	return c.invalidateClusterEvent
}

// GetOrAdd returns the existing value for the key if present. Otherwise, it stores and returns the given value. The loaded result is true if the value was loaded, false if stored.
// This API intentionally deviates from the Add-only variants above for simplicity. We should simplify the entire API in the future.
func (c *RedisCache) GetOrAdd(key, value interface{}, ttl time.Duration) (actual interface{}, loaded bool) {
	// Check for existing item
	if actualValue, ok := c.getValue(key.(string)); ok {
		return actualValue, true
	}
	c.add(key.(string), value, ttl)
	return value, false
}

// Keys returns a slice of the keys in the cache
func (c *RedisCache) Keys() []interface{} {

	keys, err := c.client.Keys(c.getRedisAllName()).Result()
	if err != nil {
		//todo
	}

	keysInt := make([]interface{}, len(keys))
	for i := range keys {
		realKey := strings.Split(keys[i], c.Name()+separator)[1]
		keysInt[i] = realKey
	}

	return keysInt
}

// Len returns the number of items in the cache.
func (c *RedisCache) Len() int {

	keys, err := c.client.Keys(c.getRedisAllName()).Result()
	if err != nil {
		//todo
	}
	return len(keys)
}

// Name identifies this cache instance among others in the system.
func (c *RedisCache) Name() string {
	return c.name
}

// Purge is used to completely clear the cache.
func (c *RedisCache) Purge() {
	keysInt := c.Keys()
	keys := make([]string, len(keysInt))
	for i, v := range keysInt {
		keys[i] = v.(string)
		c.Remove(keys[i])
	}
}

// Remove deletes the value for a key.
func (c *RedisCache) Remove(key interface{}) {
	redisName := c.getRedisName(key.(string))
	_, err := c.client.Del(redisName).Result()
	if err != nil {
		//todo
	}
}
