package push

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/splitio/go-split-commons/v3/service/api/sse"

	"github.com/splitio/go-toolkit/v4/logging"
)

// SSE event type constants
const (
	SSEEventTypeSync    = "sync"
	SSEEventTypeMessage = "message"
	SSEEventTypeError   = "error"
)

// Message type constants
const (
	MessageTypeUpdate = iota
	MessageTypeControl
	MessageTypeOccupancy
)

// Update type constants
const (
	UpdateTypeSplitChange   = "SPLIT_UPDATE"
	UpdateTypeSplitKill     = "SPLIT_KILL"
	UpdateTypeSegmentChange = "SEGMENT_UPDATE"
	UpdateTypeContol        = "CONTROL"
)

// Control type constants
const (
	ControlTypeStreamingEnabled  = "STREAMING_ENABLED"
	ControlTypeStreamingPaused   = "STREAMING_PAUSED"
	ControlTypeStreamingDisabled = "STREAMING_DISABLED"
)

const (
	occupancuName   = "[meta]occupancy"
	occupancyPrefix = "[?occupancy=metrics.publishers]"
)

// ErrEmptyEvent indicates an event without message and event fields
var ErrEmptyEvent = errors.New("empty incoming event")

// NotificationParser interface
type NotificationParser interface {
	ParseAndForward(sse.IncomingMessage) (*int64, error)
}

// NotificationParserImpl implementas the NotificationParser interface
type NotificationParserImpl struct {
	logger            logging.LoggerInterface
	onSplitUpdate     func(*SplitChangeUpdate) error
	onSplitKill       func(*SplitKillUpdate) error
	onSegmentUpdate   func(*SegmentChangeUpdate) error
	onControlUpdate   func(*ControlUpdate) *int64
	onOccupancyMesage func(*OccupancyMessage) *int64
	onAblyError       func(*AblyError) *int64
}

// ParseAndForward accepts an incoming RAW event and returns a properly parsed & typed event
func (p *NotificationParserImpl) ParseAndForward(raw sse.IncomingMessage) (*int64, error) {

	if raw.Event() == "" {
		if raw.ID() == "" {
			return nil, ErrEmptyEvent
		}
		// If it has ID its a sync event, which we're not using not. Ignore.
		p.logger.Debug("Ignoring sync event")
		return nil, nil
	}

	data := genericData{}
	err := json.Unmarshal([]byte(raw.Data()), &data)
	if err != nil {
		return nil, fmt.Errorf("error parsing JSON: %w", err)
	}

	switch raw.Event() {
	case SSEEventTypeError:
		return p.parseError(&data)
	case SSEEventTypeMessage:
		return p.parseMessage(&data)
	}

	return nil, nil

}

func (p *NotificationParserImpl) parseError(data *genericData) (*int64, error) {
	return p.onAblyError(&AblyError{
		code:       data.Code,
		statusCode: data.StatusCode,
		message:    data.Message,
		href:       data.Href,
		timestamp:  data.Timestamp,
	}), nil
}

func (p *NotificationParserImpl) parseMessage(data *genericData) (*int64, error) {
	var nested genericMessageData
	err := json.Unmarshal([]byte(data.Data), &nested)
	if err != nil {
		return nil, fmt.Errorf("error parsing message nested json data: %w", err)
	}

	if data.Name == occupancuName {
		return p.onOccupancyMesage(&OccupancyMessage{
			BaseMessage: BaseMessage{
				timestamp: data.Timestamp,
				channel:   data.Channel,
			},
			publishers: nested.Metrics.Publishers,
		}), nil
	}

	return p.parseUpdate(data, &nested)
}

func (p *NotificationParserImpl) parseUpdate(data *genericData, nested *genericMessageData) (*int64, error) {
	if data == nil || nested == nil {
		return nil, errors.New("parseUpdate: data cannot be nil")
	}

	base := BaseUpdate{
		BaseMessage:  BaseMessage{timestamp: data.Timestamp, channel: data.Channel},
		changeNumber: nested.ChangeNumber,
	}

	switch nested.Type {
	case UpdateTypeSplitChange:
		return nil, p.onSplitUpdate(&SplitChangeUpdate{BaseUpdate: base})
	case UpdateTypeSplitKill:
		return nil, p.onSplitKill(&SplitKillUpdate{BaseUpdate: base, splitName: nested.SplitName, defaultTreatment: nested.DefaultTreatment})
	case UpdateTypeSegmentChange:
		return nil, p.onSegmentUpdate(&SegmentChangeUpdate{BaseUpdate: base, segmentName: nested.SegmentName})
	case UpdateTypeContol:
		return p.onControlUpdate(&ControlUpdate{BaseMessage: base.BaseMessage, controlType: nested.ControlType}), nil
	default:
		// TODO: log full event in debug mode
		return nil, fmt.Errorf("invalid update type: %s", nested.Type)
	}
}

