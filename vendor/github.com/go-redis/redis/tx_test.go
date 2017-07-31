package redis_test

import (
	"strconv"
	"sync"

	"github.com/go-redis/redis"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Tx", func() {
	var client *redis.Client

	BeforeEach(func() {
		client = redis.NewClient(redisOptions())
		Expect(client.FlushDB().Err()).NotTo(HaveOccurred())
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("should Watch", func() {
		var incr func(string) error

		// Transactionally increments key using GET and SET commands.
		incr = func(key string) error {
			err := client.Watch(func(tx *redis.Tx) error {
				n, err := tx.Get(key).Int64()
				if err != nil && err != redis.Nil {
					return err
				}

				_, err = tx.Pipelined(func(pipe redis.Pipeliner) error {
					pipe.Set(key, strconv.FormatInt(n+1, 10), 0)
					return nil
				})
				return err
			}, key)
			if err == redis.TxFailedErr {
				return incr(key)
			}
			return err
		}

		var wg sync.WaitGroup
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func() {
				defer GinkgoRecover()
				defer wg.Done()

				err := incr("key")
				Expect(err).NotTo(HaveOccurred())
			}()
		}
		wg.Wait()

		n, err := client.Get("key").Int64()
		Expect(err).NotTo(HaveOccurred())
		Expect(n).To(Equal(int64(100)))
	})

	It("should discard", func() {
		err := client.Watch(func(tx *redis.Tx) error {
			cmds, err := tx.Pipelined(func(pipe redis.Pipeliner) error {
				pipe.Set("key1", "hello1", 0)
				pipe.Discard()
				pipe.Set("key2", "hello2", 0)
				return nil
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(cmds).To(HaveLen(1))
			return err
		}, "key1", "key2")
		Expect(err).NotTo(HaveOccurred())

		get := client.Get("key1")
		Expect(get.Err()).To(Equal(redis.Nil))
		Expect(get.Val()).To(Equal(""))

		get = client.Get("key2")
		Expect(get.Err()).NotTo(HaveOccurred())
		Expect(get.Val()).To(Equal("hello2"))
	})

	It("returns no error when there are no commands", func() {
		err := client.Watch(func(tx *redis.Tx) error {
			_, err := tx.Pipelined(func(redis.Pipeliner) error { return nil })
			return err
		})
		Expect(err).NotTo(HaveOccurred())

		v, err := client.Ping().Result()
		Expect(err).NotTo(HaveOccurred())
		Expect(v).To(Equal("PONG"))
	})

	It("should exec bulks", func() {
		const N = 20000

		err := client.Watch(func(tx *redis.Tx) error {
			cmds, err := tx.Pipelined(func(pipe redis.Pipeliner) error {
				for i := 0; i < N; i++ {
					pipe.Incr("key")
				}
				return nil
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(len(cmds)).To(Equal(N))
			for _, cmd := range cmds {
				Expect(cmd.Err()).NotTo(HaveOccurred())
			}
			return err
		})
		Expect(err).NotTo(HaveOccurred())

		num, err := client.Get("key").Int64()
		Expect(err).NotTo(HaveOccurred())
		Expect(num).To(Equal(int64(N)))
	})

	It("should recover from bad connection", func() {
		// Put bad connection in the pool.
		cn, _, err := client.Pool().Get()
		Expect(err).NotTo(HaveOccurred())

		cn.SetNetConn(&badConn{})
		err = client.Pool().Put(cn)
		Expect(err).NotTo(HaveOccurred())

		do := func() error {
			err := client.Watch(func(tx *redis.Tx) error {
				_, err := tx.Pipelined(func(pipe redis.Pipeliner) error {
					pipe.Ping()
					return nil
				})
				return err
			})
			return err
		}

		err = do()
		Expect(err).To(MatchError("bad connection"))

		err = do()
		Expect(err).NotTo(HaveOccurred())
	})
})
