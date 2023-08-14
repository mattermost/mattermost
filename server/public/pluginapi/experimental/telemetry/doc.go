// Package telemetry allows you to add telemetry to your plugins.
// For Rudder, you can set the data plane URL and the write key on build time,
// to allow having different keys for production and development.
// If you are working on a Mattermost project, the data plane URL is already set.
// In order to default to the development key we have to set an environment variable during build time.
// Copy the following lines in build/custom.mk to setup that variable.
//
//	ifndef MM_RUDDER_WRITE_KEY
//	  MM_RUDDER_WRITE_KEY = 1d5bMvdrfWClLxgK1FvV3s4U1tg
//	endif
//
// To use this environment variable to set the key in the plugin,
// you have to add this line after the previous ones.
//
//	LDFLAGS += -X "github.com/mattermost/mattermost/server/public/plugin/experimental/telemetry.rudderWriteKey=$(MM_RUDDER_WRITE_KEY)"
//
// MM_RUDDER_WRITE_KEY environment variable must be set also during CI
// to the production write key ("1dP7Oi78p0PK1brYLsfslgnbD1I").
// If you want to use your own data plane URL, add also this line and
// make sure the MM_RUDDER_DATAPLANE_URL environment variable is set.
//
//	LDFLAGS += -X "github.com/mattermost/mattermost/server/public/plugin/experimental/telemetry.rudderDataPlaneURL=$(MM_RUDDER_DATAPLANE_URL)"
//
// In order to use telemetry you should:
//
// 1. Add the new fields to the plugin
//
//	type Plugin struct {
//		plugin.MattermostPlugin
//		...
//		telemetryClient telemetry.Client
//		tracker         telemetry.Tracker
//	}
//
// 2. Start the telemetry client and tracker on plugin activate
//
//	func (p *Plugin) OnActivate() error {
//		p.telemetryClient, err = telemetry.NewRudderClient()
//		if err != nil {
//			p.API.LogWarn("telemetry client not started", "error", err.Error())
//		}
//		...
//		p.tracker = telemetry.NewTracker(
//			p.telemetryClient,
//			p.API.GetDiagnosticId(),
//			p.API.GetServerVersion(),
//			Manifest.Id,
//			Manifest.Version,
//			"plugin_short_namame",
//			telemetry.NewTrackerConfig(p.API.GetConfig()),
//			logger.New(p.API)
//		)
//	}
//
// 3. Trigger tracker changes when configuration changes
//
//	func (p *Plugin) OnConfigurationChange() error {
//		...
//		if p.tracker != nil {
//			p.tracker.ReloadConfig(telemetry.NewTrackerConfig(p.API.GetConfig()))
//		}
//		return nil
//	}
//
// 4. Close the client on plugin deactivate
//
//	func (p *Plugin) OnDeactivate() error {
//		if p.telemetryClient != nil {
//			err := p.telemetryClient.Close()
//			if err != nil {
//				p.API.LogWarn("OnDeactivate: failed to close telemetryClient", "error", err.Error())
//			}
//		}
//		return nil
//	}
package telemetry
