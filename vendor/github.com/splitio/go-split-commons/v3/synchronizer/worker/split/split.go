package split

import (
	"time"

	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/service"
	"github.com/splitio/go-split-commons/v3/storage"
	"github.com/splitio/go-split-commons/v3/telemetry"
	"github.com/splitio/go-toolkit/v4/logging"
)

const (
	matcherTypeInSegment = "IN_SEGMENT"
)

// UpdaterImpl struct for split sync
type UpdaterImpl struct {
	splitStorage     storage.SplitStorage
	splitFetcher     service.SplitFetcher
	logger           logging.LoggerInterface
	runtimeTelemetry storage.TelemetryRuntimeProducer
}

// NewSplitFetcher creates new split synchronizer for processing split updates
func NewSplitFetcher(
	splitStorage storage.SplitStorage,
	splitFetcher service.SplitFetcher,
	logger logging.LoggerInterface,
	runtimeTelemetry storage.TelemetryRuntimeProducer,
) Updater {
	return &UpdaterImpl{
		splitStorage:     splitStorage,
		splitFetcher:     splitFetcher,
		logger:           logger,
		runtimeTelemetry: runtimeTelemetry,
	}
}

func (s *UpdaterImpl) processUpdate(splits *dtos.SplitChangesDTO) {
	inactiveSplits := make([]dtos.SplitDTO, 0)
	activeSplits := make([]dtos.SplitDTO, 0)
	for _, split := range splits.Splits {
		if split.Status == "ACTIVE" {
			activeSplits = append(activeSplits, split)
		} else {
			inactiveSplits = append(inactiveSplits, split)
		}
	}

	// Add/Update active splits
	s.splitStorage.PutMany(activeSplits, splits.Till)

	// Remove inactive splits
	for _, split := range inactiveSplits {
		s.splitStorage.Remove(split.Name)
	}
}

// SynchronizeSplits syncs splits
func (s *UpdaterImpl) SynchronizeSplits(till *int64, requestNoCache bool) ([]string, error) {
	// @TODO: add delays

	segments := make([]string, 0)
	for {
		changeNumber, _ := s.splitStorage.ChangeNumber()
		if changeNumber == 0 {
			changeNumber = -1
		}
		if till != nil && *till < changeNumber {
			return segments, nil
		}

		before := time.Now()
		splits, err := s.splitFetcher.Fetch(changeNumber, requestNoCache)
		if err != nil {
			if httpError, ok := err.(*dtos.HTTPError); ok {
				s.runtimeTelemetry.RecordSyncError(telemetry.SplitSync, httpError.Code)
			}
			return segments, err
		}
		s.runtimeTelemetry.RecordSyncLatency(telemetry.SplitSync, time.Since(before).Nanoseconds())
		s.processUpdate(splits)
		segments = append(segments, extractSegments(splits)...)
		if splits.Till == splits.Since || (till != nil && splits.Till >= *till) {
			s.runtimeTelemetry.RecordSuccessfulSync(telemetry.SplitSync, time.Now().UTC().UnixNano()/int64(time.Millisecond))
			return segments, nil
		}
	}
}

func extractSegments(splits *dtos.SplitChangesDTO) []string {
	names := make(map[string]struct{})
	for _, split := range splits.Splits {
		for _, cond := range split.Conditions {
			for _, matcher := range cond.MatcherGroup.Matchers {
				if matcher.MatcherType == matcherTypeInSegment && matcher.UserDefinedSegment != nil {
					names[matcher.UserDefinedSegment.SegmentName] = struct{}{}
				}
			}
		}
	}

	toRet := make([]string, 0, len(names))
	for name := range names {
		toRet = append(toRet, name)
	}
	return toRet
}

// LocalKill marks a spit as killed in local storage
func (s *UpdaterImpl) LocalKill(splitName string, defaultTreatment string, changeNumber int64) {
	s.splitStorage.KillLocally(splitName, defaultTreatment, changeNumber)
}
