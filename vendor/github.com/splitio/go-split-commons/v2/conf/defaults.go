package conf

const (
	defaultHTTPTimeout            = 30
	defaultSegmentQueueSize       = 500
	defaultSegmentWorkers         = 10
	defaultEventsBulkSize         = 5000
	defaultEventsQueueSize        = 10000
	defaultImpressionsQueueSize   = 10000
	defaultImpressionsBulkSize    = 5000
	defaultStreamingEnabled       = true
	defaultSplitUpdateQueueSize   = 5000
	defaultSegmentUpdateQueueSize = 5000
	defaultAuthServiceURL         = "https://auth.split.io"
	defaultEventsURL              = "https://events.split.io/api"
	defaultSdkURL                 = "https://sdk.split.io/api"
	defaultStreamingServiceURL    = "https://streaming.split.io/sse"
)

const (
	// ImpressionsModeOptimized will avoid sending duplicated events
	ImpressionsModeOptimized = "optimized"
	// ImpressionsModeDebug will send all the impressions generated
	ImpressionsModeDebug = "debug"
)

const (
	// Standalone mode
	Standalone = "inmemory-standalone"
	// ProducerSync mode
	ProducerSync = "producer-sync"
)

// GetDefaultAdvancedConfig returns default conf
func GetDefaultAdvancedConfig() AdvancedConfig {
	return AdvancedConfig{
		EventsQueueSize:        defaultEventsQueueSize,
		HTTPTimeout:            defaultHTTPTimeout,
		EventsBulkSize:         defaultEventsBulkSize,
		ImpressionsBulkSize:    defaultImpressionsBulkSize,
		ImpressionsQueueSize:   defaultImpressionsQueueSize,
		SegmentQueueSize:       defaultSegmentQueueSize,
		SegmentUpdateQueueSize: defaultSegmentUpdateQueueSize,
		SegmentWorkers:         defaultSegmentWorkers,
		SplitUpdateQueueSize:   defaultSplitUpdateQueueSize,
		StreamingEnabled:       defaultStreamingEnabled,
		AuthServiceURL:         defaultAuthServiceURL,
		EventsURL:              defaultEventsURL,
		SdkURL:                 defaultSdkURL,
		StreamingServiceURL:    defaultStreamingServiceURL,
	}
}
