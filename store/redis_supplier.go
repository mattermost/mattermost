// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"bytes"
	"encoding/gob"

	"time"

	"github.com/go-redis/redis"
	"github.com/mattermost/mattermost-server/mlog"
)

const REDIS_EXPIRY_TIME = 30 * time.Minute

type RedisSupplier struct {
	next   LayeredStoreSupplier
	client *redis.Client
}

func GetBytes(key interface{}) ([]byte, error) {
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	err := enc.Encode(key)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func DecodeBytes(input []byte, thing interface{}) error {
	dec := gob.NewDecoder(bytes.NewReader(input))
	return dec.Decode(thing)
}

func NewRedisSupplier() *RedisSupplier {
	supplier := &RedisSupplier{}

	supplier.client = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	if _, err := supplier.client.Ping().Result(); err != nil {
		mlog.Error("Unable to ping redis server: " + err.Error())
		return nil
	}

	return supplier
}

func (s *RedisSupplier) save(key string, value interface{}, expiry time.Duration) error {
	if bytes, err := GetBytes(value); err != nil {
		return err
	} else {
		if err := s.client.Set(key, bytes, expiry).Err(); err != nil {
			return err
		}
	}
	return nil
}

func (s *RedisSupplier) load(key string, writeTo interface{}) (bool, error) {
	if data, err := s.client.Get(key).Bytes(); err != nil {
		if err == redis.Nil {
			return false, nil
		} else {
			return false, err
		}
	} else {
		if err := DecodeBytes(data, writeTo); err != nil {
			return false, err
		}
	}
	return true, nil
}

func (s *RedisSupplier) SetChainNext(next LayeredStoreSupplier) {
	s.next = next
}

func (s *RedisSupplier) Next() LayeredStoreSupplier {
	return s.next
}
