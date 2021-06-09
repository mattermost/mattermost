package telemetry

// TelemetrySynchronizer interface
type TelemetrySynchronizer interface {
	SynchronizeConfig(cfg InitConfig, timedUntilReady int64, factoryInstances map[string]int64, tags []string)
	SynchronizeStats() error
}
