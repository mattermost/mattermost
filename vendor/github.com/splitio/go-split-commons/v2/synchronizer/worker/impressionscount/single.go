package impressionscount

import (
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/provisional"
	"github.com/splitio/go-split-commons/v2/service"
	"github.com/splitio/go-toolkit/v3/logging"
)

// RecorderSingle struct for impressionsCount sync
type RecorderSingle struct {
	impressionsCounter *provisional.ImpressionsCounter
	impressionRecorder service.ImpressionsRecorder
	metadata           dtos.Metadata
	logger             logging.LoggerInterface
}

// NewRecorderSingle creates new impressionsCount synchronizer for posting impressionsCount
func NewRecorderSingle(
	impressionsCounter *provisional.ImpressionsCounter,
	impressionRecorder service.ImpressionsRecorder,
	metadata dtos.Metadata,
	logger logging.LoggerInterface,
) ImpressionsCountRecorder {
	return &RecorderSingle{
		impressionsCounter: impressionsCounter,
		impressionRecorder: impressionRecorder,
		metadata:           metadata,
		logger:             logger,
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
	return m.impressionRecorder.RecordImpressionsCount(pf, m.metadata)
}
