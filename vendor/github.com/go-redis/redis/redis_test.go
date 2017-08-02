package redis_test

import (
	"bytes"
	"net"
	"time"

	"github.com/go-redis/redis"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Client", func() {
	var client *redis.Client

	BeforeEach(func() {
		client = redis.NewClient(redisOptions())
		Expect(client.FlushDB().Err()).NotTo(HaveOccurred())
	})

	AfterEach(func() {
		client.Close()
	})

	It("should Stringer", func() {
		Expect(client.String()).To(Equal("Redis<:6380 db:15>"))
	})

	It("should ping", func() {
		val, err := client.Ping().Result()
		Expect(err).NotTo(HaveOccurred())
		Expect(val).To(Equal("PONG"))
	})

	It("should return pool stats", func() {
		Expect(client.PoolStats()).To(BeAssignableToTypeOf(&redis.PoolStats{}))
	})

	It("should support custom dialers", func() {
		custom := redis.NewClient(&redis.Options{
			Addr: ":1234",
			Dialer: func() (net.Conn, error) {
				return net.Dial("tcp", redisAddr)
			},
		})

		val, err := custom.Ping().Result()
		Expect(err).NotTo(HaveOccurred())
		Expect(val).To(Equal("PONG"))
		Expect(custom.Close()).NotTo(HaveOccurred())
	})

	It("should close", func() {
		Expect(client.Close()).NotTo(HaveOccurred())
		err := client.Ping().Err()
		Expect(err).To(MatchError("redis: client is closed"))
	})

	It("should close pubsub without closing the client", func() {
		pubsub := client.Subscribe()
		Expect(pubsub.Close()).NotTo(HaveOccurred())

		_, err := pubsub.Receive()
		Expect(err).To(MatchError("redis: client is closed"))
		Expect(client.Ping().Err()).NotTo(HaveOccurred())
	})

	It("should close Tx without closing the client", func() {
		err := client.Watch(func(tx *redis.Tx) error {
			_, err := tx.Pipelined(func(pipe redis.Pipeliner) error {
				pipe.Ping()
				return nil
			})
			return err
		})
		Expect(err).NotTo(HaveOccurred())

		Expect(client.Ping().Err()).NotTo(HaveOccurred())
	})

	It("should close pipeline without closing the client", func() {
		pipeline := client.Pipeline()
		Expect(pipeline.Close()).NotTo(HaveOccurred())

		pipeline.Ping()
		_, err := pipeline.Exec()
		Expect(err).To(MatchError("redis: client is closed"))

		Expect(client.Ping().Err()).NotTo(HaveOccurred())
	})

	It("should close pubsub when client is closed", func() {
		pubsub := client.Subscribe()
		Expect(client.Close()).NotTo(HaveOccurred())

		_, err := pubsub.Receive()
		Expect(err).To(MatchError("redis: client is closed"))

		Expect(pubsub.Close()).NotTo(HaveOccurred())
	})

	It("should close pipeline when client is closed", func() {
		pipeline := client.Pipeline()
		Expect(client.Close()).NotTo(HaveOccurred())
		Expect(pipeline.Close()).NotTo(HaveOccurred())
	})

	It("should select DB", func() {
		db2 := redis.NewClient(&redis.Options{
			Addr: redisAddr,
			DB:   2,
		})
		Expect(db2.FlushDB().Err()).NotTo(HaveOccurred())
		Expect(db2.Get("db").Err()).To(Equal(redis.Nil))
		Expect(db2.Set("db", 2, 0).Err()).NotTo(HaveOccurred())

		n, err := db2.Get("db").Int64()
		Expect(err).NotTo(HaveOccurred())
		Expect(n).To(Equal(int64(2)))

		Expect(client.Get("db").Err()).To(Equal(redis.Nil))

		Expect(db2.FlushDB().Err()).NotTo(HaveOccurred())
		Expect(db2.Close()).NotTo(HaveOccurred())
	})

	It("processes custom commands", func() {
		cmd := redis.NewCmd("PING")
		client.Process(cmd)

		// Flush buffers.
		Expect(client.Echo("hello").Err()).NotTo(HaveOccurred())

		Expect(cmd.Err()).NotTo(HaveOccurred())
		Expect(cmd.Val()).To(Equal("PONG"))
	})

	It("should retry command on network error", func() {
		Expect(client.Close()).NotTo(HaveOccurred())

		client = redis.NewClient(&redis.Options{
			Addr:       redisAddr,
			MaxRetries: 1,
		})

		// Put bad connection in the pool.
		cn, _, err := client.Pool().Get()
		Expect(err).NotTo(HaveOccurred())

		cn.SetNetConn(&badConn{})
		err = client.Pool().Put(cn)
		Expect(err).NotTo(HaveOccurred())

		err = client.Ping().Err()
		Expect(err).NotTo(HaveOccurred())
	})

	It("should retry with backoff", func() {
		Expect(client.Close()).NotTo(HaveOccurred())

		// use up all the available connections to force a fail
		connectionHogClient := redis.NewClient(&redis.Options{
			Addr:       redisAddr,
			MaxRetries: 1,
		})
		defer connectionHogClient.Close()

		for i := 0; i <= 1002; i++ {
			connectionHogClient.Pool().NewConn()
		}

		clientNoRetry := redis.NewClient(&redis.Options{
			Addr:            redisAddr,
			PoolSize:        1,
			MaxRetryBackoff: -1,
		})
		defer clientNoRetry.Close()

		clientRetry := redis.NewClient(&redis.Options{
			Addr:            redisAddr,
			MaxRetries:      5,
			PoolSize:        1,
			MaxRetryBackoff: 128 * time.Millisecond,
		})
		defer clientRetry.Close()

		startNoRetry := time.Now()
		err := clientNoRetry.Ping().Err()
		Expect(err).To(HaveOccurred())
		elapseNoRetry := time.Since(startNoRetry)

		startRetry := time.Now()
		err = clientRetry.Ping().Err()
		Expect(err).To(HaveOccurred())
		elapseRetry := time.Since(startRetry)

		Expect(elapseRetry > elapseNoRetry).To(BeTrue())
	})

	It("should update conn.UsedAt on read/write", func() {
		cn, _, err := client.Pool().Get()
		Expect(err).NotTo(HaveOccurred())
		Expect(cn.UsedAt).NotTo(BeZero())
		createdAt := cn.UsedAt()

		err = client.Pool().Put(cn)
		Expect(err).NotTo(HaveOccurred())
		Expect(cn.UsedAt().Equal(createdAt)).To(BeTrue())

		err = client.Ping().Err()
		Expect(err).NotTo(HaveOccurred())

		cn, _, err = client.Pool().Get()
		Expect(err).NotTo(HaveOccurred())
		Expect(cn).NotTo(BeNil())
		Expect(cn.UsedAt().After(createdAt)).To(BeTrue())
	})

	It("should process command with special chars", func() {
		set := client.Set("key", "hello1\r\nhello2\r\n", 0)
		Expect(set.Err()).NotTo(HaveOccurred())
		Expect(set.Val()).To(Equal("OK"))

		get := client.Get("key")
		Expect(get.Err()).NotTo(HaveOccurred())
		Expect(get.Val()).To(Equal("hello1\r\nhello2\r\n"))
	})

	It("should handle big vals", func() {
		bigVal := bytes.Repeat([]byte{'*'}, 2e6)

		err := client.Set("key", bigVal, 0).Err()
		Expect(err).NotTo(HaveOccurred())

		// Reconnect to get new connection.
		Expect(client.Close()).NotTo(HaveOccurred())
		client = redis.NewClient(redisOptions())

		got, err := client.Get("key").Bytes()
		Expect(err).NotTo(HaveOccurred())
		Expect(got).To(Equal(bigVal))
	})

	It("should call WrapProcess", func() {
		var wrapperFnCalled bool

		client.WrapProcess(func(oldProcess func(redis.Cmder) error) func(redis.Cmder) error {
			return func(cmd redis.Cmder) error {
				wrapperFnCalled = true
				return oldProcess(cmd)
			}
		})

		Expect(client.Ping().Err()).NotTo(HaveOccurred())

		Expect(wrapperFnCalled).To(BeTrue())
	})
})

