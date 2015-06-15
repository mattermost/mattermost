// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"gopkg.in/redis.v2"
	"strings"
	"time"
)

var client *redis.Client

func RedisClient() *redis.Client {

	if client == nil {

		addr := utils.Cfg.RedisSettings.DataSource

		client = redis.NewTCPClient(&redis.Options{
			Addr:     addr,
			Password: "",
			DB:       0,
			PoolSize: utils.Cfg.RedisSettings.MaxOpenConns,
		})

		l4g.Info("Pinging redis at '%v'", addr)
		pong, err := client.Ping().Result()

		if err != nil {
			l4g.Critical("Failed to open redis connection to '%v' err:%v", addr, err)
			time.Sleep(time.Second)
			panic("Failed to open redis connection " + err.Error())
		}

		if pong != "PONG" {
			l4g.Critical("Failed to ping redis connection to '%v' err:%v", addr, err)
			time.Sleep(time.Second)
			panic("Failed to open ping connection " + err.Error())
		}
	}

	return client
}

func RedisClose() {
	l4g.Info("Closing redis")

	if client != nil {
		client.Close()
		client = nil
	}
}

func PublishAndForget(message *model.Message) {

	go func() {
		c := RedisClient()
		result := c.Publish(message.TeamId, message.ToJson())
		if result.Err() != nil {
			l4g.Error("Failed to publish message err=%v, payload=%v", result.Err(), message.ToJson())
		}
	}()
}

func GetMessageFromPayload(m interface{}) *model.Message {
	if msg, found := m.(*redis.Message); found {
		return model.MessageFromJson(strings.NewReader(msg.Payload))
	} else {
		return nil
	}
}
