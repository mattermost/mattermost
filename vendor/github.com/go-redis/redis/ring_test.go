package redis_test

import (
	"crypto/rand"
	"fmt"
	"time"

	"github.com/go-redis/redis"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Redis Ring", func() {
	const heartbeat = 100 * time.Millisecond

	var ring *redis.Ring

	setRingKeys := func() {
		for i := 0; i < 100; i++ {
			err := ring.Set(fmt.Sprintf("key%d", i), "value", 0).Err()
			Expect(err).NotTo(HaveOccurred())
		}
	}

	BeforeEach(func() {
		opt := redisRingOptions()
		opt.HeartbeatFrequency = heartbeat
		ring = redis.NewRing(opt)

		err := ring.ForEachShard(func(cl *redis.Client) error {
			return cl.FlushDB().Err()
		})
		Expect(err).NotTo(HaveOccurred())
	})

	AfterEach(func() {
		Expect(ring.Close()).NotTo(HaveOccurred())
	})

	It("distributes keys", func() {
		setRingKeys()

		// Both shards should have some keys now.
		Expect(ringShard1.Info().Val()).To(ContainSubstring("keys=57"))
		Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=43"))
	})

	It("distributes keys when using EVAL", func() {
		script := redis.NewScript(`
			local r = redis.call('SET', KEYS[1], ARGV[1])
			return r
		`)

		var key string
		for i := 0; i < 100; i++ {
			key = fmt.Sprintf("key%d", i)
			err := script.Run(ring, []string{key}, "value").Err()
			Expect(err).NotTo(HaveOccurred())
		}

		Expect(ringShard1.Info().Val()).To(ContainSubstring("keys=57"))
		Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=43"))
	})

	It("uses single shard when one of the shards is down", func() {
		// Stop ringShard2.
		Expect(ringShard2.Close()).NotTo(HaveOccurred())

		// Ring needs 3 * heartbeat time to detect that node is down.
		// Give it more to be sure.
		time.Sleep(2 * 3 * heartbeat)

		setRingKeys()

		// RingShard1 should have all keys.
		Expect(ringShard1.Info().Val()).To(ContainSubstring("keys=100"))

		// Start ringShard2.
		var err error
		ringShard2, err = startRedis(ringShard2Port)
		Expect(err).NotTo(HaveOccurred())

		// Wait for ringShard2 to come up.
		Eventually(func() error {
			return ringShard2.Ping().Err()
		}, "1s").ShouldNot(HaveOccurred())

		// Ring needs heartbeat time to detect that node is up.
		// Give it more to be sure.
		time.Sleep(heartbeat + heartbeat)

		setRingKeys()

		// RingShard2 should have its keys.
		Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=43"))
	})

	It("supports hash tags", func() {
		for i := 0; i < 100; i++ {
			err := ring.Set(fmt.Sprintf("key%d{tag}", i), "value", 0).Err()
			Expect(err).NotTo(HaveOccurred())
		}

		Expect(ringShard1.Info().Val()).ToNot(ContainSubstring("keys="))
		Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=100"))
	})

	Describe("pipeline", func() {
		It("distributes keys", func() {
			pipe := ring.Pipeline()
			for i := 0; i < 100; i++ {
				err := pipe.Set(fmt.Sprintf("key%d", i), "value", 0).Err()
				Expect(err).NotTo(HaveOccurred())
			}
			cmds, err := pipe.Exec()
			Expect(err).NotTo(HaveOccurred())
			Expect(cmds).To(HaveLen(100))
			Expect(pipe.Close()).NotTo(HaveOccurred())

			for _, cmd := range cmds {
				Expect(cmd.Err()).NotTo(HaveOccurred())
				Expect(cmd.(*redis.StatusCmd).Val()).To(Equal("OK"))
			}

			// Both shards should have some keys now.
			Expect(ringShard1.Info().Val()).To(ContainSubstring("keys=57"))
			Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=43"))
		})

		It("is consistent with ring", func() {
			var keys []string
			for i := 0; i < 100; i++ {
				key := make([]byte, 64)
				_, err := rand.Read(key)
				Expect(err).NotTo(HaveOccurred())
				keys = append(keys, string(key))
			}

			_, err := ring.Pipelined(func(pipe redis.Pipeliner) error {
				for _, key := range keys {
					pipe.Set(key, "value", 0).Err()
				}
				return nil
			})
			Expect(err).NotTo(HaveOccurred())

			for _, key := range keys {
				val, err := ring.Get(key).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(val).To(Equal("value"))
			}
		})

		It("supports hash tags", func() {
			_, err := ring.Pipelined(func(pipe redis.Pipeliner) error {
				for i := 0; i < 100; i++ {
					pipe.Set(fmt.Sprintf("key%d{tag}", i), "value", 0).Err()
				}
				return nil
			})
			Expect(err).NotTo(HaveOccurred())

			Expect(ringShard1.Info().Val()).ToNot(ContainSubstring("keys="))
			Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=100"))
		})
	})
})

var _ = Describe("empty Redis Ring", func() {
	var ring *redis.Ring

	BeforeEach(func() {
		ring = redis.NewRing(&redis.RingOptions{})
	})

	AfterEach(func() {
		Expect(ring.Close()).NotTo(HaveOccurred())
	})

	It("returns an error", func() {
		err := ring.Ping().Err()
		Expect(err).To(MatchError("redis: all ring shards are down"))
	})

	It("pipeline returns an error", func() {
		_, err := ring.Pipelined(func(pipe redis.Pipeliner) error {
			pipe.Ping()
			return nil
		})
		Expect(err).To(MatchError("redis: all ring shards are down"))
	})
})
