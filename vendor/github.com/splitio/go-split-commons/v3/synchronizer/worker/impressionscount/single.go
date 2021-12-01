package impressionscount

import (
	"time"

	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/provisional"
	"github.com/splitio/go-split-commons/v3/service"
	"github.com/splitio/go-split-commons/v3/storage"
	"github.com/splitio/go-split-commons/v3/telemetry"
	"github.com/splitio/go-toolkit/v4/logging"
)

// RecorderSingle struct for impressionsCount sync
type RecorderSingle struct {
	impressionsCounter *provisional.ImpressionsCounter
	impressionRecorder service.ImpressionsRecorder
	metadata           dtos.Metadata
	logger             logging.LoggerInterface
	runtimeTelemetry   storage.TelemetryRuntimeProducer
}

// NewRecorderSingle creates new impressionsCount synchronizer for posting impressionsCount
func NewRecorderSingle(
	impressionsCounter *provisional.ImpressionsCounter,
	impressionRecorder service.ImpressionsRecorder,
	metadata dtos.Metadata,
	logger logging.LoggerInterface,
	runtimeTelemetry storage.TelemetryRuntimeProducer,
) ImpressionsCountRecorder {
	return &RecorderSingle{
		impressionsCounter: impressionsCounter,
		impressionRecorder: impressionRecorder,
		metadata:           metadata,
		logger:             logger,
		runtimeTelemetry:   runtimeTelemetry,
	}
}

// SynchronizeImpressionsCount syncs imp counts
func (m *RecorderSingle) SynchronizeImpressionsCount() error {
	impressionsCount := m.impressionsCounter.PopAll()

	impressionsInTimeFrame := make([]dtos.ImpressionsInTimeFrameDTO, 0)
	for key, count := range impressionsCount {
		impressionInTimeFrame := dtos.ImpressionsInTimeFrameDTO{
			FeatureName: key.FeatureName,
			RawCount:    count,
			TimeFrame:   key.TimeFrame,
		}
		impressionsInTimeFrame = append(impressionsInTimeFrame, impressionInTimeFrame)
	}

	pf := dtos.ImpressionsCountDTO{
		PerFeature: impressionsInTimeFrame,
	}

	before := time.Now()
	err := m.impressionRecorder.RecordImpressionsCount(pf, m.metadata)
	if err != nil {
		if httpError, ok := err.(*dtos.HTTPError); ok {
			m.runtimeTelemetry.RecordSyncError(telemetry.ImpressionCountSync, httpError.Code)
		}
		return err
	}
	m.runtimeTelemetry.RecordSyncLatency(telemetry.ImpressionCountSync, time.Since(before).Nanoseconds())
	m.runtimeTelemetry.RecordSuccessfulSync(telemetry.ImpressionCountSync, time.Now().UTC().UnixNano()/int64(time.Millisecond))
	return nil
}
