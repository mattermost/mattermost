package conf

const (
	defaultHTTPTimeout             = 30
	defaultTaskPeriod              = 60
	defaultRedisHost               = "localhost"
	defaultRedisPort               = 6379
	defaultRedisDb                 = 0
	defaultSegmentQueueSize        = 500
	defaultSegmentWorkers          = 10
	defaultImpressionSyncOptimized = 300
	defaultImpressionSyncDebug     = 60
)

const (
	minSplitSync               = 5
	minSegmentSync             = 30
	minImpressionSync          = 1
	minImpressionSyncOptimized = 60
	minEventSync               = 1
	minTelemetrySync           = 30
)
