package redis

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/splitio/go-split-commons/v2/conf"
	"github.com/splitio/go-toolkit/v3/logging"
	"github.com/splitio/go-toolkit/v3/redis"
	"github.com/splitio/go-toolkit/v3/redis/helpers"
)

// NewRedisClient returns a new Prefixed Redis Client
func NewRedisClient(config *conf.RedisConfig, logger logging.LoggerInterface) (*redis.PrefixedRedisClient, error) {
	prefix := config.Prefix

	if len(config.SentinelAddresses) > 0 && len(config.ClusterNodes) > 0 {
		return nil, errors.New("Incompatible configuration of redis, Sentinel and Cluster cannot be enabled at the same time")
	}

	universalOptions := &redis.UniversalOptions{
		Password:     config.Password,
		DB:           config.Database,
		TLSConfig:    config.TLSConfig,
		MaxRetries:   config.MaxRetries,
		PoolSize:     config.PoolSize,
		DialTimeout:  time.Duration(config.DialTimeout) * time.Second,
		ReadTimeout:  time.Duration(config.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(config.WriteTimeout) * time.Second,
	}

	if len(config.SentinelAddresses) > 0 {
		logger.Info("To start as Sentinel Mode")
		if config.SentinelMaster == "" {
			return nil, errors.New("Missing redis sentinel master name")
		}

		universalOptions.MasterName = config.SentinelMaster
		universalOptions.Addrs = config.SentinelAddresses
	} else {
		if len(config.ClusterNodes) > 0 {
			logger.Info("To start as Cluster Mode")
			var keyHashTag = "{SPLITIO}"

			if config.ClusterKeyHashTag != "" {
				keyHashTag = config.ClusterKeyHashTag
				if len(keyHashTag) < 3 ||
					string(keyHashTag[0]) != "{" ||
					string(keyHashTag[len(keyHashTag)-1]) != "}" ||
					strings.Count(keyHashTag, "{") != 1 ||
					strings.Count(keyHashTag, "}") != 1 {
					return nil, errors.New("keyHashTag is not valid")
				}
			}

			prefix = keyHashTag + prefix
			universalOptions.Addrs = config.ClusterNodes
		} else {
			logger.Info("To start as Single Mode")
			universalOptions.Addrs = []string{fmt.Sprintf("%s:%d", config.Host, config.Port)}
		}
	}

	rClient, err := redis.NewClient(universalOptions)

	if err != nil {
		logger.Error(err.Error())
	}
	helpers.EnsureConnected(rClient)

	return redis.NewPrefixedRedisClient(rClient, prefix)
}