// Event basic interface
type Event interface {
	fmt.Stringer
	EventType() string
	Timestamp() int64
}

// SSESyncEvent represents an SSE Sync event with only id (used for resuming connections)
type SSESyncEvent struct {
	id        string
	timestamp int64
}

// EventType always returns SSEEventTypeSync for SSESyncEvents
func (e *SSESyncEvent) EventType() string { return SSEEventTypeSync }

// Timestamp returns the timestamp of the event parsing
func (e *SSESyncEvent) Timestamp() int64 { return e.timestamp }

// String returns the string represenation of the event
func (e *SSESyncEvent) String() string {
	return fmt.Sprintf("SSESync(id=%s,timestamp=%d)", e.id, e.timestamp)
}

// AblyError struct
type AblyError struct {
	code       int
	statusCode int
	message    string
	href       string
	timestamp  int64
}

// EventType always returns SSEEventTypeError for AblyError
func (a *AblyError) EventType() string { return SSEEventTypeError }

// Code returns the error code
func (a *AblyError) Code() int { return a.code }

// StatusCode returns the status code
func (a *AblyError) StatusCode() int { return a.statusCode }

// Message returns the error message
func (a *AblyError) Message() string { return a.message }

// Href returns the documentation link
func (a *AblyError) Href() string { return a.href }

// Timestamp returns the error timestamp
func (a *AblyError) Timestamp() int64 { return a.timestamp }

// IsRetryable returns whether the error is recoverable via a push subsystem restart
func (a *AblyError) IsRetryable() bool { return a.code >= 40140 && a.code <= 40149 }

// String returns the string representation of the ably error
func (a *AblyError) String() string {
	return fmt.Sprintf("AblyError(code=%d,statusCode=%d,message=%s,timestamp=%d,isRetryable=%t)",
		a.code, a.statusCode, a.message, a.timestamp, a.IsRetryable())
}

// Message basic interface
type Message interface {
	Event
	MessageType() int64
	Channel() string
}

// BaseMessage contains the basic message-specific fields and methods
type BaseMessage struct {
	timestamp int64
	channel   string
}

// EventType always returns SSEEventTypeMessage for BaseMessage and embedding types
func (m *BaseMessage) EventType() string { return SSEEventTypeMessage }

// Timestamp returns the timestamp of the message reception
func (m *BaseMessage) Timestamp() int64 { return m.timestamp }

// Channel returns which channel the message was received in
func (m *BaseMessage) Channel() string { return m.channel }

// OccupancyMessage contains fields & methods related to ocupancy messages
type OccupancyMessage struct {
	BaseMessage
	publishers int64
}

// MessageType always returns MessageTypeOccupancy for Occupancy messages
func (o *OccupancyMessage) MessageType() int64 { return MessageTypeOccupancy }

// ChannelWithoutPrefix returns the original channel namem without the metadata prefix
func (o *OccupancyMessage) ChannelWithoutPrefix() string {
	return strings.Replace(o.Channel(), occupancyPrefix, "", 1)
}

// Publishers returbs the amount of publishers in the current channel
func (o *OccupancyMessage) Publishers() int64 {
	return o.publishers
}

// Strings returns the string representation of an occupancy message
func (o *OccupancyMessage) String() string {
	return fmt.Sprintf("Occupancy(channel=%s,publishers=%d,timestamp=%d)",
		o.Channel(), o.publishers, o.Timestamp())
}

// Update basic interface
type Update interface {
	Message
	UpdateType() string
	ChangeNumber() int64
}

// BaseUpdate contains fields & methods related to update-based messages
type BaseUpdate struct {
	BaseMessage
	changeNumber int64
}

// MessageType alwats returns MessageType for Update messages
func (b *BaseUpdate) MessageType() int64 { return MessageTypeUpdate }

// ChangeNumber returns the changeNumber of the update
func (b *BaseUpdate) ChangeNumber() int64 { return b.changeNumber }

// SplitChangeUpdate represents a SplitChange notification generated in the split servers
type SplitChangeUpdate struct {
	BaseUpdate
}

// UpdateType always returns UpdateTypeSplitChange for SplitKillUpdate messages
func (u *SplitChangeUpdate) UpdateType() string { return UpdateTypeSplitChange }

