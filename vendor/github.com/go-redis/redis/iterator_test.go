package redis_test

import (
	"fmt"

	"github.com/go-redis/redis"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("ScanIterator", func() {
	var client *redis.Client

	var seed = func(n int) error {
		pipe := client.Pipeline()
		for i := 1; i <= n; i++ {
			pipe.Set(fmt.Sprintf("K%02d", i), "x", 0).Err()
		}
		_, err := pipe.Exec()
		return err
	}

	var extraSeed = func(n int, m int) error {
		pipe := client.Pipeline()
		for i := 1; i <= m; i++ {
			pipe.Set(fmt.Sprintf("A%02d", i), "x", 0).Err()
		}
		for i := 1; i <= n; i++ {
			pipe.Set(fmt.Sprintf("K%02d", i), "x", 0).Err()
		}
		_, err := pipe.Exec()
		return err
	}

	var hashKey = "K_HASHTEST"
	var hashSeed = func(n int) error {
		pipe := client.Pipeline()
		for i := 1; i <= n; i++ {
			pipe.HSet(hashKey, fmt.Sprintf("K%02d", i), "x").Err()
		}
		_, err := pipe.Exec()
		return err
	}

	BeforeEach(func() {
		client = redis.NewClient(redisOptions())
		Expect(client.FlushDB().Err()).NotTo(HaveOccurred())
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("should scan across empty DBs", func() {
		iter := client.Scan(0, "", 10).Iterator()
		Expect(iter.Next()).To(BeFalse())
		Expect(iter.Err()).NotTo(HaveOccurred())
	})

	It("should scan across one page", func() {
		Expect(seed(7)).NotTo(HaveOccurred())

		var vals []string
		iter := client.Scan(0, "", 0).Iterator()
		for iter.Next() {
			vals = append(vals, iter.Val())
		}
		Expect(iter.Err()).NotTo(HaveOccurred())
		Expect(vals).To(ConsistOf([]string{"K01", "K02", "K03", "K04", "K05", "K06", "K07"}))
	})

	It("should scan across multiple pages", func() {
		Expect(seed(71)).NotTo(HaveOccurred())

		var vals []string
		iter := client.Scan(0, "", 10).Iterator()
		for iter.Next() {
			vals = append(vals, iter.Val())
		}
		Expect(iter.Err()).NotTo(HaveOccurred())
		Expect(vals).To(HaveLen(71))
		Expect(vals).To(ContainElement("K01"))
		Expect(vals).To(ContainElement("K71"))
	})

	It("should hscan across multiple pages", func() {
		Expect(hashSeed(71)).NotTo(HaveOccurred())

		var vals []string
		iter := client.HScan(hashKey, 0, "", 10).Iterator()
		for iter.Next() {
			vals = append(vals, iter.Val())
		}
		Expect(iter.Err()).NotTo(HaveOccurred())
		Expect(vals).To(HaveLen(71 * 2))
		Expect(vals).To(ContainElement("K01"))
		Expect(vals).To(ContainElement("K71"))
	})

	It("should scan to page borders", func() {
		Expect(seed(20)).NotTo(HaveOccurred())

		var vals []string
		iter := client.Scan(0, "", 10).Iterator()
		for iter.Next() {
			vals = append(vals, iter.Val())
		}
		Expect(iter.Err()).NotTo(HaveOccurred())
		Expect(vals).To(HaveLen(20))
	})

	It("should scan with match", func() {
		Expect(seed(33)).NotTo(HaveOccurred())

		var vals []string
		iter := client.Scan(0, "K*2*", 10).Iterator()
		for iter.Next() {
			vals = append(vals, iter.Val())
		}
		Expect(iter.Err()).NotTo(HaveOccurred())
		Expect(vals).To(HaveLen(13))
	})

	It("should scan with match across empty pages", func() {
		Expect(extraSeed(2, 10)).NotTo(HaveOccurred())

		var vals []string
		iter := client.Scan(0, "K*", 1).Iterator()
		for iter.Next() {
			vals = append(vals, iter.Val())
		}
		Expect(iter.Err()).NotTo(HaveOccurred())
		Expect(vals).To(HaveLen(2))
	})
})
