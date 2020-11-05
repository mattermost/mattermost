package push

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/logging"
)

// SegmentUpdateWorker struct
type SegmentUpdateWorker struct {
	activeGoroutines *sync.WaitGroup
	segmentQueue     chan dtos.SegmentChangeNotification
	handler          func(segmentName string, till *int64) error
	logger           logging.LoggerInterface
	stop             chan struct{}
	running          atomic.Value
}

// NewSegmentUpdateWorker creates SegmentUpdateWorker
func NewSegmentUpdateWorker(segmentQueue chan dtos.SegmentChangeNotification, handler func(segmentName string, till *int64) error, logger logging.LoggerInterface) (*SegmentUpdateWorker, error) {
	if cap(segmentQueue) < 5000 {
		return nil, errors.New("")
	}
	running := atomic.Value{}
	running.Store(false)

	return &SegmentUpdateWorker{
		segmentQueue: segmentQueue,
		handler:      handler,
		logger:       logger,
		stop:         make(chan struct{}, 1),
		running:      running,
	}, nil
}

// Start starts worker
func (s *SegmentUpdateWorker) Start() {
	s.logger.Debug("Started SegmentUpdateWorker")
	if s.IsRunning() {
		s.logger.Debug("Segment worker is already running")
		return
	}
	s.running.Store(true)
	go func() {
		for {
			select {
			case segmentUpdate := <-s.segmentQueue:
				s.logger.Debug("Received Segment update and proceding to perform fetch")
				s.logger.Debug(fmt.Sprintf("SegmentName: %s\nChangeNumber: %d", segmentUpdate.SegmentName, &segmentUpdate.ChangeNumber))
				err := s.handler(segmentUpdate.SegmentName, &segmentUpdate.ChangeNumber)
				if err != nil {
					s.logger.Error(err)
				}
			case <-s.stop:
				return
			}
		}
	}()
}

// Stop stops worker
func (s *SegmentUpdateWorker) Stop() {
	if s.IsRunning() {
		s.stop <- struct{}{}
		s.running.Store(false)
	}
}

// IsRunning indicates if worker is running or not
func (s *SegmentUpdateWorker) IsRunning() bool {
	return s.running.Load().(bool)
}