var _ = Describe("Client timeout", func() {
	var opt *redis.Options
	var client *redis.Client

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	testTimeout := func() {
		It("Ping timeouts", func() {
			err := client.Ping().Err()
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})

		It("Pipeline timeouts", func() {
			_, err := client.Pipelined(func(pipe redis.Pipeliner) error {
				pipe.Ping()
				return nil
			})
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})

		It("Subscribe timeouts", func() {
			if opt.WriteTimeout == 0 {
				return
			}

			pubsub := client.Subscribe()
			defer pubsub.Close()

			err := pubsub.Subscribe("_")
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})

		It("Tx timeouts", func() {
			err := client.Watch(func(tx *redis.Tx) error {
				return tx.Ping().Err()
			})
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})

		It("Tx Pipeline timeouts", func() {
			err := client.Watch(func(tx *redis.Tx) error {
				_, err := tx.Pipelined(func(pipe redis.Pipeliner) error {
					pipe.Ping()
					return nil
				})
				return err
			})
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})
	}

	Context("read timeout", func() {
		BeforeEach(func() {
			opt = redisOptions()
			opt.ReadTimeout = time.Nanosecond
			opt.WriteTimeout = -1
			client = redis.NewClient(opt)
		})

		testTimeout()
	})

	Context("write timeout", func() {
		BeforeEach(func() {
			opt = redisOptions()
			opt.ReadTimeout = -1
			opt.WriteTimeout = time.Nanosecond
			client = redis.NewClient(opt)
		})

		testTimeout()
	})
})

var _ = Describe("Client OnConnect", func() {
	var client *redis.Client

	BeforeEach(func() {
		opt := redisOptions()
		opt.DB = 0
		opt.OnConnect = func(cn *redis.Conn) error {
			return cn.ClientSetName("on_connect").Err()
		}

		client = redis.NewClient(opt)
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("calls OnConnect", func() {
		name, err := client.ClientGetName().Result()
		Expect(err).NotTo(HaveOccurred())
		Expect(name).To(Equal("on_connect"))
	})
})
