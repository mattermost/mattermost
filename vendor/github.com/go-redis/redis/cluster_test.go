package redis_test

import (
	"bytes"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-redis/redis"
	"github.com/go-redis/redis/internal/hashtag"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

type clusterScenario struct {
	ports     []string
	nodeIds   []string
	processes map[string]*redisProcess
	clients   map[string]*redis.Client
}

func (s *clusterScenario) masters() []*redis.Client {
	result := make([]*redis.Client, 3)
	for pos, port := range s.ports[:3] {
		result[pos] = s.clients[port]
	}
	return result
}

func (s *clusterScenario) slaves() []*redis.Client {
	result := make([]*redis.Client, 3)
	for pos, port := range s.ports[3:] {
		result[pos] = s.clients[port]
	}
	return result
}

func (s *clusterScenario) addrs() []string {
	addrs := make([]string, len(s.ports))
	for i, port := range s.ports {
		addrs[i] = net.JoinHostPort("127.0.0.1", port)
	}
	return addrs
}

func (s *clusterScenario) clusterClient(opt *redis.ClusterOptions) *redis.ClusterClient {
	opt.Addrs = s.addrs()
	return redis.NewClusterClient(opt)
}

func startCluster(scenario *clusterScenario) error {
	// Start processes and collect node ids
	for pos, port := range scenario.ports {
		process, err := startRedis(port, "--cluster-enabled", "yes")
		if err != nil {
			return err
		}

		client := redis.NewClient(&redis.Options{
			Addr: ":" + port,
		})

		info, err := client.ClusterNodes().Result()
		if err != nil {
			return err
		}

		scenario.processes[port] = process
		scenario.clients[port] = client
		scenario.nodeIds[pos] = info[:40]
	}

	// Meet cluster nodes.
	for _, client := range scenario.clients {
		err := client.ClusterMeet("127.0.0.1", scenario.ports[0]).Err()
		if err != nil {
			return err
		}
	}

	// Bootstrap masters.
	slots := []int{0, 5000, 10000, 16384}
	for pos, master := range scenario.masters() {
		err := master.ClusterAddSlotsRange(slots[pos], slots[pos+1]-1).Err()
		if err != nil {
			return err
		}
	}

	// Bootstrap slaves.
	for idx, slave := range scenario.slaves() {
		masterId := scenario.nodeIds[idx]

		// Wait until master is available
		err := eventually(func() error {
			s := slave.ClusterNodes().Val()
			wanted := masterId
			if !strings.Contains(s, wanted) {
				return fmt.Errorf("%q does not contain %q", s, wanted)
			}
			return nil
		}, 10*time.Second)
		if err != nil {
			return err
		}

		err = slave.ClusterReplicate(masterId).Err()
		if err != nil {
			return err
		}
	}

	// Wait until all nodes have consistent info.
	for _, client := range scenario.clients {
		err := eventually(func() error {
			res, err := client.ClusterSlots().Result()
			if err != nil {
				return err
			}
			wanted := []redis.ClusterSlot{
				{0, 4999, []redis.ClusterNode{{"", "127.0.0.1:8220"}, {"", "127.0.0.1:8223"}}},
				{5000, 9999, []redis.ClusterNode{{"", "127.0.0.1:8221"}, {"", "127.0.0.1:8224"}}},
				{10000, 16383, []redis.ClusterNode{{"", "127.0.0.1:8222"}, {"", "127.0.0.1:8225"}}},
			}
			return assertSlotsEqual(res, wanted)
		}, 30*time.Second)
		if err != nil {
			return err
		}
	}

	return nil
}

func assertSlotsEqual(slots, wanted []redis.ClusterSlot) error {
outer_loop:
	for _, s2 := range wanted {
		for _, s1 := range slots {
			if slotEqual(s1, s2) {
				continue outer_loop
			}
		}
		return fmt.Errorf("%v not found in %v", s2, slots)
	}
	return nil
}

func slotEqual(s1, s2 redis.ClusterSlot) bool {
	if s1.Start != s2.Start {
		return false
	}
	if s1.End != s2.End {
		return false
	}
	if len(s1.Nodes) != len(s2.Nodes) {
		return false
	}
	for i, n1 := range s1.Nodes {
		if n1.Addr != s2.Nodes[i].Addr {
			return false
		}
	}
	return true
}

func stopCluster(scenario *clusterScenario) error {
	for _, client := range scenario.clients {
		if err := client.Close(); err != nil {
			return err
		}
	}
	for _, process := range scenario.processes {
		if err := process.Close(); err != nil {
			return err
		}
	}
	return nil
}

//------------------------------------------------------------------------------

var _ = Describe("ClusterClient", func() {
	var opt *redis.ClusterOptions
	var client *redis.ClusterClient

	assertClusterClient := func() {
		It("should GET/SET/DEL", func() {
			val, err := client.Get("A").Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(Equal(""))

			val, err = client.Set("A", "VALUE", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("OK"))

			Eventually(func() string {
				return client.Get("A").Val()
			}, 30*time.Second).Should(Equal("VALUE"))

			cnt, err := client.Del("A").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(cnt).To(Equal(int64(1)))
		})

		It("follows redirects", func() {
			Expect(client.Set("A", "VALUE", 0).Err()).NotTo(HaveOccurred())

			slot := hashtag.Slot("A")
			client.SwapSlotNodes(slot)

			Eventually(func() string {
				return client.Get("A").Val()
			}, 30*time.Second).Should(Equal("VALUE"))
		})

		It("distributes keys", func() {
			for i := 0; i < 100; i++ {
				err := client.Set(fmt.Sprintf("key%d", i), "value", 0).Err()
				Expect(err).NotTo(HaveOccurred())
			}

			for _, master := range cluster.masters() {
				Eventually(func() string {
					return master.Info("keyspace").Val()
				}, 30*time.Second).Should(Or(
					ContainSubstring("keys=31"),
					ContainSubstring("keys=29"),
					ContainSubstring("keys=40"),
				))
			}
		})

		It("distributes keys when using EVAL", func() {
			script := redis.NewScript(`
				local r = redis.call('SET', KEYS[1], ARGV[1])
				return r
			`)

			var key string
			for i := 0; i < 100; i++ {
				key = fmt.Sprintf("key%d", i)
				err := script.Run(client, []string{key}, "value").Err()
				Expect(err).NotTo(HaveOccurred())
			}

			for _, master := range cluster.masters() {
				Eventually(func() string {
					return master.Info("keyspace").Val()
				}, 30*time.Second).Should(Or(
					ContainSubstring("keys=31"),
					ContainSubstring("keys=29"),
					ContainSubstring("keys=40"),
				))
			}
		})

		It("supports Watch", func() {
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

		Describe("pipelining", func() {
			var pipe *redis.Pipeline

			assertPipeline := func() {
				keys := []string{"A", "B", "C", "D", "E", "F", "G"}

				It("follows redirects", func() {
					for _, key := range keys {
						slot := hashtag.Slot(key)
						client.SwapSlotNodes(slot)
					}

					for i, key := range keys {
						pipe.Set(key, key+"_value", 0)
						pipe.Expire(key, time.Duration(i+1)*time.Hour)
					}
					cmds, err := pipe.Exec()
					Expect(err).NotTo(HaveOccurred())
					Expect(cmds).To(HaveLen(14))

					for _, key := range keys {
						slot := hashtag.Slot(key)
						client.SwapSlotNodes(slot)
					}

					for _, key := range keys {
						pipe.Get(key)
						pipe.TTL(key)
					}
					cmds, err = pipe.Exec()
					Expect(err).NotTo(HaveOccurred())
					Expect(cmds).To(HaveLen(14))

					for i, key := range keys {
						get := cmds[i*2].(*redis.StringCmd)
						Expect(get.Val()).To(Equal(key + "_value"))

						ttl := cmds[(i*2)+1].(*redis.DurationCmd)
						dur := time.Duration(i+1) * time.Hour
						Expect(ttl.Val()).To(BeNumerically("~", dur, 5*time.Second))
					}
				})

				It("works with missing keys", func() {
					pipe.Set("A", "A_value", 0)
					pipe.Set("C", "C_value", 0)
					_, err := pipe.Exec()
					Expect(err).NotTo(HaveOccurred())

					a := pipe.Get("A")
					b := pipe.Get("B")
					c := pipe.Get("C")
					cmds, err := pipe.Exec()
					Expect(err).To(Equal(redis.Nil))
					Expect(cmds).To(HaveLen(3))

					Expect(a.Err()).NotTo(HaveOccurred())
					Expect(a.Val()).To(Equal("A_value"))

					Expect(b.Err()).To(Equal(redis.Nil))
					Expect(b.Val()).To(Equal(""))

					Expect(c.Err()).NotTo(HaveOccurred())
					Expect(c.Val()).To(Equal("C_value"))
				})
			}

			Describe("with Pipeline", func() {
				BeforeEach(func() {
					pipe = client.Pipeline().(*redis.Pipeline)
				})

				AfterEach(func() {
					Expect(pipe.Close()).NotTo(HaveOccurred())
				})

				assertPipeline()
			})

			Describe("with TxPipeline", func() {
				BeforeEach(func() {
					pipe = client.TxPipeline().(*redis.Pipeline)
				})

				AfterEach(func() {
					Expect(pipe.Close()).NotTo(HaveOccurred())
				})

				assertPipeline()
			})
		})

		It("supports PubSub", func() {
			pubsub := client.Subscribe("mychannel")
			defer pubsub.Close()

			Eventually(func() error {
				_, err := client.Publish("mychannel", "hello").Result()
				if err != nil {
					return err
				}

				msg, err := pubsub.ReceiveTimeout(time.Second)
				if err != nil {
					return err
				}

				_, ok := msg.(*redis.Message)
				if !ok {
					return fmt.Errorf("got %T, wanted *redis.Message", msg)
				}

				return nil
			}, 30*time.Second).ShouldNot(HaveOccurred())
		})
	}

	Describe("ClusterClient", func() {
		BeforeEach(func() {
			opt = redisClusterOptions()
			client = cluster.clusterClient(opt)

			_ = client.ForEachMaster(func(master *redis.Client) error {
				return master.FlushDB().Err()
			})
		})

		AfterEach(func() {
			_ = client.ForEachMaster(func(master *redis.Client) error {
				return master.FlushDB().Err()
			})
			Expect(client.Close()).NotTo(HaveOccurred())
		})

		It("returns pool stats", func() {
			Expect(client.PoolStats()).To(BeAssignableToTypeOf(&redis.PoolStats{}))
		})

		It("removes idle connections", func() {
			stats := client.PoolStats()
			Expect(stats.TotalConns).NotTo(BeZero())
			Expect(stats.FreeConns).NotTo(BeZero())

			time.Sleep(2 * time.Second)

			stats = client.PoolStats()
			Expect(stats.TotalConns).To(BeZero())
			Expect(stats.FreeConns).To(BeZero())
		})

		It("returns an error when there are no attempts left", func() {
			opt := redisClusterOptions()
			opt.MaxRedirects = -1
			client := cluster.clusterClient(opt)

			slot := hashtag.Slot("A")
			client.SwapSlotNodes(slot)

			err := client.Get("A").Err()
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("MOVED"))

			Expect(client.Close()).NotTo(HaveOccurred())
		})

		It("calls fn for every master node", func() {
			for i := 0; i < 10; i++ {
				Expect(client.Set(strconv.Itoa(i), "", 0).Err()).NotTo(HaveOccurred())
			}

			err := client.ForEachMaster(func(master *redis.Client) error {
				return master.FlushDB().Err()
			})
			Expect(err).NotTo(HaveOccurred())

			size, err := client.DBSize().Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(0)))
		})

		It("should CLUSTER SLOTS", func() {
			res, err := client.ClusterSlots().Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(HaveLen(3))

			wanted := []redis.ClusterSlot{
				{0, 4999, []redis.ClusterNode{{"", "127.0.0.1:8220"}, {"", "127.0.0.1:8223"}}},
				{5000, 9999, []redis.ClusterNode{{"", "127.0.0.1:8221"}, {"", "127.0.0.1:8224"}}},
				{10000, 16383, []redis.ClusterNode{{"", "127.0.0.1:8222"}, {"", "127.0.0.1:8225"}}},
			}
			Expect(assertSlotsEqual(res, wanted)).NotTo(HaveOccurred())
		})

		It("should CLUSTER NODES", func() {
			res, err := client.ClusterNodes().Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(len(res)).To(BeNumerically(">", 400))
		})

		It("should CLUSTER INFO", func() {
			res, err := client.ClusterInfo().Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(ContainSubstring("cluster_known_nodes:6"))
		})

		It("should CLUSTER KEYSLOT", func() {
			hashSlot, err := client.ClusterKeySlot("somekey").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(hashSlot).To(Equal(int64(hashtag.Slot("somekey"))))
		})

		It("should CLUSTER COUNT-FAILURE-REPORTS", func() {
			n, err := client.ClusterCountFailureReports(cluster.nodeIds[0]).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(0)))
		})

		It("should CLUSTER COUNTKEYSINSLOT", func() {
			n, err := client.ClusterCountKeysInSlot(10).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(0)))
		})

		It("should CLUSTER SAVECONFIG", func() {
			res, err := client.ClusterSaveConfig().Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(Equal("OK"))
		})

		It("should CLUSTER SLAVES", func() {
			nodesList, err := client.ClusterSlaves(cluster.nodeIds[0]).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(nodesList).Should(ContainElement(ContainSubstring("slave")))
			Expect(nodesList).Should(HaveLen(1))
		})

		assertClusterClient()
	})

	Describe("ClusterClient failover", func() {
		BeforeEach(func() {
			opt = redisClusterOptions()
			client = cluster.clusterClient(opt)

			_ = client.ForEachMaster(func(master *redis.Client) error {
				return master.FlushDB().Err()
			})

			_ = client.ForEachSlave(func(slave *redis.Client) error {
				Eventually(func() int64 {
					return client.DBSize().Val()
				}, 30*time.Second).Should(Equal(int64(0)))
				return slave.ClusterFailover().Err()
			})
		})

		AfterEach(func() {
			_ = client.ForEachMaster(func(master *redis.Client) error {
				return master.FlushDB().Err()
			})
			Expect(client.Close()).NotTo(HaveOccurred())
		})

		assertClusterClient()
	})

	Describe("ClusterClient with RouteByLatency", func() {
		BeforeEach(func() {
			opt = redisClusterOptions()
			opt.RouteByLatency = true
			client = cluster.clusterClient(opt)

			_ = client.ForEachMaster(func(master *redis.Client) error {
				return master.FlushDB().Err()
			})

			_ = client.ForEachSlave(func(slave *redis.Client) error {
				Eventually(func() int64 {
					return client.DBSize().Val()
				}, 30*time.Second).Should(Equal(int64(0)))
				return nil
			})
		})

		AfterEach(func() {
			_ = client.ForEachMaster(func(master *redis.Client) error {
				return master.FlushDB().Err()
			})
			Expect(client.Close()).NotTo(HaveOccurred())
		})

		assertClusterClient()
	})
})

