package redis_test

import (
	"bytes"
	"testing"
	"time"

	"github.com/go-redis/redis"
)

func benchmarkRedisClient(poolSize int) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:         ":6379",
		DialTimeout:  time.Second,
		ReadTimeout:  time.Second,
		WriteTimeout: time.Second,
		PoolSize:     poolSize,
	})
	if err := client.FlushDB().Err(); err != nil {
		panic(err)
	}
	return client
}

func BenchmarkRedisPing(b *testing.B) {
	client := benchmarkRedisClient(10)
	defer client.Close()

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if err := client.Ping().Err(); err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkRedisSetString(b *testing.B) {
	client := benchmarkRedisClient(10)
	defer client.Close()

	value := string(bytes.Repeat([]byte{'1'}, 10000))

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if err := client.Set("key", value, 0).Err(); err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkRedisGetNil(b *testing.B) {
	client := benchmarkRedisClient(10)
	defer client.Close()

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if err := client.Get("key").Err(); err != redis.Nil {
				b.Fatal(err)
			}
		}
	})
}

func benchmarkSetRedis(b *testing.B, poolSize, payloadSize int) {
	client := benchmarkRedisClient(poolSize)
	defer client.Close()

	value := string(bytes.Repeat([]byte{'1'}, payloadSize))

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if err := client.Set("key", value, 0).Err(); err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkSetRedis10Conns64Bytes(b *testing.B) {
	benchmarkSetRedis(b, 10, 64)
}

func BenchmarkSetRedis100Conns64Bytes(b *testing.B) {
	benchmarkSetRedis(b, 100, 64)
}

func BenchmarkSetRedis10Conns1KB(b *testing.B) {
	benchmarkSetRedis(b, 10, 1024)
}

func BenchmarkSetRedis100Conns1KB(b *testing.B) {
	benchmarkSetRedis(b, 100, 1024)
}

func BenchmarkSetRedis10Conns10KB(b *testing.B) {
	benchmarkSetRedis(b, 10, 10*1024)
}

func BenchmarkSetRedis100Conns10KB(b *testing.B) {
	benchmarkSetRedis(b, 100, 10*1024)
}

func BenchmarkSetRedis10Conns1MB(b *testing.B) {
	benchmarkSetRedis(b, 10, 1024*1024)
}

func BenchmarkSetRedis100Conns1MB(b *testing.B) {
	benchmarkSetRedis(b, 100, 1024*1024)
}

func BenchmarkRedisSetGetBytes(b *testing.B) {
	client := benchmarkRedisClient(10)
	defer client.Close()

	value := bytes.Repeat([]byte{'1'}, 10000)

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if err := client.Set("key", value, 0).Err(); err != nil {
				b.Fatal(err)
			}

			got, err := client.Get("key").Bytes()
			if err != nil {
				b.Fatal(err)
			}
			if !bytes.Equal(got, value) {
				b.Fatalf("got != value")
			}
		}
	})
}

func BenchmarkRedisMGet(b *testing.B) {
	client := benchmarkRedisClient(10)
	defer client.Close()

	if err := client.MSet("key1", "hello1", "key2", "hello2").Err(); err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if err := client.MGet("key1", "key2").Err(); err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkSetExpire(b *testing.B) {
	client := benchmarkRedisClient(10)
	defer client.Close()

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if err := client.Set("key", "hello", 0).Err(); err != nil {
				b.Fatal(err)
			}
			if err := client.Expire("key", time.Second).Err(); err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkPipeline(b *testing.B) {
	client := benchmarkRedisClient(10)
	defer client.Close()

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := client.Pipelined(func(pipe redis.Pipeliner) error {
				pipe.Set("key", "hello", 0)
				pipe.Expire("key", time.Second)
				return nil
			})
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkZAdd(b *testing.B) {
	client := benchmarkRedisClient(10)
	defer client.Close()

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if err := client.ZAdd("key", redis.Z{float64(1), "hello"}).Err(); err != nil {
				b.Fatal(err)
			}
		}
	})
}
