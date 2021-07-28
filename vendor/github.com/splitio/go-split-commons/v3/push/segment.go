package push

import (
	"errors"
	"fmt"
	"sync/atomic"

	"github.com/splitio/go-toolkit/v4/common"
	"github.com/splitio/go-toolkit/v4/logging"
	"github.com/splitio/go-toolkit/v4/struct/traits/lifecycle"
)

// SegmentUpdateWorker struct
type SegmentUpdateWorker struct {
	segmentQueue chan SegmentChangeUpdate
	sync         synchronizerInterface
	logger       logging.LoggerInterface
	lifecycle    lifecycle.Manager
}

// NewSegmentUpdateWorker creates SegmentUpdateWorker
func NewSegmentUpdateWorker(
	segmentQueue chan SegmentChangeUpdate,
	synchronizer synchronizerInterface,
	logger logging.LoggerInterface,
) (*SegmentUpdateWorker, error) {
	if cap(segmentQueue) < 5000 {
		return nil, errors.New("")
	}
	running := atomic.Value{}
	running.Store(false)

	worker := &SegmentUpdateWorker{
		segmentQueue: segmentQueue,
		sync:         synchronizer,
		logger:       logger,
	}
	worker.lifecycle.Setup()
	return worker, nil
}

// Start starts worker
func (s *SegmentUpdateWorker) Start() {
	if !s.lifecycle.BeginInitialization() {
		s.logger.Info("Segment worker is already running")
		return
	}

	go func() {
		if !s.lifecycle.InitializationComplete() {
			return
		}
		defer s.lifecycle.ShutdownComplete()
		for {
			select {
			case segmentUpdate := <-s.segmentQueue:
				s.logger.Debug("Received Segment update and proceding to perform fetch")
				s.logger.Debug(fmt.Sprintf("SegmentName: %s\nChangeNumber: %d", segmentUpdate.SegmentName(), segmentUpdate.ChangeNumber()))
				err := s.sync.SynchronizeSegment(segmentUpdate.SegmentName(), common.Int64Ref(segmentUpdate.ChangeNumber()), true)
				if err != nil {
					s.logger.Error(err)
				}
			case <-s.lifecycle.ShutdownRequested():
				return
			}
		}
	}()
}

// Stop stops worker
func (s *SegmentUpdateWorker) Stop() {
	if !s.lifecycle.BeginShutdown() {
		s.logger.Debug("Split worker not runnning. Ignoring.")
		return
	}
	s.lifecycle.AwaitShutdownComplete()
}

// IsRunning indicates if worker is running or not
func (s *SegmentUpdateWorker) IsRunning() bool {
	return s.lifecycle.IsRunning()
}
