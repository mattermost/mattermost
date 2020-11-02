package redis

import (
	"fmt"
	"strings"
	"time"
)

// PrefixedRedisClient struct
type PrefixedRedisClient struct {
	Prefix string
	Client Client
}

// withPrefix adds a prefix to the key if the prefix supplied has a length greater than 0
func (p *PrefixedRedisClient) withPrefix(key string) string {
	if len(p.Prefix) > 0 {
		return fmt.Sprintf("%s.%s", p.Prefix, key)
	}
	return key
}

// withoutPrefix removes the prefix from a key if the prefix has a length greater than 0
func (p *PrefixedRedisClient) withoutPrefix(key string) string {
	if len(p.Prefix) > 0 {
		return strings.Replace(key, fmt.Sprintf("%s.", p.Prefix), "", 1)
	}
	return key
}

// Get wraps around redis get method by adding prefix and returning string and error directly
func (p *PrefixedRedisClient) Get(key string) (string, error) {
	return p.Client.Get(p.withPrefix(key)).ResultString()
}

// Set wraps around redis get method by adding prefix and returning error directly
func (p *PrefixedRedisClient) Set(key string, value interface{}, expiration time.Duration) error {
	return p.Client.Set(p.withPrefix(key), value, expiration).Err()
}

// Keys wraps around redis keys method by adding prefix and returning []string and error directly
func (p *PrefixedRedisClient) Keys(pattern string) ([]string, error) {
	keys, err := p.Client.Keys(p.withPrefix(pattern)).Multi()
	if err != nil {
		return nil, err
	}

	woPrefix := make([]string, len(keys))
	for index, key := range keys {
		woPrefix[index] = p.withoutPrefix(key)
	}
	return woPrefix, nil

}

// Del wraps around redis del method by adding prefix and returning int64 and error directly
func (p *PrefixedRedisClient) Del(keys ...string) (int64, error) {
	prefixedKeys := make([]string, len(keys))
	for i, k := range keys {
		prefixedKeys[i] = p.withPrefix(k)
	}
	return p.Client.Del(prefixedKeys...).Result()
}

// SMembers returns a slice with all the members of a set
func (p *PrefixedRedisClient) SMembers(key string) ([]string, error) {
	return p.Client.SMembers(p.withPrefix(key)).Multi()
}

// SIsMember returns true if members is in the set
func (p *PrefixedRedisClient) SIsMember(key string, member interface{}) bool {
	return p.Client.SIsMember(p.withPrefix(key), member).Bool()
}

// SAdd adds new members to a set
func (p *PrefixedRedisClient) SAdd(key string, members ...interface{}) (int64, error) {
	return p.Client.SAdd(p.withPrefix(key), members...).Result()
}

// SRem removes members from a set
func (p *PrefixedRedisClient) SRem(key string, members ...interface{}) (int64, error) {
	return p.Client.SRem(p.withPrefix(key), members...).Result()
}

// Exists returns true if a key exists in redis
func (p *PrefixedRedisClient) Exists(keys ...string) (int64, error) {
	prefixedKeys := make([]string, len(keys))
	for i, k := range keys {
		prefixedKeys[i] = p.withPrefix(k)
	}
	val, err := p.Client.Exists(prefixedKeys...).Result()
	return val, err
}

// Incr increments a key. Sets it in one if it doesn't exist
func (p *PrefixedRedisClient) Incr(key string) (int64, error) {
	return p.Client.Incr(p.withPrefix(key)).Result()
}

// Decr increments a key. Sets it in one if it doesn't exist
func (p *PrefixedRedisClient) Decr(key string) (int64, error) {
	return p.Client.Decr(p.withPrefix(key)).Result()
}

// RPush insert all the specified values at the tail of the list stored at key
func (p *PrefixedRedisClient) RPush(key string, values ...interface{}) (int64, error) {
	return p.Client.RPush(p.withPrefix(key), values...).Result()
}

// LRange Returns the specified elements of the list stored at key
func (p *PrefixedRedisClient) LRange(key string, start, stop int64) ([]string, error) {
	return p.Client.LRange(p.withPrefix(key), start, stop).Multi()
}

// LTrim Trim an existing list so that it will contain only the specified range of elements specified
func (p *PrefixedRedisClient) LTrim(key string, start, stop int64) error {
	return p.Client.LTrim(p.withPrefix(key), start, stop).Err()
}

// LLen Returns the length of the list stored at key
func (p *PrefixedRedisClient) LLen(key string) (int64, error) {
	return p.Client.LLen(p.withPrefix(key)).Result()
}

// Expire set expiration time for particular key
func (p *PrefixedRedisClient) Expire(key string, value time.Duration) bool {
	return p.Client.Expire(p.withPrefix(key), value).Bool()
}

// TTL for particular key
func (p *PrefixedRedisClient) TTL(key string) time.Duration {
	return p.Client.TTL(p.withPrefix(key)).Duration()
}

// MGet fetchs multiple results
func (p *PrefixedRedisClient) MGet(keys []string) ([]interface{}, error) {
	keysWithPrefix := make([]string, 0)
	for _, key := range keys {
		keysWithPrefix = append(keysWithPrefix, p.withPrefix(key))
	}
	return p.Client.MGet(keysWithPrefix).MultiInterface()
}

// SCard implements SCard wrapper for redis
func (p *PrefixedRedisClient) SCard(key string) (int64, error) {
	return p.Client.SCard(p.withPrefix(key)).Result()
}

// Eval implements Eval wrapper for redis
func (p *PrefixedRedisClient) Eval(script string, keys []string, args ...interface{}) error {
	return p.Client.Eval(script, keys, args...).Err()
}

// NewPrefixedRedisClient returns a new Prefixed Redis Client
func NewPrefixedRedisClient(redisClient Client, prefix string) (*PrefixedRedisClient, error) {
	return &PrefixedRedisClient{
		Client: redisClient,
		Prefix: prefix,
	}, nil
}
