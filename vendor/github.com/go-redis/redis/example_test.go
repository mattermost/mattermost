package redis_test

import (
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/go-redis/redis"
)

var client *redis.Client

func init() {
	client = redis.NewClient(&redis.Options{
		Addr:         ":6379",
		DialTimeout:  10 * time.Second,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		PoolSize:     10,
		PoolTimeout:  30 * time.Second,
	})
	client.FlushDB()
}

func ExampleNewClient() {
	client := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	pong, err := client.Ping().Result()
	fmt.Println(pong, err)
	// Output: PONG <nil>
}

func ExampleParseURL() {
	opt, err := redis.ParseURL("redis://:qwerty@localhost:6379/1")
	if err != nil {
		panic(err)
	}
	fmt.Println("addr is", opt.Addr)
	fmt.Println("db is", opt.DB)
	fmt.Println("password is", opt.Password)

	// Create client as usually.
	_ = redis.NewClient(opt)

	// Output: addr is localhost:6379
	// db is 1
	// password is qwerty
}

func ExampleNewFailoverClient() {
	// See http://redis.io/topics/sentinel for instructions how to
	// setup Redis Sentinel.
	client := redis.NewFailoverClient(&redis.FailoverOptions{
		MasterName:    "master",
		SentinelAddrs: []string{":26379"},
	})
	client.Ping()
}

func ExampleNewClusterClient() {
	// See http://redis.io/topics/cluster-tutorial for instructions
	// how to setup Redis Cluster.
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs: []string{":7000", ":7001", ":7002", ":7003", ":7004", ":7005"},
	})
	client.Ping()
}

func ExampleNewRing() {
	client := redis.NewRing(&redis.RingOptions{
		Addrs: map[string]string{
			"shard1": ":7000",
			"shard2": ":7001",
			"shard3": ":7002",
		},
	})
	client.Ping()
}

func ExampleClient() {
	err := client.Set("key", "value", 0).Err()
	if err != nil {
		panic(err)
	}

	val, err := client.Get("key").Result()
	if err != nil {
		panic(err)
	}
	fmt.Println("key", val)

	val2, err := client.Get("key2").Result()
	if err == redis.Nil {
		fmt.Println("key2 does not exists")
	} else if err != nil {
		panic(err)
	} else {
		fmt.Println("key2", val2)
	}
	// Output: key value
	// key2 does not exists
}

func ExampleClient_Set() {
	// Last argument is expiration. Zero means the key has no
	// expiration time.
	err := client.Set("key", "value", 0).Err()
	if err != nil {
		panic(err)
	}

	// key2 will expire in an hour.
	err = client.Set("key2", "value", time.Hour).Err()
	if err != nil {
		panic(err)
	}
}

func ExampleClient_Incr() {
	result, err := client.Incr("counter").Result()
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output: 1
}

func ExampleClient_BLPop() {
	if err := client.RPush("queue", "message").Err(); err != nil {
		panic(err)
	}

	// use `client.BLPop(0, "queue")` for infinite waiting time
	result, err := client.BLPop(1*time.Second, "queue").Result()
	if err != nil {
		panic(err)
	}

	fmt.Println(result[0], result[1])
	// Output: queue message
}

func ExampleClient_Scan() {
	client.FlushDB()
	for i := 0; i < 33; i++ {
		err := client.Set(fmt.Sprintf("key%d", i), "value", 0).Err()
		if err != nil {
			panic(err)
		}
	}

	var cursor uint64
	var n int
	for {
		var keys []string
		var err error
		keys, cursor, err = client.Scan(cursor, "", 10).Result()
		if err != nil {
			panic(err)
		}
		n += len(keys)
		if cursor == 0 {
			break
		}
	}

	fmt.Printf("found %d keys\n", n)
	// Output: found 33 keys
}

func ExampleClient_Pipelined() {
	var incr *redis.IntCmd
	_, err := client.Pipelined(func(pipe redis.Pipeliner) error {
		incr = pipe.Incr("pipelined_counter")
		pipe.Expire("pipelined_counter", time.Hour)
		return nil
	})
	fmt.Println(incr.Val(), err)
	// Output: 1 <nil>
}

func ExampleClient_Pipeline() {
	pipe := client.Pipeline()

	incr := pipe.Incr("pipeline_counter")
	pipe.Expire("pipeline_counter", time.Hour)

	// Execute
	//
	//     INCR pipeline_counter
	//     EXPIRE pipeline_counts 3600
	//
	// using one client-server roundtrip.
	_, err := pipe.Exec()
	fmt.Println(incr.Val(), err)
	// Output: 1 <nil>
}