var _ = Describe("ClusterClient without nodes", func() {
	var client *redis.ClusterClient

	BeforeEach(func() {
		client = redis.NewClusterClient(&redis.ClusterOptions{})
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("Ping returns an error", func() {
		err := client.Ping().Err()
		Expect(err).To(MatchError("redis: cluster has no nodes"))
	})

	It("pipeline returns an error", func() {
		_, err := client.Pipelined(func(pipe redis.Pipeliner) error {
			pipe.Ping()
			return nil
		})
		Expect(err).To(MatchError("redis: cluster has no nodes"))
	})
})

var _ = Describe("ClusterClient without valid nodes", func() {
	var client *redis.ClusterClient

	BeforeEach(func() {
		client = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs: []string{redisAddr},
		})
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("returns an error", func() {
		err := client.Ping().Err()
		Expect(err).To(MatchError("redis: cannot load cluster slots"))
	})

	It("pipeline returns an error", func() {
		_, err := client.Pipelined(func(pipe redis.Pipeliner) error {
			pipe.Ping()
			return nil
		})
		Expect(err).To(MatchError("redis: cannot load cluster slots"))
	})
})

var _ = Describe("ClusterClient timeout", func() {
	var client *redis.ClusterClient

	AfterEach(func() {
		_ = client.Close()
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

		It("Tx timeouts", func() {
			err := client.Watch(func(tx *redis.Tx) error {
				return tx.Ping().Err()
			}, "foo")
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
			}, "foo")
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})
	}

	const pause = time.Second

	Context("read/write timeout", func() {
		BeforeEach(func() {
			opt := redisClusterOptions()
			opt.ReadTimeout = 100 * time.Millisecond
			opt.WriteTimeout = 100 * time.Millisecond
			opt.MaxRedirects = 1
			client = cluster.clusterClient(opt)

			err := client.ForEachNode(func(client *redis.Client) error {
				return client.ClientPause(pause).Err()
			})
			Expect(err).NotTo(HaveOccurred())
		})

		AfterEach(func() {
			client.ForEachNode(func(client *redis.Client) error {
				Eventually(func() error {
					return client.Ping().Err()
				}, 2*pause).ShouldNot(HaveOccurred())
				return nil
			})
		})

		testTimeout()
	})
})

//------------------------------------------------------------------------------

func BenchmarkRedisClusterPing(b *testing.B) {
	if testing.Short() {
		b.Skip("skipping in short mode")
	}

	cluster := &clusterScenario{
		ports:     []string{"8220", "8221", "8222", "8223", "8224", "8225"},
		nodeIds:   make([]string, 6),
		processes: make(map[string]*redisProcess, 6),
		clients:   make(map[string]*redis.Client, 6),
	}

	if err := startCluster(cluster); err != nil {
		b.Fatal(err)
	}
	defer stopCluster(cluster)

	client := cluster.clusterClient(redisClusterOptions())
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

func BenchmarkRedisClusterSetString(b *testing.B) {
	if testing.Short() {
		b.Skip("skipping in short mode")
	}

	cluster := &clusterScenario{
		ports:     []string{"8220", "8221", "8222", "8223", "8224", "8225"},
		nodeIds:   make([]string, 6),
		processes: make(map[string]*redisProcess, 6),
		clients:   make(map[string]*redis.Client, 6),
	}

	if err := startCluster(cluster); err != nil {
		b.Fatal(err)
	}
	defer stopCluster(cluster)

	client := cluster.clusterClient(redisClusterOptions())
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
