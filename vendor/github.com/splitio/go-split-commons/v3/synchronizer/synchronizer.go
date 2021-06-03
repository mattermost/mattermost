package synchronizer

import (
	"github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/event"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/impression"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/impressionscount"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/segment"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/split"
	"github.com/splitio/go-split-commons/v3/tasks"
	"github.com/splitio/go-split-commons/v3/telemetry"
	"github.com/splitio/go-toolkit/v4/asynctask"
	"github.com/splitio/go-toolkit/v4/logging"
)

// SplitTasks struct for tasks
type SplitTasks struct {
	SplitSyncTask            *asynctask.AsyncTask
	SegmentSyncTask          *asynctask.AsyncTask
	TelemetrySyncTask        *asynctask.AsyncTask
	ImpressionSyncTask       tasks.Task
	EventSyncTask            tasks.Task
	ImpressionsCountSyncTask *asynctask.AsyncTask
}

// Workers struct for workers
type Workers struct {
	SplitFetcher             split.Updater
	SegmentFetcher           segment.Updater
	TelemetryRecorder        telemetry.TelemetrySynchronizer
	ImpressionRecorder       impression.ImpressionRecorder
	EventRecorder            event.EventRecorder
	ImpressionsCountRecorder impressionscount.ImpressionsCountRecorder
}

// SynchronizerImpl implements Synchronizer
type SynchronizerImpl struct {
	splitTasks          SplitTasks
	workers             Workers
	logger              logging.LoggerInterface
	inMememoryFullQueue chan string
	impressionBulkSize  int64
	eventBulkSize       int64
}

// NewSynchronizer creates new SynchronizerImpl
func NewSynchronizer(
	confAdvanced conf.AdvancedConfig,
	splitTasks SplitTasks,
	workers Workers,
	logger logging.LoggerInterface,
	inMememoryFullQueue chan string,
) Synchronizer {
	return &SynchronizerImpl{
		impressionBulkSize:  confAdvanced.ImpressionsBulkSize,
		eventBulkSize:       confAdvanced.EventsBulkSize,
		splitTasks:          splitTasks,
		workers:             workers,
		logger:              logger,
		inMememoryFullQueue: inMememoryFullQueue,
	}
}

func (s *SynchronizerImpl) dataFlusher() {
	for {
		msg := <-s.inMememoryFullQueue
		switch msg {
		case "EVENTS_FULL":
			s.logger.Debug("FLUSHING storage queue")
			err := s.workers.EventRecorder.SynchronizeEvents(s.eventBulkSize)
			if err != nil {
				s.logger.Error("Error flushing storage queue", err)
			}
		case "IMPRESSIONS_FULL":
			s.logger.Debug("FLUSHING storage queue")
			err := s.workers.ImpressionRecorder.SynchronizeImpressions(s.impressionBulkSize)
			if err != nil {
				s.logger.Error("Error flushing storage queue", err)
			}
		}
	}
}

// SyncAll syncs splits and segments
func (s *SynchronizerImpl) SyncAll(requestNoCache bool) error {
	_, err := s.workers.SplitFetcher.SynchronizeSplits(nil, requestNoCache)
	if err != nil {
		return err
	}
	return s.workers.SegmentFetcher.SynchronizeSegments(requestNoCache)
}

// StartPeriodicFetching starts periodic fetchers tasks
func (s *SynchronizerImpl) StartPeriodicFetching() {
	if s.splitTasks.SplitSyncTask != nil {
		s.splitTasks.SplitSyncTask.Start()
	}
	if s.splitTasks.SegmentSyncTask != nil {
		s.splitTasks.SegmentSyncTask.Start()
	}
}

// StopPeriodicFetching stops periodic fetchers tasks
func (s *SynchronizerImpl) StopPeriodicFetching() {
	if s.splitTasks.SplitSyncTask != nil {
		s.splitTasks.SplitSyncTask.Stop(false)
	}
	if s.splitTasks.SegmentSyncTask != nil {
		s.splitTasks.SegmentSyncTask.Stop(true)
	}
}

// StartPeriodicDataRecording starts periodic recorders tasks
func (s *SynchronizerImpl) StartPeriodicDataRecording() {
	if s.inMememoryFullQueue != nil {
		go s.dataFlusher()
	}

	if s.splitTasks.ImpressionSyncTask != nil {
		s.splitTasks.ImpressionSyncTask.Start()
	}
	if s.splitTasks.TelemetrySyncTask != nil {
		s.splitTasks.TelemetrySyncTask.Start()
	}
	if s.splitTasks.EventSyncTask != nil {
		s.splitTasks.EventSyncTask.Start()
	}
	if s.splitTasks.ImpressionsCountSyncTask != nil {
		s.splitTasks.ImpressionsCountSyncTask.Start()
	}
}

// StopPeriodicDataRecording stops periodic recorders tasks
func (s *SynchronizerImpl) StopPeriodicDataRecording() {
	if s.splitTasks.ImpressionSyncTask != nil {
		s.splitTasks.ImpressionSyncTask.Stop(true)
	}
	if s.splitTasks.TelemetrySyncTask != nil {
		s.splitTasks.TelemetrySyncTask.Stop(true)
	}
	if s.splitTasks.EventSyncTask != nil {
		s.splitTasks.EventSyncTask.Stop(true)
	}
	if s.splitTasks.ImpressionsCountSyncTask != nil {
		s.splitTasks.ImpressionsCountSyncTask.Stop(true)
	}
}

// SynchronizeSplits syncs splits
func (s *SynchronizerImpl) SynchronizeSplits(till *int64, requstNoCache bool) error {
	referencedSegments, err := s.workers.SplitFetcher.SynchronizeSplits(till, requstNoCache)
	for _, segment := range s.filterCachedSegments(referencedSegments) {
		go s.SynchronizeSegment(segment, nil, true) // send segment to workerpool (queue is bypassed)
	}
	return err
}

func (s *SynchronizerImpl) filterCachedSegments(segmentsReferenced []string) []string {
	toRet := make([]string, 0, len(segmentsReferenced))
	for _, name := range segmentsReferenced {
		if !s.workers.SegmentFetcher.IsSegmentCached(name) {
			toRet = append(toRet, name)
		}
	}
	return toRet
}

// LocalKill locally kills a split
func (s *SynchronizerImpl) LocalKill(splitName string, defaultTreatment string, changeNumber int64) {
	s.workers.SplitFetcher.LocalKill(splitName, defaultTreatment, changeNumber)
}

// SynchronizeSegment syncs segment
func (s *SynchronizerImpl) SynchronizeSegment(name string, till *int64, requstNoCache bool) error {
	return s.workers.SegmentFetcher.SynchronizeSegment(name, till, requstNoCache)
}

var _ Synchronizer = &SynchronizerImpl{}
