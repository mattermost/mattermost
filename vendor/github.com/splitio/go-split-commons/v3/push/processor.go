package push

import (
	"errors"
	"fmt"

	"github.com/splitio/go-toolkit/v4/logging"
)

const (
	splitQueueMinSize   = 5000
	segmentQueueMinSize = 5000
)

// Processor provides the interface for an update-message processor
type Processor interface {
	ProcessSplitChangeUpdate(update *SplitChangeUpdate) error
	ProcessSplitKillUpdate(update *SplitKillUpdate) error
	ProcessSegmentChangeUpdate(update *SegmentChangeUpdate) error
	StartWorkers()
	StopWorkers()
}

// ProcessorImpl struct for notification processor
type ProcessorImpl struct {
	segmentQueue  chan SegmentChangeUpdate
	splitQueue    chan SplitChangeUpdate
	splitWorker   *SplitUpdateWorker
	segmentWorker *SegmentUpdateWorker
	synchronizer  synchronizerInterface
	logger        logging.LoggerInterface
}

// NewProcessor creates new processor
func NewProcessor(
	splitQueueSize int64,
	segmentQueueSize int64,
	synchronizer synchronizerInterface,
	logger logging.LoggerInterface,
) (*ProcessorImpl, error) {
	if segmentQueueSize < segmentQueueMinSize {
		return nil, errors.New("Small size of segmentQueue")
	}
	if splitQueueSize < splitQueueMinSize {
		return nil, errors.New("Small size of splitQueue")
	}

	splitQueue := make(chan SplitChangeUpdate, splitQueueSize)
	splitWorker, err := NewSplitUpdateWorker(splitQueue, synchronizer, logger)
	if err != nil {
		return nil, fmt.Errorf("error instantiating split worker: %w", err)
	}

	segmentQueue := make(chan SegmentChangeUpdate, segmentQueueSize)
	segmentWorker, err := NewSegmentUpdateWorker(segmentQueue, synchronizer, logger)
	if err != nil {
		return nil, fmt.Errorf("error instantiating split worker: %w", err)
	}

	return &ProcessorImpl{
		splitQueue:    splitQueue,
		splitWorker:   splitWorker,
		segmentQueue:  segmentQueue,
		segmentWorker: segmentWorker,
		synchronizer:  synchronizer,
		logger:        logger,
	}, nil
}

// ProcessSplitChangeUpdate accepts a split change notifications and schedules a fetch
func (p *ProcessorImpl) ProcessSplitChangeUpdate(update *SplitChangeUpdate) error {
	if update == nil {
		return errors.New("split change update cannot be nil")
	}
	p.splitQueue <- *update
	return nil
}

// ProcessSplitKillUpdate accepts a split kill notification, issues a local kill and schedules a fetch
func (p *ProcessorImpl) ProcessSplitKillUpdate(update *SplitKillUpdate) error {
	if update == nil {
		return errors.New("split change update cannot be nil")
	}
	p.synchronizer.LocalKill(update.SplitName(), update.DefaultTreatment(), update.ChangeNumber())
	return p.ProcessSplitChangeUpdate(update.ToSplitChangeUpdate())
}

// ProcessSegmentChangeUpdate accepts a segment change notification and schedules a fetch
func (p *ProcessorImpl) ProcessSegmentChangeUpdate(update *SegmentChangeUpdate) error {
	if update == nil {
		return errors.New("split change update cannot be nil")
	}
	p.segmentQueue <- *update
	return nil
}

// StartWorkers enables split & segments workers
func (p *ProcessorImpl) StartWorkers() {
	p.splitWorker.Start()
	p.segmentWorker.Start()
}

// StopWorkers pauses split & segments workers
func (p *ProcessorImpl) StopWorkers() {
	p.splitWorker.Stop()
	p.segmentWorker.Stop()
}
