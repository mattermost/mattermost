package push

import (
	"encoding/json"
	"fmt"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/logging"
)

// EventHandler struct
type EventHandler struct {
	keeper    *Keeper
	parser    *NotificationParser
	processor *Processor
	logger    logging.LoggerInterface
}

// NewEventHandler builds new EventHandler
func NewEventHandler(keeper *Keeper, parser *NotificationParser, processor *Processor, logger logging.LoggerInterface) *EventHandler {
	return &EventHandler{
		keeper:    keeper,
		parser:    parser,
		processor: processor,
		logger:    logger,
	}
}

func (e *EventHandler) wrapOccupancy(incomingEvent IncomingEvent) *Occupancy {
	if incomingEvent.data == nil {
		return nil
	}

	var occupancy *Occupancy
	err := json.Unmarshal([]byte(*incomingEvent.data), &occupancy)
	if err != nil {
		return nil
	}

	return occupancy
}

func (e *EventHandler) wrapUpdateEvent(incomingEvent IncomingEvent) *dtos.IncomingNotification {
	if incomingEvent.data == nil {
		return nil
	}
	var incomingNotification *dtos.IncomingNotification
	err := json.Unmarshal([]byte(*incomingEvent.data), &incomingNotification)
	if err != nil {
		e.logger.Error("cannot parse data as IncomingNotification type")
		return nil
	}
	incomingNotification.Channel = *incomingEvent.channel
	return incomingNotification
}

// HandleIncomingMessage handles incoming message from streaming
func (e *EventHandler) HandleIncomingMessage(event map[string]interface{}) {
	incomingEvent := e.parser.Parse(event)
	switch incomingEvent.event {
	case update:
		e.logger.Debug("Update event received")
		incomingNotification := e.wrapUpdateEvent(incomingEvent)
		if incomingNotification == nil {
			e.logger.Debug("Skipping incoming notification...")
			return
		}
		e.logger.Debug("Incoming Notification:", incomingNotification)
		err := e.processor.Process(*incomingNotification)
		if err != nil {
			e.logger.Debug("Could not process notification", err.Error())
			return
		}
	case occupancy:
		e.logger.Debug("Presence event received")
		occupancy := e.wrapOccupancy(incomingEvent)
		if occupancy == nil || incomingEvent.channel == nil {
			e.logger.Debug("Skipping occupancy...")
			return
		}
		e.keeper.UpdateManagers(*incomingEvent.channel, occupancy.Data.Publishers)
		return
	case errorType: // TODO: Update this when logic is fully defined
		e.logger.Error(fmt.Sprintf("Error received: %+v", incomingEvent))
	default:
		e.logger.Debug(fmt.Sprintf("Unexpected incomingEvent: %+v", incomingEvent))
		e.logger.Error("Unexpected type of event received")
	}
}
