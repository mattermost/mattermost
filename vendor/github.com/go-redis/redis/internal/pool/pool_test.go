package pool_test

import (
	"testing"
	"time"

	"github.com/go-redis/redis/internal/pool"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("ConnPool", func() {
	var connPool *pool.ConnPool

	BeforeEach(func() {
		connPool = pool.NewConnPool(&pool.Options{
			Dialer:             dummyDialer,
			PoolSize:           10,
			PoolTimeout:        time.Hour,
			IdleTimeout:        time.Millisecond,
			IdleCheckFrequency: time.Millisecond,
		})
	})

	AfterEach(func() {
		connPool.Close()
	})

	It("should unblock client when conn is removed", func() {
		// Reserve one connection.
		cn, _, err := connPool.Get()
		Expect(err).NotTo(HaveOccurred())

		// Reserve all other connections.
		var cns []*pool.Conn
		for i := 0; i < 9; i++ {
			cn, _, err := connPool.Get()
			Expect(err).NotTo(HaveOccurred())
			cns = append(cns, cn)
		}

		started := make(chan bool, 1)
		done := make(chan bool, 1)
		go func() {
			defer GinkgoRecover()

			started <- true
			_, _, err := connPool.Get()
			Expect(err).NotTo(HaveOccurred())
			done <- true

			err = connPool.Put(cn)
			Expect(err).NotTo(HaveOccurred())
		}()
		<-started

		// Check that Get is blocked.
		select {
		case <-done:
			Fail("Get is not blocked")
		default:
			// ok
		}

		err = connPool.Remove(cn)
		Expect(err).NotTo(HaveOccurred())

		// Check that Ping is unblocked.
		select {
		case <-done:
			// ok
		case <-time.After(time.Second):
			Fail("Get is not unblocked")
		}

		for _, cn := range cns {
			err = connPool.Put(cn)
			Expect(err).NotTo(HaveOccurred())
		}
	})
})

var _ = Describe("conns reaper", func() {
	const idleTimeout = time.Minute

	var connPool *pool.ConnPool
	var conns, idleConns, closedConns []*pool.Conn

	BeforeEach(func() {
		conns = nil
		closedConns = nil

		connPool = pool.NewConnPool(&pool.Options{
			Dialer:             dummyDialer,
			PoolSize:           10,
			PoolTimeout:        time.Second,
			IdleTimeout:        idleTimeout,
			IdleCheckFrequency: time.Hour,

			OnClose: func(cn *pool.Conn) error {
				closedConns = append(closedConns, cn)
				return nil
			},
		})

		// add stale connections
		idleConns = nil
		for i := 0; i < 3; i++ {
			cn, _, err := connPool.Get()
			Expect(err).NotTo(HaveOccurred())
			cn.SetUsedAt(time.Now().Add(-2 * idleTimeout))
			conns = append(conns, cn)
			idleConns = append(idleConns, cn)
		}

		// add fresh connections
		for i := 0; i < 3; i++ {
			cn, _, err := connPool.Get()
			Expect(err).NotTo(HaveOccurred())
			conns = append(conns, cn)
		}

		for _, cn := range conns {
			Expect(connPool.Put(cn)).NotTo(HaveOccurred())
		}

		Expect(connPool.Len()).To(Equal(6))
		Expect(connPool.FreeLen()).To(Equal(6))

		n, err := connPool.ReapStaleConns()
		Expect(err).NotTo(HaveOccurred())
		Expect(n).To(Equal(3))
	})

	AfterEach(func() {
		_ = connPool.Close()
		Expect(connPool.Len()).To(Equal(0))
		Expect(connPool.FreeLen()).To(Equal(0))
		Expect(len(closedConns)).To(Equal(len(conns)))
		Expect(closedConns).To(ConsistOf(conns))
	})

	It("reaps stale connections", func() {
		Expect(connPool.Len()).To(Equal(3))
		Expect(connPool.FreeLen()).To(Equal(3))
	})

	It("does not reap fresh connections", func() {
		n, err := connPool.ReapStaleConns()
		Expect(err).NotTo(HaveOccurred())
		Expect(n).To(Equal(0))
	})

	It("stale connections are closed", func() {
		Expect(len(closedConns)).To(Equal(len(idleConns)))
		Expect(closedConns).To(ConsistOf(idleConns))
	})

	It("pool is functional", func() {
		for j := 0; j < 3; j++ {
			var freeCns []*pool.Conn
			for i := 0; i < 3; i++ {
				cn, _, err := connPool.Get()
				Expect(err).NotTo(HaveOccurred())
				Expect(cn).NotTo(BeNil())
				freeCns = append(freeCns, cn)
			}

			Expect(connPool.Len()).To(Equal(3))
			Expect(connPool.FreeLen()).To(Equal(0))

			cn, _, err := connPool.Get()
			Expect(err).NotTo(HaveOccurred())
			Expect(cn).NotTo(BeNil())
			conns = append(conns, cn)

			Expect(connPool.Len()).To(Equal(4))
			Expect(connPool.FreeLen()).To(Equal(0))

			err = connPool.Remove(cn)
			Expect(err).NotTo(HaveOccurred())

			Expect(connPool.Len()).To(Equal(3))
			Expect(connPool.FreeLen()).To(Equal(0))

			for _, cn := range freeCns {
				err := connPool.Put(cn)
				Expect(err).NotTo(HaveOccurred())
			}

			Expect(connPool.Len()).To(Equal(3))
			Expect(connPool.FreeLen()).To(Equal(3))
		}
	})
})

var _ = Describe("race", func() {
	var connPool *pool.ConnPool
	var C, N int

	BeforeEach(func() {
		C, N = 10, 1000
		if testing.Short() {
			C = 4
			N = 100
		}
	})

	AfterEach(func() {
		connPool.Close()
	})

	It("does not happen on Get, Put, and Remove", func() {
		connPool = pool.NewConnPool(&pool.Options{
			Dialer:             dummyDialer,
			PoolSize:           10,
			PoolTimeout:        time.Minute,
			IdleTimeout:        time.Millisecond,
			IdleCheckFrequency: time.Millisecond,
		})

		perform(C, func(id int) {
			for i := 0; i < N; i++ {
				cn, _, err := connPool.Get()
				Expect(err).NotTo(HaveOccurred())
				if err == nil {
					Expect(connPool.Put(cn)).NotTo(HaveOccurred())
				}
			}
		}, func(id int) {
			for i := 0; i < N; i++ {
				cn, _, err := connPool.Get()
				Expect(err).NotTo(HaveOccurred())
				if err == nil {
					Expect(connPool.Remove(cn)).NotTo(HaveOccurred())
				}
			}
		})
	})
})
