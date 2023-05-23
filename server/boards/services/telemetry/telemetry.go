// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"os"
	"time"

	rudder "github.com/rudderlabs/analytics-go"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/scheduler"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils"
)

const (
	rudderDataplaneURL = "https://pdat.matterlytics.com"
	rudderKeyProd      = "1myWcDbTkIThnpPYyms7DKlmQWl"
	rudderKeyTest      = "1myWYwHRDFdLDTpznQ7qFlOPQaa"

	// These are placeholders to allow the existing release pipelines to run without failing to
	// insert the values that are now hard-coded above. Remove this once we converge on the
	// unified delivery pipeline in GitHub.
	_ = "placeholder_rudder_dataplane_url"
	_ = "placeholder_boards_rudder_key"

	timeBetweenTelemetryChecks = 10 * time.Minute
)

type TrackerFunc func() (Tracker, error)

type Tracker map[string]interface{}

type Service struct {
	trackers                   map[string]TrackerFunc
	logger                     mlog.LoggerIFace
	rudderClient               rudder.Client
	telemetryID                string
	timestampLastTelemetrySent time.Time
}

type RudderConfig struct {
	RudderKey    string
	DataplaneURL string
}

func New(telemetryID string, logger mlog.LoggerIFace) *Service {
	service := &Service{
		logger:      logger,
		telemetryID: telemetryID,
		trackers:    map[string]TrackerFunc{},
	}

	return service
}

func (ts *Service) RegisterTracker(name string, f TrackerFunc) {
	ts.trackers[name] = f
}

func (ts *Service) getRudderConfig() RudderConfig {
	// Support unit testing
	if os.Getenv("RUDDER_KEY") != "" && os.Getenv("RUDDER_DATAPLANE_URL") != "" {
		return RudderConfig{os.Getenv("RUDDER_KEY"), os.Getenv("RUDDER_DATAPLANE_URL")}
	}

	rudderKey := ""
	switch model.GetServiceEnvironment() {
	case model.ServiceEnvironmentProduction:
		rudderKey = rudderKeyProd
	case model.ServiceEnvironmentTest:
		rudderKey = rudderKeyTest
	case model.ServiceEnvironmentDev:
	}

	return RudderConfig{rudderKey, rudderDataplaneURL}
}

func (ts *Service) sendDailyTelemetry(override bool) {
	config := ts.getRudderConfig()
	if (config.DataplaneURL != "" && config.RudderKey != "") || override {
		ts.initRudder(config.DataplaneURL, config.RudderKey)

		for name, tracker := range ts.trackers {
			m, err := tracker()
			if err != nil {
				ts.logger.Error("Error fetching telemetry data", mlog.String("name", name), mlog.Err(err))
				continue
			}
			ts.sendTelemetry(name, m)
		}
	}
}

func (ts *Service) sendTelemetry(event string, properties map[string]interface{}) {
	if ts.rudderClient != nil {
		var context *rudder.Context
		_ = ts.rudderClient.Enqueue(rudder.Track{
			Event:      event,
			UserId:     ts.telemetryID,
			Properties: properties,
			Context:    context,
		})
	}
}

func (ts *Service) initRudder(endpoint, rudderKey string) {
	if ts.rudderClient == nil {
		config := rudder.Config{}
		config.Logger = rudder.StdLogger(ts.logger.StdLogger(mlog.LvlFBTelemetry))
		config.Endpoint = endpoint
		// For testing
		if endpoint != rudderDataplaneURL {
			config.Verbose = true
			config.BatchSize = 1
		}
		client, err := rudder.NewWithConfig(rudderKey, endpoint, config)
		if err != nil {
			ts.logger.Fatal("Failed to create Rudder instance")
			return
		}
		_ = client.Enqueue(rudder.Identify{
			UserId: ts.telemetryID,
		})

		ts.rudderClient = client
	}
}

func (ts *Service) doTelemetryIfNeeded(firstRun time.Time) {
	hoursSinceFirstServerRun := time.Since(firstRun).Hours()

	// Send once every 10 minutes for the first hour
	if hoursSinceFirstServerRun < 1 {
		ts.doTelemetry()
		return
	}

	// Send once every hour thereafter for the first 12 hours
	if hoursSinceFirstServerRun <= 12 && time.Since(ts.timestampLastTelemetrySent) >= time.Hour {
		ts.doTelemetry()
		return
	}

	// Send at the 24 hour mark and every 24 hours after
	if hoursSinceFirstServerRun > 12 && time.Since(ts.timestampLastTelemetrySent) >= 24*time.Hour {
		ts.doTelemetry()
		return
	}
}

func (ts *Service) RunTelemetryJob(firstRunMillis int64) {
	// Send on boot
	ts.doTelemetry()
	scheduler.CreateRecurringTask("Telemetry", func() {
		ts.doTelemetryIfNeeded(utils.TimeFromMillis(firstRunMillis))
	}, timeBetweenTelemetryChecks)
}

func (ts *Service) doTelemetry() {
	ts.timestampLastTelemetrySent = time.Now()
	ts.sendDailyTelemetry(false)
}

// Shutdown closes the telemetry client.
func (ts *Service) Shutdown() error {
	if ts.rudderClient != nil {
		return ts.rudderClient.Close()
	}

	return nil
}
