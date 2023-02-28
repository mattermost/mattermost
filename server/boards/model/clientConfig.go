package model

// ClientConfig is the client configuration
// swagger:model
type ClientConfig struct {
	// Is telemetry enabled
	// required: true
	Telemetry bool `json:"telemetry"`

	// The telemetry ID
	// required: true
	TelemetryID string `json:"telemetryid"`

	// Is public shared boards enabled
	// required: true
	EnablePublicSharedBoards bool `json:"enablePublicSharedBoards"`

	// Is public shared boards enabled
	// required: true
	TeammateNameDisplay string `json:"teammateNameDisplay"`

	// The server feature flags
	// required: true
	FeatureFlags map[string]string `json:"featureFlags"`

	// Required for file upload to check the size of the file
	// required: true
	MaxFileSize int64 `json:"maxFileSize"`
}
