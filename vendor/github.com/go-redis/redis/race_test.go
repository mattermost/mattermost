package redis_test

import (
	"bytes"
	"fmt"
	"net"
	"strconv"
	"testing"
	"time"

	"github.com/go-redis/redis"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("races", func() {
	var client *redis.Client
	var C, N int

	BeforeEach(func() {
		client = redis.NewClient(redisOptions())
		Expect(client.FlushDB().Err()).To(BeNil())

		C, N = 10, 1000
		if testing.Short() {
			C = 4
			N = 100
		}
	})

	AfterEach(func() {
		err := client.Close()
		Expect(err).NotTo(HaveOccurred())
	})

	It("should echo", func() {
		perform(C, func(id int) {
			for i := 0; i < N; i++ {
				msg := fmt.Sprintf("echo %d %d", id, i)
				echo, err := client.Echo(msg).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(echo).To(Equal(msg))
			}
		})
	})

	It("should incr", func() {
		key := "TestIncrFromGoroutines"

		perform(C, func(id int) {
			for i := 0; i < N; i++ {
				err := client.Incr(key).Err()
				Expect(err).NotTo(HaveOccurred())
			}
		})

		val, err := client.Get(key).Int64()
		Expect(err).NotTo(HaveOccurred())
		Expect(val).To(Equal(int64(C * N)))
	})

	It("should handle many keys", func() {
		perform(C, func(id int) {
			for i := 0; i < N; i++ {
				err := client.Set(
					fmt.Sprintf("keys.key-%d-%d", id, i),
					fmt.Sprintf("hello-%d-%d", id, i),
					0,
				).Err()
				Expect(err).NotTo(HaveOccurred())
			}
		})

		keys := client.Keys("keys.*")
		Expect(keys.Err()).NotTo(HaveOccurred())
		Expect(len(keys.Val())).To(Equal(C * N))
	})

	It("should handle many keys 2", func() {
		perform(C, func(id int) {
			keys := []string{"non-existent-key"}
			for i := 0; i < N; i++ {
				key := fmt.Sprintf("keys.key-%d", i)
				keys = append(keys, key)

				err := client.Set(key, fmt.Sprintf("hello-%d", i), 0).Err()
				Expect(err).NotTo(HaveOccurred())
			}
			keys = append(keys, "non-existent-key")

			vals, err := client.MGet(keys...).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(len(vals)).To(Equal(N + 2))

			for i := 0; i < N; i++ {
				Expect(vals[i+1]).To(Equal(fmt.Sprintf("hello-%d", i)))
			}

			Expect(vals[0]).To(BeNil())
			Expect(vals[N+1]).To(BeNil())
		})
	})

	It("should handle big vals in Get", func() {
		C, N = 4, 100

		bigVal := bigVal()

		err := client.Set("key", bigVal, 0).Err()
		Expect(err).NotTo(HaveOccurred())

		// Reconnect to get new connection.
		Expect(client.Close()).To(BeNil())
		client = redis.NewClient(redisOptions())

		perform(C, func(id int) {
			for i := 0; i < N; i++ {
				got, err := client.Get("key").Bytes()
				Expect(err).NotTo(HaveOccurred())
				Expect(got).To(Equal(bigVal))
			}
		})
	})

	It("should handle big vals in Set", func() {
		C, N = 4, 100

		bigVal := bigVal()
		perform(C, func(id int) {
			for i := 0; i < N; i++ {
				err := client.Set("key", bigVal, 0).Err()
				Expect(err).NotTo(HaveOccurred())
			}
		})
	})

	It("should select db", func() {
		err := client.Set("db", 1, 0).Err()
		Expect(err).NotTo(HaveOccurred())

		perform(C, func(id int) {
			opt := redisOptions()
			opt.DB = id
			client := redis.NewClient(opt)
			for i := 0; i < N; i++ {
				err := client.Set("db", id, 0).Err()
				Expect(err).NotTo(HaveOccurred())

				n, err := client.Get("db").Int64()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(id)))
			}
			err := client.Close()
			Expect(err).NotTo(HaveOccurred())
		})

		n, err := client.Get("db").Int64()
		Expect(err).NotTo(HaveOccurred())
		Expect(n).To(Equal(int64(1)))
	})

	It("should select DB with read timeout", func() {
		perform(C, func(id int) {
			opt := redisOptions()
			opt.DB = id
			opt.ReadTimeout = time.Nanosecond
			client := redis.NewClient(opt)

			perform(C, func(id int) {
				err := client.Ping().Err()
				Expect(err).To(HaveOccurred())
				Expect(err.(net.Error).Timeout()).To(BeTrue())
			})

			err := client.Close()
			Expect(err).NotTo(HaveOccurred())
		})
	})

	It("should Watch/Unwatch", func() {
		err := client.Set("key", "0", 0).Err()
		Expect(err).NotTo(HaveOccurred())

		perform(C, func(id int) {
			for i := 0; i < N; i++ {
				err := client.Watch(func(tx *redis.Tx) error {
					val, err := tx.Get("key").Result()
					Expect(err).NotTo(HaveOccurred())
					Expect(val).NotTo(Equal(redis.Nil))

					num, err := strconv.ParseInt(val, 10, 64)
					Expect(err).NotTo(HaveOccurred())

					cmds, err := tx.Pipelined(func(pipe redis.Pipeliner) error {
						pipe.Set("key", strconv.FormatInt(num+1, 10), 0)
						return nil
					})
					Expect(cmds).To(HaveLen(1))
					return err
				}, "key")
				if err == redis.TxFailedErr {
					i--
					continue
				}
				Expect(err).NotTo(HaveOccurred())
			}
		})

		val, err := client.Get("key").Int64()
		Expect(err).NotTo(HaveOccurred())
		Expect(val).To(Equal(int64(C * N)))
	})

	It("should Pipeline", func() {
		perform(C, func(id int) {
			pipe := client.Pipeline()
			for i := 0; i < N; i++ {
				pipe.Echo(fmt.Sprint(i))
			}

			cmds, err := pipe.Exec()
			Expect(err).NotTo(HaveOccurred())
			Expect(cmds).To(HaveLen(N))

			for i := 0; i < N; i++ {
				Expect(cmds[i].(*redis.StringCmd).Val()).To(Equal(fmt.Sprint(i)))
			}
		})
	})

	It("should Pipeline", func() {
		pipe := client.Pipeline()
		perform(N, func(id int) {
			pipe.Incr("key")
		})

		cmds, err := pipe.Exec()
		Expect(err).NotTo(HaveOccurred())
		Expect(cmds).To(HaveLen(N))

		n, err := client.Get("key").Int64()
		Expect(err).NotTo(HaveOccurred())
		Expect(n).To(Equal(int64(N)))
	})
})

func bigVal() []byte {
	return bytes.Repeat([]byte{'*'}, 1<<17) // 128kb
}
