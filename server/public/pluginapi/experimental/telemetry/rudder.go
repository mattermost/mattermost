package telemetry

import (
	rudder "github.com/rudderlabs/analytics-go"
)

// rudderDataPlaneURL is set to the common Data Plane URL for all Mattermost Projects.
// It can be set during build time. More info in the package documentation.
var rudderDataPlaneURL = "https://pdat.matterlytics.com"

// rudderWriteKey is set during build time. More info in the package documentation.
var rudderWriteKey string

// NewRudderClient creates a new telemetry client with Rudder using the default configuration.
func NewRudderClient() (Client, error) {
	return NewRudderClientWithCredentials(rudderWriteKey, rudderDataPlaneURL)
}

// NewRudderClientWithCredentials lets you create a Rudder client with your own credentials.
func NewRudderClientWithCredentials(writeKey, dataPlaneURL string) (Client, error) {
	client, err := rudder.NewWithConfig(writeKey, dataPlaneURL, rudder.Config{})
	if err != nil {
		return nil, err
	}

	return &rudderWrapper{client: client}, nil
}

type rudderWrapper struct {
	client rudder.Client
}

func (r *rudderWrapper) Enqueue(t Track) error {
	var context *rudder.Context
	if t.InstallationID != "" {
		context = &rudder.Context{Traits: map[string]any{"installationId": t.InstallationID}}
	}

	return r.client.Enqueue(rudder.Track{
		UserId:     t.UserID,
		Event:      t.Event,
		Context:    context,
		Properties: t.Properties,
	})
}

func (r *rudderWrapper) Close() error {
	return r.client.Close()
}
