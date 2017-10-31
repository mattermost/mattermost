// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"bytes"
	"context"
	"encoding/gob"

	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/go-redis/redis"
	"github.com/mattermost/mattermost-server/model"
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
		l4g.Error("Unable to ping redis server: " + err.Error())
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

func (s *RedisSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if err := s.client.Del("reactions:" + reaction.PostId).Err(); err != nil {
		l4g.Error("Redis failed to remove key reactions:" + reaction.PostId + " Error: " + err.Error())
	}
	return s.Next().ReactionSave(ctx, reaction, hints...)
}

func (s *RedisSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if err := s.client.Del("reactions:" + reaction.PostId).Err(); err != nil {
		l4g.Error("Redis failed to remove key reactions:" + reaction.PostId + " Error: " + err.Error())
	}
	return s.Next().ReactionDelete(ctx, reaction, hints...)
}

func (s *RedisSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	var resultdata []*model.Reaction
	found, err := s.load("reactions:"+postId, &resultdata)
	if found {
		result := NewSupplierResult()
		result.Data = resultdata
		return result
	}
	if err != nil {
		l4g.Error("Redis encountered an error on read: " + err.Error())
	}

	result := s.Next().ReactionGetForPost(ctx, postId, hints...)

	if err := s.save("reactions:"+postId, result.Data, REDIS_EXPIRY_TIME); err != nil {
		l4g.Error("Redis encountered and error on write: " + err.Error())
	}

	return result
}

func (s *RedisSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// Ignoring this. It's probably OK to have the emoji slowly expire from Redis.
	return s.Next().ReactionDeleteAllWithEmojiName(ctx, emojiName, hints...)
}

func (s *RedisSupplier) ReactionPermanentDeleteBatch(ctx context.Context, endTime int64, limit int64, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// Ignoring this. It's probably OK to have the emoji slowly expire from Redis.
	return s.Next().ReactionPermanentDeleteBatch(ctx, endTime, limit, hints...)
}
