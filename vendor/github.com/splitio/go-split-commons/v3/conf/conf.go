package conf

import (
	"crypto/tls"
)

// RedisConfig struct is used to cofigure the redis parameters
type RedisConfig struct {
	Host     string
	Port     int
	Database int
	Password string
	Prefix   string

	// The network type, either tcp or unix.
	// Default is tcp.
	Network string

	// Maximum number of retries before giving up.
	// Default is to not retry failed commands.
	MaxRetries int

	// Dial timeout for establishing new connections.
	// Default is 5 seconds.
	DialTimeout int

	// Timeout for socket reads. If reached, commands will fail
	// with a timeout instead of blocking.
	// Default is 10 seconds.
	ReadTimeout int

	// Timeout for socket writes. If reached, commands will fail
	// with a timeout instead of blocking.
	// Default is 3 seconds.
	WriteTimeout int

	// Maximum number of socket connections.
	// Default is 10 connections.
	PoolSize int

	// Redis sentinel replication support
	SentinelAddresses []string
	SentinelMaster    string

	// Redis cluster replication support
	ClusterNodes      []string
	ClusterKeyHashTag string

	TLSConfig *tls.Config
}

// TaskPeriods struct is used to configure the period for each synchronization task
type TaskPeriods struct {
	SplitSync      int
	SegmentSync    int
	ImpressionSync int
	GaugeSync      int
	CounterSync    int
	LatencySync    int
	EventsSync     int
}

// AdvancedConfig exposes more configurable parameters that can be used to further tailor the sdk to the user's needs
// - HTTPTimeout - Timeout for HTTP requests when doing synchronization
// - SegmentQueueSize - How many segments can be queued for updating (should be >= # segments the user has)
// - SegmentWorkers - How many workers will be used when performing segments sync.
type AdvancedConfig struct {
	HTTPTimeout            int
	SegmentQueueSize       int
	SegmentWorkers         int
	SdkURL                 string
	EventsURL              string
	EventsBulkSize         int64
	EventsQueueSize        int
	ImpressionsQueueSize   int
	ImpressionsBulkSize    int64
	StreamingEnabled       bool
	AuthServiceURL         string
	StreamingServiceURL    string
	SplitUpdateQueueSize   int64
	SegmentUpdateQueueSize int64
}

// ManagerConfig exposes configurable parameters for ImpressionManager
type ManagerConfig struct {
	OperationMode   string
	ImpressionsMode string
	ListenerEnabled bool
}