func ExampleClient_TxPipelined() {
	var incr *redis.IntCmd
	_, err := client.TxPipelined(func(pipe redis.Pipeliner) error {
		incr = pipe.Incr("tx_pipelined_counter")
		pipe.Expire("tx_pipelined_counter", time.Hour)
		return nil
	})
	fmt.Println(incr.Val(), err)
	// Output: 1 <nil>
}

func ExampleClient_TxPipeline() {
	pipe := client.TxPipeline()

	incr := pipe.Incr("tx_pipeline_counter")
	pipe.Expire("tx_pipeline_counter", time.Hour)

	// Execute
	//
	//     MULTI
	//     INCR pipeline_counter
	//     EXPIRE pipeline_counts 3600
	//     EXEC
	//
	// using one client-server roundtrip.
	_, err := pipe.Exec()
	fmt.Println(incr.Val(), err)
	// Output: 1 <nil>
}

func ExampleClient_Watch() {
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
			defer wg.Done()

			err := incr("counter3")
			if err != nil {
				panic(err)
			}
		}()
	}
	wg.Wait()

	n, err := client.Get("counter3").Int64()
	fmt.Println(n, err)
	// Output: 100 <nil>
}

func ExamplePubSub() {
	pubsub := client.Subscribe("mychannel1")
	defer pubsub.Close()

	// Wait for subscription to be created before publishing message.
	subscr, err := pubsub.ReceiveTimeout(time.Second)
	if err != nil {
		panic(err)
	}
	fmt.Println(subscr)

	err = client.Publish("mychannel1", "hello").Err()
	if err != nil {
		panic(err)
	}

	msg, err := pubsub.ReceiveMessage()
	if err != nil {
		panic(err)
	}

	fmt.Println(msg.Channel, msg.Payload)
	// Output: subscribe: mychannel1
	// mychannel1 hello
}

func ExamplePubSub_Receive() {
	pubsub := client.Subscribe("mychannel2")
	defer pubsub.Close()

	for i := 0; i < 2; i++ {
		// ReceiveTimeout is a low level API. Use ReceiveMessage instead.
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		if err != nil {
			break
		}

		switch msg := msgi.(type) {
		case *redis.Subscription:
			fmt.Println("subscribed to", msg.Channel)

			_, err := client.Publish("mychannel2", "hello").Result()
			if err != nil {
				panic(err)
			}
		case *redis.Message:
			fmt.Println("received", msg.Payload, "from", msg.Channel)
		default:
			panic("unreached")
		}
	}

	// sent message to 1 client
	// received hello from mychannel2
}

func ExampleScript() {
	IncrByXX := redis.NewScript(`
		if redis.call("GET", KEYS[1]) ~= false then
			return redis.call("INCRBY", KEYS[1], ARGV[1])
		end
		return false
	`)

	n, err := IncrByXX.Run(client, []string{"xx_counter"}, 2).Result()
	fmt.Println(n, err)

	err = client.Set("xx_counter", "40", 0).Err()
	if err != nil {
		panic(err)
	}

	n, err = IncrByXX.Run(client, []string{"xx_counter"}, 2).Result()
	fmt.Println(n, err)

	// Output: <nil> redis: nil
	// 42 <nil>
}

func Example_customCommand() {
	Get := func(client *redis.Client, key string) *redis.StringCmd {
		cmd := redis.NewStringCmd("get", key)
		client.Process(cmd)
		return cmd
	}

	v, err := Get(client, "key_does_not_exist").Result()
	fmt.Printf("%q %s", v, err)
	// Output: "" redis: nil
}

func ExampleScanIterator() {
	iter := client.Scan(0, "", 0).Iterator()
	for iter.Next() {
		fmt.Println(iter.Val())
	}
	if err := iter.Err(); err != nil {
		panic(err)
	}
}

func ExampleScanCmd_Iterator() {
	iter := client.Scan(0, "", 0).Iterator()
	for iter.Next() {
		fmt.Println(iter.Val())
	}
	if err := iter.Err(); err != nil {
		panic(err)
	}
}

func ExampleNewUniversalClient_simple() {
	client := redis.NewUniversalClient(&redis.UniversalOptions{
		Addrs: []string{":6379"},
	})
	defer client.Close()

	client.Ping()
}

func ExampleNewUniversalClient_failover() {
	client := redis.NewUniversalClient(&redis.UniversalOptions{
		MasterName: "master",
		Addrs:      []string{":26379"},
	})
	defer client.Close()

	client.Ping()
}

func ExampleNewUniversalClient_cluster() {
	client := redis.NewUniversalClient(&redis.UniversalOptions{
		Addrs: []string{":7000", ":7001", ":7002", ":7003", ":7004", ":7005"},
	})
	defer client.Close()

	client.Ping()
}
