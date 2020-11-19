package segment

import (
	"fmt"
	"sync"
	"time"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/service"
	"github.com/splitio/go-split-commons/v2/storage"
	"github.com/splitio/go-split-commons/v2/util"
	"github.com/splitio/go-toolkit/v3/datastructures/set"
	"github.com/splitio/go-toolkit/v3/logging"
)

// SegmentFetcherSimple struct for segment sync
type SegmentFetcherSimple struct {
	splitStorage   storage.SplitStorageConsumer
	segmentStorage storage.SegmentStorage
	segmentFetcher service.SegmentFetcher
	metricsWrapper *storage.MetricWrapper
	logger         logging.LoggerInterface
}

// NewSegmentFetcher creates new segment synchronizer for processing segment updates
func NewSegmentFetcher(
	splitStorage storage.SplitStorage,
	segmentStorage storage.SegmentStorage,
	segmentFetcher service.SegmentFetcher,
	metricsWrapper *storage.MetricWrapper,
	logger logging.LoggerInterface,
) SegmentFetcher {
	return &SegmentFetcherSimple{
		splitStorage:   splitStorage,
		segmentStorage: segmentStorage,
		segmentFetcher: segmentFetcher,
		metricsWrapper: metricsWrapper,
		logger:         logger,
	}
}

func (s *SegmentFetcherSimple) processUpdate(segmentChanges *dtos.SegmentChangesDTO) {
	name := segmentChanges.Name
	oldSegment := s.segmentStorage.Keys(name)
	if oldSegment == nil {
		keys := set.NewSet()
		for _, key := range segmentChanges.Added {
			keys.Add(key)
		}
		s.logger.Debug(fmt.Sprintf("Segment [%s] doesn't exist now, it will add (%d) keys", name, keys.Size()))
		s.segmentStorage.Update(name, keys, set.NewSet(), segmentChanges.Till)
	} else {
		toAdd := set.NewSet()
		toRemove := set.NewSet()
		// Segment exists, must add new members and remove old ones
		for _, key := range segmentChanges.Added {
			toAdd.Add(key)
		}
		for _, key := range segmentChanges.Removed {
			toRemove.Add(key)
		}
		if toAdd.Size() > 0 || toRemove.Size() > 0 {
			s.logger.Debug(fmt.Sprintf("Segment [%s] exists, it will be updated. %d keys added, %d keys removed", name, toAdd.Size(), toRemove.Size()))
			s.segmentStorage.Update(name, toAdd, toRemove, segmentChanges.Till)
		}
	}
}

// SynchronizeSegment syncs segment
func (s *SegmentFetcherSimple) SynchronizeSegment(name string, till *int64) error {
	for {
		s.logger.Debug(fmt.Sprintf("Synchronizing segment %s", name))
		changeNumber, _ := s.segmentStorage.ChangeNumber(name)
		if changeNumber == 0 {
			changeNumber = -1
		}
		if till != nil && *till < changeNumber {
			return nil
		}

		before := time.Now()
		segmentChanges, err := s.segmentFetcher.Fetch(name, changeNumber)
		if err != nil {
			if httpError, ok := err.(*dtos.HTTPError); ok {
				s.metricsWrapper.StoreCounters(storage.SegmentChangesCounter, string(httpError.Code))
			}
			return err
		}

		s.processUpdate(segmentChanges)
		bucket := util.Bucket(time.Now().Sub(before).Nanoseconds())
		s.metricsWrapper.StoreLatencies(storage.SegmentChangesLatency, bucket)
		s.metricsWrapper.StoreCounters(storage.SegmentChangesCounter, "ok")
		if segmentChanges.Till == segmentChanges.Since || (till != nil && segmentChanges.Till >= *till) {
			return nil
		}
	}
}

// SynchronizeSegments syncs segments at once
func (s *SegmentFetcherSimple) SynchronizeSegments() error {
	// @TODO: add delays
	segmentNames := s.splitStorage.SegmentNames().List()
	s.logger.Debug("Segment Sync", segmentNames)
	wg := sync.WaitGroup{}
	wg.Add(len(segmentNames))
	failedSegments := set.NewThreadSafeSet()
	for _, name := range segmentNames {
		conv, ok := name.(string)
		if !ok {
			s.logger.Warning("Skipping non-string segment present in storage at initialization-time!")
			continue
		}
		go func(segmentName string) {
			defer wg.Done() // Make sure the "finished" signal is always sent
			ready := false
			var err error
			for !ready {
				err = s.SynchronizeSegment(segmentName, nil)
				if err != nil {
					failedSegments.Add(segmentName)
				}
				return
			}
		}(conv)
	}
	wg.Wait()

	if failedSegments.Size() > 0 {
		return fmt.Errorf("The following segments failed to be fetched %v", failedSegments.List())
	}

	return nil
}

// SegmentNames returns all segments
func (s *SegmentFetcherSimple) SegmentNames() []interface{} {
	return s.splitStorage.SegmentNames().List()
}
