package telemetry

import "github.com/mattermost/mattermost-plugin-api/experimental/bot/logger"

// Tracker defines a telemetry tracker
type Tracker interface {
	// TrackEvent registers an event through the configured telemetry client
	TrackEvent(event string, properties map[string]interface{})
	// TrackUserEvent registers an event through the configured telemetry client associated to a user
	TrackUserEvent(event string, userID string, properties map[string]interface{})
}

// Client defines a telemetry client
type Client interface {
	// Enqueue adds a tracker event (Track) to be registered
	Enqueue(t Track) error
	// Close closes the client connection, flushing any event left on the queue
	Close() error
}

// Track defines an event ready for the client to process
type Track struct {
	UserID     string
	Event      string
	Properties map[string]interface{}
}

type tracker struct {
	client             Client
	diagnosticID       string
	serverVersion      string
	pluginID           string
	pluginVersion      string
	telemetryShortName string
	enabled            bool
	logger             logger.Logger
}

// NewTracker creates a default Tracker
// - c Client: A telemetry client. If nil, the tracker will not track any event.
// - diagnosticID: Server unique ID used for telemetry.
// - severVersion: Mattermost server version.
// - pluginID: The plugin ID.
// - pluginVersion: The plugin version.
// - telemetryShortName: Short name for the plugin to use in telemetry. Used to avoid dot separated names like `com.company.pluginName`.
// If a empty string is provided, it will use the pluginID.
// - enableDiagnostics: Whether the system has enabled sending telemetry data. If false, the tracker will not track any event.
// - l Logger: A logger to log any error related with the telemetry tracking.
func NewTracker(
	c Client,
	diagnosticID,
	serverVersion,
	pluginID,
	pluginVersion,
	telemetryShortName string,
	enableDiagnostics bool,
	l logger.Logger,
) Tracker {
	if telemetryShortName == "" {
		telemetryShortName = pluginID
	}
	return &tracker{
		telemetryShortName: telemetryShortName,
		client:             c,
		diagnosticID:       diagnosticID,
		serverVersion:      serverVersion,
		pluginID:           pluginID,
		pluginVersion:      pluginVersion,
		enabled:            enableDiagnostics,
		logger:             l,
	}
}

func (t *tracker) TrackEvent(event string, properties map[string]interface{}) {
	if !t.enabled || t.client == nil {
		return
	}

	event = t.telemetryShortName + "_" + event
	properties["PluginID"] = t.pluginID
	properties["PluginVersion"] = t.pluginVersion
	properties["ServerVersion"] = t.serverVersion

	err := t.client.Enqueue(Track{
		UserID:     t.diagnosticID, // We consider the server the "user" on the telemetry system. Any reference to the actual user is passed by properties.
		Event:      event,
		Properties: properties,
	})

	if err != nil {
		t.logger.Warnf("cannot enqueue telemetry event, err=%s", err.Error())
	}
}

func (t *tracker) TrackUserEvent(event, userID string, properties map[string]interface{}) {
	properties["UserID"] = userID
	t.TrackEvent(event, properties)
}