// String returns the String representation of a split change notification
func (u *SplitChangeUpdate) String() string {
	return fmt.Sprintf("SplitChange(channel=%s,changeNumber=%d,timestamp=%d)",
		u.Channel(), u.ChangeNumber(), u.Timestamp())
}

// SplitKillUpdate represents a SplitKill notification generated in the split servers
type SplitKillUpdate struct {
	BaseUpdate
	splitName        string
	defaultTreatment string
}

// UpdateType always returns UpdateTypeSplitKill for SplitKillUpdate messages
func (u *SplitKillUpdate) UpdateType() string { return UpdateTypeSplitKill }

// SplitName returns the name of the killed split
func (u *SplitKillUpdate) SplitName() string { return u.splitName }

// DefaultTreatment returns the last default treatment seen in the split servers for this split
func (u *SplitKillUpdate) DefaultTreatment() string { return u.defaultTreatment }

// ToSplitChangeUpdate Maps this kill notification to a split change one
func (u *SplitKillUpdate) ToSplitChangeUpdate() *SplitChangeUpdate {
	return &SplitChangeUpdate{BaseUpdate: u.BaseUpdate}
}

// String returns the string representation of this update
func (u *SplitKillUpdate) String() string {
	return fmt.Sprintf("SplitKill(channel=%s,changeNumber=%d,splitName=%s,defaultTreatment=%s,timestamp=%d)",
		u.Channel(), u.ChangeNumber(), u.SplitName(), u.DefaultTreatment(), u.Timestamp())
}

// SegmentChangeUpdate represents a segment change notification generated in the split servers.
type SegmentChangeUpdate struct {
	BaseUpdate
	segmentName string
}

// UpdateType is always UpdateTypeSegmentChange for Segmet Updates
func (u *SegmentChangeUpdate) UpdateType() string { return UpdateTypeSegmentChange }

// SegmentName returns the name of the updated segment
func (u *SegmentChangeUpdate) SegmentName() string { return u.segmentName }

// String returns the string representation of a segment update notification
func (u *SegmentChangeUpdate) String() string {
	return fmt.Sprintf("SegmentChange(channel=%s,changeNumber=%d,segmentName=%s,timestamp=%d",
		u.Channel(), u.ChangeNumber(), u.segmentName, u.Timestamp())
}

// ControlUpdate represents a control notification generated by the split push subsystem
type ControlUpdate struct {
	BaseMessage
	controlType string
}

// MessageType always returns MessageTypeControl for Control messages
func (u *ControlUpdate) MessageType() int64 { return MessageTypeControl }

// ControlType returns the type of control notification received
func (u *ControlUpdate) ControlType() string { return u.controlType }

// String returns a string representation of this notification
func (u *ControlUpdate) String() string {
	return fmt.Sprintf("Control(channel=%s,type=%s,timestamp=%d)",
		u.Channel(), u.controlType, u.Timestamp())
}

type genericData struct {

	// Error associated data
	Code       int    `json:"code"`
	StatusCode int    `json:"statusCode"`
	Message    string `json:"message"`
	Href       string `json:"href"`

	ClientID  string `json:"clientId"`
	ID        string `json:"id"`
	Name      string `json:"name"`
	Timestamp int64  `json:"timestamp"`
	Encoding  string `json:"encoding"`
	Channel   string `json:"channel"`
	Data      string `json:"data"`

	//"id":"tO4rXGE4CX:0:0","timestamp":1612897630627,"encoding":"json","channel":"[?occupancy=metrics.publishers]control_sec","data":"{\"metrics\":{\"publishers\":0}}","name":"[meta]occupancy"}

}

type metrics struct {
	Publishers int64 `json:"publishers"`
}

type genericMessageData struct {
	Metrics          metrics `json:"metrics"`
	Type             string  `json:"type"`
	ChangeNumber     int64   `json:"changeNumber"`
	SplitName        string  `json:"splitName"`
	DefaultTreatment string  `json:"defaultTreatment"`
	SegmentName      string  `json:"segmentName"`
	ControlType      string  `json:"controlType"`

	// {\"type\":\"SPLIT_UPDATE\",\"changeNumber\":1612909342671}"}
}

// Compile-type assertions of interface requirements
var _ Event = &AblyError{}
var _ Message = &OccupancyMessage{}
var _ Message = &SplitChangeUpdate{}
var _ Message = &SplitKillUpdate{}
var _ Message = &SegmentChangeUpdate{}
var _ Message = &ControlUpdate{}
var _ Update = &SplitChangeUpdate{}
var _ Update = &SplitKillUpdate{}
var _ Update = &SegmentChangeUpdate{}
