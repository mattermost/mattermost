package telemetry

import (
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/storage"
	"github.com/splitio/go-toolkit/v4/logging"
)

type SynchronizerRedis struct {
	storage storage.TelemetryConfigProducer
	logger  logging.LoggerInterface
}

func NewSynchronizerRedis(storage storage.TelemetryConfigProducer, logger logging.LoggerInterface) TelemetrySynchronizer {
	return &SynchronizerRedis{
		storage: storage,
		logger:  logger,
	}
}

func (r *SynchronizerRedis) SynchronizeStats() error {
	// No-Op. Not required for redis. This will be implemented by Synchronizer.
	return nil
}

func (r *SynchronizerRedis) SynchronizeConfig(cfg InitConfig, timedUntilReady int64, factoryInstances map[string]int64, tags []string) {
	err := r.storage.RecordConfigData(dtos.Config{
		OperationMode:      Consumer,
		Storage:            Redis,
		ActiveFactories:    int64(len(factoryInstances)),
		RedundantFactories: getRedudantActiveFactories(factoryInstances),
		Tags:               tags,
	})
	if err != nil {
		r.logger.Error("Could not log config data", err.Error())
	}
}
