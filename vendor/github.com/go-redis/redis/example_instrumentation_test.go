package redis_test

import (
	"fmt"

	"github.com/go-redis/redis"
)

func Example_instrumentation() {
	cl := redis.NewClient(&redis.Options{
		Addr: ":6379",
	})
	cl.WrapProcess(func(old func(cmd redis.Cmder) error) func(cmd redis.Cmder) error {
		return func(cmd redis.Cmder) error {
			fmt.Printf("starting processing: <%s>\n", cmd)
			err := old(cmd)
			fmt.Printf("finished processing: <%s>\n", cmd)
			return err
		}
	})

	cl.Ping()
	// Output: starting processing: <ping: >
	// finished processing: <ping: PONG>
}

func Example_Pipeline_instrumentation() {
	client := redis.NewClient(&redis.Options{
		Addr: ":6379",
	})

	client.WrapProcessPipeline(func(old func([]redis.Cmder) error) func([]redis.Cmder) error {
		return func(cmds []redis.Cmder) error {
			fmt.Printf("pipeline starting processing: %v\n", cmds)
			err := old(cmds)
			fmt.Printf("pipeline finished processing: %v\n", cmds)
			return err
		}
	})

	client.Pipelined(func(pipe redis.Pipeliner) error {
		pipe.Ping()
		pipe.Ping()
		return nil
	})
	// Output: pipeline starting processing: [ping:  ping: ]
	// pipeline finished processing: [ping: PONG ping: PONG]
}
