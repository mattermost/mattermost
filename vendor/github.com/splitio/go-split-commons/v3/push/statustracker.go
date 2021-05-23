package push

import (
	"fmt"
	"sync"

	"github.com/splitio/go-toolkit/v4/common"
	"github.com/splitio/go-toolkit/v4/logging"
)

// StatusTracker keeps track of the status of the push subsystem and generates appropriate status change notifications.
type StatusTracker interface {
	HandleOccupancy(*OccupancyMessage) *int64
	HandleControl(*ControlUpdate) *int64
	HandleAblyError(*AblyError) *int64
	HandleDisconnection() *int64
	NotifySSEShutdownExpected()
	Reset()
}

// StatusTrackerImpl is a concrete implementation of the StatusTracker interface
type StatusTrackerImpl struct {
	logger                 logging.LoggerInterface
	mutex                  sync.Mutex
	occupancy              map[string]int64
	lastControlTimestamp   int64
	lastOccupancyTimestamp int64
	lastControlMessage     string
	lastStatusPropagated   int64
	shutdownExpected       bool
}

// NotifySSEShutdownExpected should be called when we are forcefully closing the SSE client
func (p *StatusTrackerImpl) NotifySSEShutdownExpected() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.shutdownExpected = true
}

// Reset should be called on initialization and when the a new connection is being established (to start from scratch)
func (p *StatusTrackerImpl) Reset() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.occupancy = map[string]int64{"control_pri": 2, "control_sec": 2}
	p.lastControlMessage = ControlTypeStreamingEnabled
	p.lastStatusPropagated = StatusUp
	p.shutdownExpected = false
}

// HandleOccupancy should be called for every occupancy notification received
func (p *StatusTrackerImpl) HandleOccupancy(message *OccupancyMessage) (newStatus *int64) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	if p.shutdownExpected {
		return nil // we don't care about occupancy if we're disconnecting
	}

	channel := message.ChannelWithoutPrefix()
	if _, ok := p.occupancy[channel]; !ok {
		p.logger.Warning(fmt.Sprintf("received occupancy on non-registered channel '%s'. Ignoring", channel))
		return nil
	}

	p.lastOccupancyTimestamp = message.Timestamp()
	p.occupancy[channel] = message.Publishers()
	return p.updateStatus()
}

// HandleAblyError should be called whenever an ably error is received
func (p *StatusTrackerImpl) HandleAblyError(errorEvent *AblyError) (newStatus *int64) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	if p.shutdownExpected {
		return nil // we don't care about occupancy if we're disconnecting
	}

	// Regardless of whether the error is retryable or not, we're going to close the connection
	p.shutdownExpected = true

	if errorEvent.IsRetryable() {
		p.logger.Info("Received retryable error message. Restarting SSE connection with backoff")
		return p.propagateStatus(StatusRetryableError)
	}

	p.logger.Info("Received non-retryable error message. Disabling streaming")
	return p.propagateStatus(StatusNonRetryableError)
}

// HandleControl should be called whenever a control notification is received
func (p *StatusTrackerImpl) HandleControl(controlUpdate *ControlUpdate) *int64 {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	if p.shutdownExpected {
		return nil // we don't care about occupancy if we're disconnecting
	}

	if p.lastControlTimestamp > controlUpdate.timestamp {
		p.logger.Warning("Received an old control update. Ignoring")
		return nil
	}

	p.lastControlMessage = controlUpdate.controlType
	p.lastControlTimestamp = controlUpdate.timestamp
	return p.updateStatus()
}

// HandleDisconnection should be called whenver the SSE client gets disconnected
func (p *StatusTrackerImpl) HandleDisconnection() *int64 {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	if !p.shutdownExpected {
		return p.propagateStatus(StatusRetryableError)
	}
	return nil
}

// NewStatusTracker returns a new StatusTracker
func NewStatusTracker(logger logging.LoggerInterface) *StatusTrackerImpl {
	tracker := &StatusTrackerImpl{logger: logger}
	tracker.Reset()
	return tracker
}

func (p *StatusTrackerImpl) occupancyOk() bool {
	for _, v := range p.occupancy {
		if v > 0 {
			return true
		}
	}
	return false
}

func (p *StatusTrackerImpl) updateStatus() *int64 {
	if p.lastStatusPropagated == StatusUp {
		if !p.occupancyOk() || p.lastControlMessage == ControlTypeStreamingPaused {
			return p.propagateStatus(StatusDown)
		}
		if p.lastControlMessage == ControlTypeStreamingDisabled {
			return p.propagateStatus(StatusNonRetryableError)
		}
	}
	if p.lastStatusPropagated == StatusDown {
		if p.occupancyOk() && p.lastControlMessage == ControlTypeStreamingEnabled {
			return p.propagateStatus(StatusUp)
		}
		if p.lastControlMessage == ControlTypeStreamingDisabled {
			return p.propagateStatus(StatusNonRetryableError)
		}
	}
	return nil
}

func (p *StatusTrackerImpl) propagateStatus(newStatus int64) *int64 {
	p.lastStatusPropagated = newStatus
	return common.Int64Ref(newStatus)
}

var _ StatusTracker = &StatusTrackerImpl{}
