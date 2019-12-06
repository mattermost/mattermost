package redis

import (
	"strconv"
	"testing"
	"time"

	"github.com/go-redis/redis"

	"github.com/stretchr/testify/suite"
)

func redisClient() *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})
	return client
}

func redisFactory(client *redis.Client) *RedisCacheFactory {
	return &RedisCacheFactory{
		client: client,
	}
}

type RedisTestSuite struct {
	suite.Suite
	redisClient       *redis.Client
	redisCacheFactory *RedisCacheFactory
}

func (suite *RedisTestSuite) SetupSuite() {
	suite.redisClient = redisClient()
	suite.redisCacheFactory = redisFactory(suite.redisClient)
}

func (suite *RedisTestSuite) BeforeTest(_, _ string) {
	suite.redisClient.FlushAll()
}

func (suite *RedisTestSuite) TearDownSuite() {
	suite.redisClient.FlushAll()
	suite.redisClient.Close()
}

func TestRedisTestSuite(t *testing.T) {
	suite.Run(t, &RedisTestSuite{})
}

func (s *RedisTestSuite) TestRedis() {
	c := s.redisCacheFactory.NewCacheWithParams(128, "test", 0, "invalidateTest")
	for i := 0; i < 256; i++ {
		c.Add(strconv.Itoa(i), i)
	}
	s.Equalf(c.Len(), 128, "bad len: %v", c.Len())

	for _, k := range c.Keys() {
		v, ok := c.Get(k)
		s.True(ok, "bad key: %v", k)
		s.Equalf(v, k, "bad key: %v", k)
	}

	for i := 128; i < 256; i++ {
		_, ok := c.Get(strconv.Itoa(i))
		s.False(ok, "should be not found")
	}

	for i := 0; i < 128; i++ {
		c.Remove(strconv.Itoa(i))
		_, ok := c.Get(strconv.Itoa(i))
		s.False(ok, "should be deleted")
	}

	s.Equalf(c.Len(), 0, "bad len: %v", c.Len())
	for i := 0; i < 256; i++ {
		c.Add(strconv.Itoa(i), i)
	}
	s.Equalf(c.Len(), 128, "bad len: %v", c.Len())
	c.Purge()
	s.Equalf(c.Len(), 0, "bad len: %v", c.Len())
	_, ok := c.Get("100")
	s.False(ok, "should contain nothing")
}

func (s *RedisTestSuite) TestRedisExpire() {
	c := s.redisCacheFactory.NewCache(128)

	c.AddWithExpiresInSecs("1", 1, 1)
	c.AddWithExpiresInSecs("2", 2, 1)
	c.AddWithExpiresInSecs("3", 3, 0)

	time.Sleep(time.Millisecond * 2100)

	r1, ok := c.Get("1")
	s.False(ok, r1)

	_, ok2 := c.Get("3")
	s.True(ok2, "should exist")

	c.Remove("3")
	s.Equalf(c.Len(), 0, "bad len: %v", c.Len())

}

func (s *RedisTestSuite) TestRedisGetOrAdd() {
	c := s.redisCacheFactory.NewCache(128)

	// First GetOrAdd should save
	value, loaded := c.GetOrAdd("1", "1", 0)
	s.Equal("1", value)
	s.False(loaded)

	// Second GetOrAdd should load original value, ignoring new value
	value, loaded = c.GetOrAdd("1", "10", 0)
	s.Equal("1", value)
	s.True(loaded)

	// Third GetOrAdd should still load original value
	value, loaded = c.GetOrAdd("1", "1", 0)
	s.Equal("1", value)
	s.True(loaded)

	// First GetOrAdd on a new key should save
	value, loaded = c.GetOrAdd("2", "2", 0)
	s.Equal("2", value)
	s.False(loaded)

	c.Remove("1")

	// GetOrAdd after a remove should save
	value, loaded = c.GetOrAdd("1", "10", 0)
	s.Equal("10", value)
	s.False(loaded)

	// GetOrAdd after another key was removed should load original value for key
	value, loaded = c.GetOrAdd("2", "2", 0)
	s.Equal("2", value)
	s.True(loaded)

	// GetOrAdd should expire
	value, loaded = c.GetOrAdd("3", "3", 500*time.Millisecond)
	s.Equal("3", value)
	s.False(loaded)
	value, loaded = c.GetOrAdd("3", "4", 500*time.Millisecond)
	s.Equal("3", value)
	s.True(loaded)
	time.Sleep(1 * time.Second)
	value, loaded = c.GetOrAdd("3", "5", 500*time.Millisecond)
	s.Equal("5", value)
	s.False(loaded)
}
