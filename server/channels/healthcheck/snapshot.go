// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "github.com/mattermost/mattermost/server/public/model"

// Snapshot is a point-in-time view of server state consumed by the rule
// engine. Each section is optional: a nil section means the data could not
// be collected (e.g. the probe timed out, or the snapshot was built from a
// support packet that predates this section). The engine exposes a nil
// section as the CEL unknown type so rules return "unknown" rather than a
// false "resolved".
//
// Design note (WS2 coordination):
// The long-term goal is that this struct becomes the canonical schema for
// both the live evaluation path and the support-packet zip (one snapshot,
// two outputs — see DESIGN.md "Data model: one snapshot, two outputs"). The
// current support_packet.go in channels/app does ad-hoc collection; that
// refactor (typed section collectors feeding both paths) requires
// coordination with the support-packet owners and is tracked as a follow-up.
// For P1 the Live provider (see live.go in channels/app) reads live state
// directly; the Packet provider is a TODO seam.
type Snapshot struct {
	// Config holds the sanitized server config. Nil means unavailable.
	Config *model.Config

	// Probes holds the results of live write probes. Nil means unavailable
	// or not yet collected for this evaluation pass.
	Probes *ProbeSection
}

// ProbeSection holds the results of live connectivity probes.
//
// Probes are side-effecting (they write to the DB / filestore) and should
// not be collected on every evaluation cycle. The evaluation job (WS5) will
// collect them on a slower sub-cadence controlled by the probe volatility
// class.
type ProbeSection struct {
	// DBWriteOK is true if a test row was successfully written and deleted
	// from the primary database. False means the write failed; a nil
	// ProbeSection means the probe was not run in this cycle.
	DBWriteOK bool
}

// ProbeProvider is the interface the Live snapshot provider uses to run
// write probes. Implementations live in the app layer (channels/app) so
// they can access the store; tests inject a fake.
//
// TODO (WS2 — Packet provider): add a PacketProbeProvider that returns
// "unknown" for all probes, since a support packet captures probe results
// at generation time rather than running them live.
type ProbeProvider interface {
	// DBWrite performs a health-check write+delete on the primary database
	// and returns true if both operations succeed.
	DBWrite() bool
}
