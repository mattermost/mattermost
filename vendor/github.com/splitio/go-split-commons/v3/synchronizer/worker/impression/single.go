package impression

import (
	"errors"
	"time"

	"github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/service"
	"github.com/splitio/go-split-commons/v3/storage"
	"github.com/splitio/go-split-commons/v3/telemetry"
	"github.com/splitio/go-split-commons/v3/util"
	"github.com/splitio/go-toolkit/v4/logging"
)

const (
	maxImpressionCacheSize  = 500000
	splitSDKImpressionsMode = "SplitSDKImpressionsMode"
)

// RecorderSingle struct for impression sync
type RecorderSingle struct {
	impressionStorage  storage.ImpressionStorageConsumer
	impressionRecorder service.ImpressionsRecorder
	logger             logging.LoggerInterface
	metadata           dtos.Metadata
	mode               string
	runtimeTelemetry   storage.TelemetryRuntimeProducer
}

// NewRecorderSingle creates new impression synchronizer for posting impressions
func NewRecorderSingle(
	impressionStorage storage.ImpressionStorageConsumer,
	impressionRecorder service.ImpressionsRecorder,
	logger logging.LoggerInterface,
	metadata dtos.Metadata,
	managerConfig conf.ManagerConfig,
	runtimeTelemetry storage.TelemetryRuntimeProducer,
) ImpressionRecorder {
	mode := conf.ImpressionsModeOptimized
	if !util.ShouldBeOptimized(managerConfig) {
		mode = conf.ImpressionsModeDebug
	}
	return &RecorderSingle{
		impressionStorage:  impressionStorage,
		impressionRecorder: impressionRecorder,
		logger:             logger,
		metadata:           metadata,
		mode:               mode,
		runtimeTelemetry:   runtimeTelemetry,
	}
}

// SynchronizeImpressions syncs impressions
func (i *RecorderSingle) SynchronizeImpressions(bulkSize int64) error {
	queuedImpressions, err := i.impressionStorage.PopN(bulkSize)
	if err != nil {
		i.logger.Error("Error reading impressions queue", err)
		return errors.New("Error reading impressions queue")
	}

	if len(queuedImpressions) == 0 {
		i.logger.Debug("No impressions fetched from queue. Nothing to send")
		return nil
	}

	impressionsToPost := make(map[string][]dtos.ImpressionDTO)
	for _, impression := range queuedImpressions {
		keyImpression := dtos.ImpressionDTO{
			KeyName:      impression.KeyName,
			Treatment:    impression.Treatment,
			Time:         impression.Time,
			ChangeNumber: impression.ChangeNumber,
			Label:        impression.Label,
			BucketingKey: impression.BucketingKey,
			Pt:           impression.Pt,
		}
		v, ok := impressionsToPost[impression.FeatureName]
		if ok {
			v = append(v, keyImpression)
		} else {
			v = []dtos.ImpressionDTO{keyImpression}
		}
		impressionsToPost[impression.FeatureName] = v
	}

	bulkImpressions := make([]dtos.ImpressionsDTO, 0)
	for testName, testImpressions := range impressionsToPost {
		bulkImpressions = append(bulkImpressions, dtos.ImpressionsDTO{
			TestName:       testName,
			KeyImpressions: testImpressions,
		})
	}

	before := time.Now()
	err = i.impressionRecorder.Record(bulkImpressions, i.metadata, map[string]string{splitSDKImpressionsMode: i.mode})
	if err != nil {
		if httpError, ok := err.(*dtos.HTTPError); ok {
			i.runtimeTelemetry.RecordSyncError(telemetry.ImpressionSync, httpError.Code)
		}
		return err
	}
	i.runtimeTelemetry.RecordSyncLatency(telemetry.ImpressionSync, time.Since(before).Nanoseconds())
	i.runtimeTelemetry.RecordSuccessfulSync(telemetry.ImpressionSync, time.Now().UTC().UnixNano()/int64(time.Millisecond))
	return nil
}

// FlushImpressions flushes impressions
func (i *RecorderSingle) FlushImpressions(bulkSize int64) error {
	for !i.impressionStorage.Empty() {
		err := i.SynchronizeImpressions(bulkSize)
		if err != nil {
			return err
		}
	}
	return nil
}
