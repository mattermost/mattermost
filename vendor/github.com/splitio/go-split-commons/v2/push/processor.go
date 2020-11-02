package push

import (
	"errors"
	"fmt"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/storage"
	"github.com/splitio/go-toolkit/v3/logging"
)

const (
	segmentQueueCheck     = 5000
	splitQueueCheck       = 5000
	streamingPausedType   = "STREAMING_PAUSED"
	streamingResumedType  = "STREAMING_RESUMED"
	streamingDisabledType = "STREAMING_DISABLED"
)

const (
	// StreamingPaused The SDK should stop processing incoming UPDATE-type events
	streamingPaused = iota
	// StreamingResumed The SDK should resume processing UPDATE-type events (if not already)
	streamingResumed
	// StreamingDisabled The SDK should disable streaming completely and don’t try to reconnect until the SDK is re-instantiated
	streamingDisabled
)

// Processor struct for notification processor
type Processor struct {
	segmentQueue  chan dtos.SegmentChangeNotification
	splitQueue    chan dtos.SplitChangeNotification
	splitStorage  storage.SplitStorageProducer
	controlStatus chan<- int
	logger        logging.LoggerInterface
}

// NewProcessor creates new processor
func NewProcessor(segmentQueue chan dtos.SegmentChangeNotification, splitQueue chan dtos.SplitChangeNotification, splitStorage storage.SplitStorageProducer, logger logging.LoggerInterface, controlStatus chan int) (*Processor, error) {
	if cap(segmentQueue) < segmentQueueCheck {
		return nil, errors.New("Small size of segmentQueue")
	}
	if cap(splitQueue) < splitQueueCheck {
		return nil, errors.New("Small size of splitQueue")
	}
	if cap(controlStatus) < 1 {
		return nil, errors.New("Small size for control chan")
	}

	return &Processor{
		segmentQueue:  segmentQueue,
		splitQueue:    splitQueue,
		splitStorage:  splitStorage,
		controlStatus: controlStatus,
		logger:        logger,
	}, nil
}

// Process takes an incoming notification and generates appropriate notifications for it.
func (p *Processor) Process(i dtos.IncomingNotification) error {
	switch i.Type {
	case dtos.SplitUpdate:
		if i.ChangeNumber == nil {
			return errors.New("ChangeNumber could not be nil, discarded")
		}
		splitUpdate := dtos.NewSplitChangeNotification(i.Channel, *i.ChangeNumber)
		p.splitQueue <- splitUpdate
	case dtos.SegmentUpdate:
		if i.ChangeNumber == nil {
			return errors.New("ChangeNumber could not be nil, discarded")
		}
		if i.SegmentName == nil {
			return errors.New("SegmentName could not be nil, discarded")
		}
		segmentUpdate := dtos.NewSegmentChangeNotification(i.Channel, *i.ChangeNumber, *i.SegmentName)
		p.segmentQueue <- segmentUpdate
	case dtos.SplitKill:
		if i.ChangeNumber == nil {
			return errors.New("ChangeNumber could not be nil, discarded")
		}
		if i.SplitName == nil {
			return errors.New("SplitName could not be nil, discarded")
		}
		if i.DefaultTreatment == nil {
			return errors.New("DefaultTreatment could not be nil, discarded")
		}
		splitUpdate := dtos.NewSplitChangeNotification(i.Channel, *i.ChangeNumber)
		p.splitStorage.KillLocally(*i.SplitName, *i.DefaultTreatment, *i.ChangeNumber)
		p.splitQueue <- splitUpdate
	case dtos.Control:
		if i.ControlType == nil {
			return errors.New("ControlType could not be nil, discarded")
		}
		control := dtos.NewControlNotification(i.Channel, *i.ControlType)
		switch control.ControlType {
		case streamingDisabledType:
			p.logger.Debug("Received notification for disabling streaming")
			p.controlStatus <- streamingDisabled
		case streamingPausedType:
			p.logger.Debug("Received notification for pausing streaming")
			p.controlStatus <- streamingPaused
		case streamingResumedType:
			p.logger.Debug("Received notification for resuming streaming")
			p.controlStatus <- streamingResumed
		default:
			p.logger.Debug(fmt.Sprintf("%s Unexpected type of Control Notification", control.ControlType))
		}
	default:
		return fmt.Errorf("Unknown IncomingNotification type: %T", i)
	}
	return nil
}
