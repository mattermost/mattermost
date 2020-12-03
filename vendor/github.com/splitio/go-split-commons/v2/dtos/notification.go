package dtos

const (
	// SplitUpdate used when split is updated
	SplitUpdate = "SPLIT_UPDATE"
	// SplitKill used when split is killed
	SplitKill = "SPLIT_KILL"
	// SegmentUpdate used when segment is updated
	SegmentUpdate = "SEGMENT_UPDATE"
	// MySegmentsUpdate used when mySegment is updated
	MySegmentsUpdate = "MY_SEGMENTS_UPDATE"
	// Control for control
	Control = "CONTROL"
	// StreamingPause for controlType
	StreamingPause = "STREAMING_PAUSED"
	// StreamingResumed for controlType
	StreamingResumed = "STREAMING_RESUMED"
	// StreamingDisabled for controlType
	StreamingDisabled = "STREAMING_DISABLED"
)

// IncomingNotification struct for incoming notification from streaming
type IncomingNotification struct {
	Channel          string  `json:"channel"`
	ChangeNumber     *int64  `json:"changeNumber,omitempty"`
	ControlType      *string `json:"controlType,omitempty"`
	DefaultTreatment *string `json:"defaultTreatment,omitempty"`
	SegmentName      *string `json:"segmentName,omitempty"`
	SplitName        *string `json:"splitName,omitempty"`
	Timestamp        *int64  `json:"timestamp,omitempty"`
	Type             string  `json:"type"`
}

// Notification should be implemented by all notification types
type Notification interface {
	ChannelName() string
	NotificationType() string
}

// base struct with added logic that wraps around a DTO
type base struct {
	channelName      string
	notificationType string
}

// ChannelName returns channel name
func (b base) ChannelName() string {
	return b.channelName
}

// NotificationType returns the type of the notification
func (b base) NotificationType() string {
	return b.notificationType
}

// ControlNotification notification for control channels
type ControlNotification struct {
	base
	ControlType string
}

// NewControlNotification builds a notification for controlling connection
func NewControlNotification(channelName string, controlType string) ControlNotification {
	return ControlNotification{
		base: base{
			channelName:      channelName,
			notificationType: Control,
		},
		ControlType: controlType,
	}
}

// MySegmentsNotification notification when MySegments is updated
type MySegmentsNotification struct {
	base
	IncludesPayload bool
	Payload         []string
	ChangeNumber    int64
}

// NewMySegmentsNotification builds a MySegments notification
func NewMySegmentsNotification(channelName string, includesPayload bool, payload []string, changeNumber int64) MySegmentsNotification {
	return MySegmentsNotification{
		base: base{
			channelName:      channelName,
			notificationType: MySegmentsUpdate,
		},
		IncludesPayload: includesPayload,
		Payload:         payload,
		ChangeNumber:    changeNumber,
	}
}

// SegmentChangeNotification notification when a Segment is updated
type SegmentChangeNotification struct {
	base
	ChangeNumber int64
	SegmentName  string
}

// NewSegmentChangeNotification builds a segment change notification
func NewSegmentChangeNotification(channelName string, changeNumber int64, segmentName string) SegmentChangeNotification {
	return SegmentChangeNotification{
		base: base{
			channelName:      channelName,
			notificationType: SegmentUpdate,
		},
		ChangeNumber: changeNumber,
		SegmentName:  segmentName,
	}
}

// SplitChangeNotification notification to send a fetch to splitChanges
type SplitChangeNotification struct {
	base
	ChangeNumber int64
}

// NewSplitChangeNotification builds a split change notification
func NewSplitChangeNotification(channelName string, changeNumber int64) SplitChangeNotification {
	return SplitChangeNotification{
		base: base{
			channelName:      channelName,
			notificationType: SplitUpdate,
		},
		ChangeNumber: changeNumber,
	}
}

// SplitKillNotification notification when Split is killed
type SplitKillNotification struct {
	base
	ChangeNumber     int64
	DefaultTreatment string
	SplitName        string
}

// NewSplitKillNotification builds a killed split notification
func NewSplitKillNotification(channelName string, changeNumber int64, defaultTreatment string, splitName string) SplitKillNotification {
	return SplitKillNotification{
		base: base{
			channelName:      channelName,
			notificationType: SplitKill,
		},
		ChangeNumber:     changeNumber,
		DefaultTreatment: defaultTreatment,
		SplitName:        splitName,
	}
}
