package dtos

// LastSynchronization struct
type LastSynchronization struct {
	Splits           int64 `json:"sp,omitempty"`
	Segments         int64 `json:"se,omitempty"`
	Impressions      int64 `json:"im,omitempty"`
	ImpressionsCount int64 `json:"ic,omitempty"`
	Events           int64 `json:"ev,omitempty"`
	Token            int64 `json:"to,omitempty"`
	Telemetry        int64 `json:"te,omitempty"`
}

// HTTPErrors struct
type HTTPErrors struct {
	Splits           map[int]int64 `json:"sp,omitempty"`
	Segments         map[int]int64 `json:"se,omitempty"`
	Impressions      map[int]int64 `json:"im,omitempty"`
	ImpressionsCount map[int]int64 `json:"ic,omitempty"`
	Events           map[int]int64 `json:"ev,omitempty"`
	Token            map[int]int64 `json:"to,omitempty"`
	Telemetry        map[int]int64 `json:"te,omitempty"`
}

// HTTPLatencies struct
type HTTPLatencies struct {
	Splits           []int64 `json:"sp,omitempty"`
	Segments         []int64 `json:"se,omitempty"`
	Impressions      []int64 `json:"im,omitempty"`
	ImpressionsCount []int64 `json:"ic,omitempty"`
	Events           []int64 `json:"ev,omitempty"`
	Token            []int64 `json:"to,omitempty"`
	Telemetry        []int64 `json:"te,omitempty"`
}

// MethodLatencies struct
type MethodLatencies struct {
	Treatment            []int64 `json:"t,omitempty"`
	Treatments           []int64 `json:"ts,omitempty"`
	TreatmentWithConfig  []int64 `json:"tc,omitempty"`
	TreatmentsWithConfig []int64 `json:"tcs,omitempty"`
	Track                []int64 `json:"tr,omitempty"`
}

// MethodExceptions struct
type MethodExceptions struct {
	Treatment            int64 `json:"t,omitempty"`
	Treatments           int64 `json:"ts,omitempty"`
	TreatmentWithConfig  int64 `json:"tc,omitempty"`
	TreatmentsWithConfig int64 `json:"tcs,omitempty"`
	Track                int64 `json:"tr,omitempty"`
}

// StreamingEvent struct
type StreamingEvent struct {
	Type      int   `json:"e,omitempty"`
	Data      int64 `json:"d,omitempty"`
	Timestamp int64 `json:"t,omitempty"`
}

// TelemetryQueueObject struct mapping telemetry
type TelemetryQueueObject struct {
	Metadata Metadata `json:"m"`
	Config   Config   `json:"t"`
}

// Rates struct
type Rates struct {
	Splits      int64 `json:"sp,omitempty"`
	Segments    int64 `json:"se,omitempty"`
	Impressions int64 `json:"im,omitempty"`
	Events      int64 `json:"ev,omitempty"`
	Telemetry   int64 `json:"te,omitempty"`
}

// URLOverrides struct
type URLOverrides struct {
	Sdk       bool `json:"s,omitempty"`
	Events    bool `json:"e,omitempty"`
	Auth      bool `json:"a,omitempty"`
	Stream    bool `json:"st,omitempty"`
	Telemetry bool `json:"t,omitempty"`
}

// Config data for initial configs metrics
type Config struct {
	OperationMode              int           `json:"oM,omitempty"`
	StreamingEnabled           bool          `json:"sE,omitempty"`
	Storage                    string        `json:"st,omitempty"`
	Rates                      *Rates        `json:"rR,omitempty"`
	URLOverrides               *URLOverrides `json:"uO,omitempty"`
	ImpressionsQueueSize       int64         `json:"iQ,omitempty"`
	EventsQueueSize            int64         `json:"eQ,omitempty"`
	ImpressionsMode            int           `json:"iM,omitempty"`
	ImpressionsListenerEnabled bool          `json:"iL,omitempty"`
	HTTPProxyDetected          bool          `json:"hP,omitempty"`
	ActiveFactories            int64         `json:"aF,omitempty"`
	RedundantFactories         int64         `json:"rF,omitempty"`
	TimeUntilReady             int64         `json:"tR,omitempty"`
	BurTimeouts                int64         `json:"bT,omitempty"`
	NonReadyUsages             int64         `json:"nR,omitempty"`
	Integrations               []string      `json:"i,omitempty"`
	Tags                       []string      `json:"t,omitempty"`
}

// Stats data sent by sdks pereiodically
type Stats struct {
	LastSynchronizations *LastSynchronization `json:"lS,omitempty"`
	MethodLatencies      *MethodLatencies     `json:"mL,omitempty"`
	MethodExceptions     *MethodExceptions    `json:"mE,omitempty"`
	HTTPErrors           *HTTPErrors          `json:"hE,omitempty"`
	HTTPLatencies        *HTTPLatencies       `json:"hL,omitempty"`
	TokenRefreshes       int64                `json:"tR,omitempty"`
	AuthRejections       int64                `json:"aR,omitempty"`
	ImpressionsQueued    int64                `json:"iQ,omitempty"`
	ImpressionsDeduped   int64                `json:"iDe,omitempty"`
	ImpressionsDropped   int64                `json:"iDr,omitempty"`
	SplitCount           int64                `json:"spC,omitempty"`
	SegmentCount         int64                `json:"seC,omitempty"`
	SegmentKeyCount      int64                `json:"skC,omitempty"`
	SessionLengthMs      int64                `json:"sL,omitempty"`
	EventsQueued         int64                `json:"eQ,omitempty"`
	EventsDropped        int64                `json:"eD,omitempty"`
	StreamingEvents      []StreamingEvent     `json:"sE,omitempty"`
	Tags                 []string             `json:"t,omitempty"`
}
