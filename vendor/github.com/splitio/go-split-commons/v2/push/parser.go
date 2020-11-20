package push

import (
	"github.com/splitio/go-toolkit/v3/common"
	"github.com/splitio/go-toolkit/v3/logging"
)

const (
	update    = "update"
	errorType = "error"
	occupancy = "[meta]occupancy"
)

// NotificationParser struct
type NotificationParser struct {
	logger logging.LoggerInterface
}

// NewNotificationParser creates notifcation parser
func NewNotificationParser(logger logging.LoggerInterface) *NotificationParser {
	return &NotificationParser{
		logger: logger,
	}
}

// Parse parses incoming event from streaming
func (n *NotificationParser) Parse(event map[string]interface{}) IncomingEvent {
	incomingEvent := IncomingEvent{
		id:       common.AsStringOrNil(event["id"]),
		encoding: common.AsStringOrNil(event["encoding"]),
		data:     common.AsStringOrNil(event["data"]),
		name:     common.AsStringOrNil(event["name"]),
		clientID: common.AsStringOrNil(event["clientId"]),
		channel:  common.AsStringOrNil(event["channel"]),
		message:  common.AsStringOrNil(event["message"]),
		href:     common.AsStringOrNil(event["href"]),
	}

	timestamp := common.AsFloat64OrNil(event["timestamp"])
	if timestamp != nil {
		incomingEvent.timestamp = common.Int64Ref(int64(*timestamp))
	}
	code := common.AsFloat64OrNil(event["code"])
	if code != nil {
		incomingEvent.code = common.IntRef(int(*code))
	}
	statusCode := common.AsFloat64OrNil(event["statusCode"])
	if statusCode != nil {
		incomingEvent.statusCode = common.IntRef(int(*statusCode))
	}

	if incomingEvent.code != nil && incomingEvent.statusCode != nil {
		incomingEvent.event = errorType
		return incomingEvent
	}

	if incomingEvent.name != nil && *incomingEvent.name == occupancy {
		incomingEvent.event = occupancy
		return incomingEvent
	}

	incomingEvent.event = update
	return incomingEvent
}
