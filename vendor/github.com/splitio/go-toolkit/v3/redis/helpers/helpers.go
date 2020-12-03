package helpers

import (
	"fmt"

	"github.com/splitio/go-toolkit/v3/redis"
)

const (
	pong = "PONG"
)

// EnsureConnected pings redis
func EnsureConnected(client redis.Client) {
	res := client.Ping()
	if res.Err() != nil {
		panic(fmt.Sprintf("Couldn't connect to redis: %s", res.Err()))
	}

	if res.String() != pong {
		panic(fmt.Sprintf("Invalid redis ping response when connecting: %s", res.String()))
	}
}
