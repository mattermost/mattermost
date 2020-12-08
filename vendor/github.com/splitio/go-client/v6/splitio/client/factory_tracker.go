package client

import (
	"fmt"
	"sync"

	"github.com/splitio/go-client/v6/splitio/conf"
	"github.com/splitio/go-toolkit/v3/logging"
)

// factoryInstances factory tracker instantiations
var factoryInstances = make(map[string]int64)
var mutex = &sync.Mutex{}

func setFactory(apikey string, logger logging.LoggerInterface) {
	mutex.Lock()
	defer mutex.Unlock()

	counter, exists := factoryInstances[apikey]
	if !exists {
		if len(factoryInstances) > 0 {
			logger.Warning("Factory Instantiation: You already have an instance of the Split factory. Make sure you definitely want " +
				"this additional instance. We recommend keeping only one instance of the factory at all times (Singleton pattern) and " +
				"reusing it throughout your application.")
		}
		factoryInstances[apikey] = 1
	} else {
		if counter == 1 {
			logger.Warning("Factory Instantiation: You already have 1 factory with this API Key. We recommend keeping only one instance of the factory " +
				"at all times (Singleton pattern) and reusing it throughout your application.")
		} else {
			logger.Warning(fmt.Sprintf("Factory Instantiation: You already have %d factories with this API Key.", counter) +
				" We recommend keeping only one instance of the factory at all times (Singleton pattern) and reusing it throughout your application.")
		}
		factoryInstances[apikey]++
	}
}

// removeInstanceFromTracker decrease the instance of factory track
func removeInstanceFromTracker(apikey string) {
	mutex.Lock()
	defer mutex.Unlock()

	counter, exists := factoryInstances[apikey]
	if exists {
		if counter == 1 {
			delete(factoryInstances, apikey)
		} else {
			factoryInstances[apikey]--
		}
	}
}

// NewSplitFactory instantiates a new SplitFactory object. Accepts a SplitSdkConfig struct as an argument,
// which will be used to instantiate both the client and the manager
func NewSplitFactory(apikey string, cfg *conf.SplitSdkConfig) (*SplitFactory, error) {
	if cfg == nil {
		cfg = conf.Default()
	}

	logger := setupLogger(cfg)

	err := conf.Normalize(apikey, cfg)
	if err != nil {
		logger.Error(err.Error())
		return nil, err
	}

	splitFactory, err := newFactory(apikey, cfg, logger)
	setFactory(apikey, logger)
	return splitFactory, err
}
