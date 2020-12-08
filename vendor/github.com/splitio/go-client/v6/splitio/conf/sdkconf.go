// Package conf contains configuration structures used to setup the SDK
package conf

import (
	"errors"
	"fmt"
	"math"
	"os/user"
	"path"
	"strings"

	impressionlistener "github.com/splitio/go-client/v6/splitio/impressionListener"
	"github.com/splitio/go-split-commons/v2/conf"
	"github.com/splitio/go-toolkit/v3/datastructures/set"
	"github.com/splitio/go-toolkit/v3/logging"
	"github.com/splitio/go-toolkit/v3/nethelpers"
)

const (
	// RedisConsumer mode
	RedisConsumer = "redis-consumer"
	// Localhost mode
	Localhost = "localhost"
	// InMemoryStandAlone mode
	InMemoryStandAlone = "inmemory-standalone"
)

// SplitSdkConfig struct ...
// struct used to setup a Split.io SDK client.
//
// Parameters:
// - OperationMode (Required) Must be one of ["inmemory-standalone", "redis-consumer"]
// - InstanceName (Optional) Name to be used when submitting metrics & impressions to split servers
// - IPAddress (Optional) Address to be used when submitting metrics & impressions to split servers
// - BlockUntilReady (Optional) How much to wait until the sdk is ready
// - SplitFile (Optional) File with splits to use when running in localhost mode
// - LabelsEnabled (Optional) Can be used to disable labels if the user does not want to send that info to split servers.
// - Logger: (Optional) Custom logger complying with logging.LoggerInterface
// - LoggerConfig: (Optional) Options to setup the sdk's own logger
// - TaskPeriods: (Optional) How often should each task run
// - Redis: (Required for "redis-consumer". Sets up Redis config
// - Advanced: (Optional) Sets up various advanced options for the sdk
// - ImpressionsMode (Optional) Flag for enabling local impressions dedupe - Possible values <'optimized'|'debug'>
type SplitSdkConfig struct {
	OperationMode      string
	InstanceName       string
	IPAddress          string
	IPAddressesEnabled bool
	BlockUntilReady    int
	SplitFile          string
	LabelsEnabled      bool
	SplitSyncProxyURL  string
	Logger             logging.LoggerInterface
	LoggerConfig       logging.LoggerOptions
	TaskPeriods        TaskPeriods
	Advanced           AdvancedConfig
	Redis              conf.RedisConfig
	ImpressionsMode    string
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
// - ImpressionListener - struct that will be notified each time an impression bulk is ready
// - HTTPTimeout - Timeout for HTTP requests when doing synchronization
// - SegmentQueueSize - How many segments can be queued for updating (should be >= # segments the user has)
// - SegmentWorkers - How many workers will be used when performing segments sync.
type AdvancedConfig struct {
	ImpressionListener   impressionlistener.ImpressionListener
	HTTPTimeout          int
	SegmentQueueSize     int
	SegmentWorkers       int
	AuthServiceURL       string
	SdkURL               string
	EventsURL            string
	StreamingServiceURL  string
	EventsBulkSize       int64
	EventsQueueSize      int
	ImpressionsQueueSize int
	ImpressionsBulkSize  int64
	StreamingEnabled     bool
}

// Default returns a config struct with all the default values
func Default() *SplitSdkConfig {
	instanceName := "unknown"
	ipAddress, err := nethelpers.ExternalIP()
	if err != nil {
		ipAddress = "unknown"
	} else {
		instanceName = fmt.Sprintf("ip-%s", strings.Replace(ipAddress, ".", "-", -1))
	}

	var splitFile string
	usr, err := user.Current()
	if err != nil {
		splitFile = "splits"
	} else {
		splitFile = path.Join(usr.HomeDir, ".splits")
	}

	return &SplitSdkConfig{
		OperationMode:      InMemoryStandAlone,
		LabelsEnabled:      true,
		IPAddress:          ipAddress,
		IPAddressesEnabled: true,
		InstanceName:       instanceName,
		Logger:             nil,
		LoggerConfig:       logging.LoggerOptions{},
		SplitFile:          splitFile,
		ImpressionsMode:    conf.ImpressionsModeOptimized,
		Redis: conf.RedisConfig{
			Database: 0,
			Host:     "localhost",
			Password: "",
			Port:     6379,
			Prefix:   "",
		},
		TaskPeriods: TaskPeriods{
			GaugeSync:      defaultTaskPeriod,
			CounterSync:    defaultTaskPeriod,
			LatencySync:    defaultTaskPeriod,
			ImpressionSync: defaultImpressionSyncOptimized,
			SegmentSync:    defaultTaskPeriod,
			SplitSync:      defaultTaskPeriod,
			EventsSync:     defaultTaskPeriod,
		},
		Advanced: AdvancedConfig{
			AuthServiceURL:       "",
			EventsURL:            "",
			SdkURL:               "",
			StreamingServiceURL:  "",
			HTTPTimeout:          0,
			ImpressionListener:   nil,
			SegmentQueueSize:     500,
			SegmentWorkers:       10,
			EventsBulkSize:       5000,
			EventsQueueSize:      10000,
			ImpressionsQueueSize: 10000,
			ImpressionsBulkSize:  5000,
			StreamingEnabled:     true,
		},
	}
}

func checkImpressionSync(cfg *SplitSdkConfig) error {
	if cfg.TaskPeriods.ImpressionSync == 0 {
		cfg.TaskPeriods.ImpressionSync = defaultImpressionSyncOptimized
	} else {
		if cfg.TaskPeriods.ImpressionSync < minImpressionSyncOptimized {
			return fmt.Errorf("ImpressionSync must be >= %d. Actual is: %d", minImpressionSyncOptimized, cfg.TaskPeriods.ImpressionSync)
		}
		cfg.TaskPeriods.ImpressionSync = int(math.Max(float64(minImpressionSyncOptimized), float64(cfg.TaskPeriods.ImpressionSync)))
	}
	return nil
}

func validConfigRates(cfg *SplitSdkConfig) error {
	if cfg.OperationMode == RedisConsumer {
		return nil
	}

	if cfg.TaskPeriods.SplitSync < minSplitSync {
		return fmt.Errorf("SplitSync must be >= %d. Actual is: %d", minSplitSync, cfg.TaskPeriods.SplitSync)
	}
	if cfg.TaskPeriods.SegmentSync < minSegmentSync {
		return fmt.Errorf("SegmentSync must be >= %d. Actual is: %d", minSegmentSync, cfg.TaskPeriods.SegmentSync)
	}

	cfg.ImpressionsMode = strings.ToLower(cfg.ImpressionsMode)
	switch cfg.ImpressionsMode {
	case conf.ImpressionsModeOptimized:
		err := checkImpressionSync(cfg)
		if err != nil {
			return err
		}
	case conf.ImpressionsModeDebug:
		if cfg.TaskPeriods.ImpressionSync == 0 {
			cfg.TaskPeriods.ImpressionSync = defaultImpressionSyncDebug
		} else {
			if cfg.TaskPeriods.ImpressionSync < minImpressionSync {
				return fmt.Errorf("ImpressionSync must be >= %d. Actual is: %d", minImpressionSync, cfg.TaskPeriods.ImpressionSync)
			}
		}
	default:
		fmt.Println(`You passed an invalid impressionsMode, impressionsMode should be one of the following values: 'debug' or 'optimized'. Defaulting to 'optimized' mode.`)
		cfg.ImpressionsMode = conf.ImpressionsModeOptimized
		err := checkImpressionSync(cfg)
		if err != nil {
			return err
		}
	}

	if cfg.TaskPeriods.EventsSync < minEventSync {
		return fmt.Errorf("EventsSync must be >= %d. Actual is: %d", minEventSync, cfg.TaskPeriods.EventsSync)
	}
	if cfg.TaskPeriods.LatencySync < minTelemetrySync {
		return fmt.Errorf("LatencySync must be >= %d. Actual is: %d", minTelemetrySync, cfg.TaskPeriods.LatencySync)
	}
	if cfg.TaskPeriods.GaugeSync < minTelemetrySync {
		return fmt.Errorf("GaugeSync must be >= %d. Actual is: %d", minTelemetrySync, cfg.TaskPeriods.GaugeSync)
	}
	if cfg.TaskPeriods.CounterSync < minTelemetrySync {
		return fmt.Errorf("CounterSync must be >= %d. Actual is: %d", minTelemetrySync, cfg.TaskPeriods.CounterSync)
	}
	if cfg.Advanced.SegmentWorkers <= 0 {
		return errors.New("Number of workers for fetching segments MUST be greater than zero")
	}
	return nil
}

// Normalize checks that the parameters passed by the user are correct and updates parameters if necessary.
// returns an error if something is wrong
func Normalize(apikey string, cfg *SplitSdkConfig) error {
	// Fail if no apikey is provided
	if apikey == "" && cfg.OperationMode != Localhost {
		return errors.New("Factory instantiation: you passed an empty apikey, apikey must be a non-empty string")
	}

	// To keep the interface consistent with other sdks we accept "localhost" as an apikey,
	// which sets the operation mode to localhost
	if apikey == Localhost {
		cfg.OperationMode = Localhost
	}

	// Fail if an invalid operation-mode is provided
	operationModes := set.NewSet(
		Localhost,
		InMemoryStandAlone,
		RedisConsumer,
	)

	if !operationModes.Has(cfg.OperationMode) {
		return fmt.Errorf("OperationMode parameter must be one of: %v", operationModes.List())
	}

	if cfg.SplitSyncProxyURL != "" {
		cfg.Advanced.AuthServiceURL = cfg.SplitSyncProxyURL
		cfg.Advanced.SdkURL = cfg.SplitSyncProxyURL
		cfg.Advanced.EventsURL = cfg.SplitSyncProxyURL
		cfg.Advanced.StreamingServiceURL = cfg.SplitSyncProxyURL
	}

	if !cfg.IPAddressesEnabled {
		cfg.IPAddress = "NA"
		cfg.InstanceName = "NA"
	}

	return validConfigRates(cfg)
}
