// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// healthCollectDeadline bounds how long a run waits for the other nodes' diagnostics. It must
// cover the probes' own timeouts: OAuth and push are 10 s each, the pg_stat queries 10 s each,
// plus SMTP, LDAP, Elasticsearch and S3.
const healthCollectDeadline = 3 * time.Minute

// BuildHealthSnapshot assembles a health snapshot from live server state, with every connected
// node's diagnostics. A failed workspace collector is recorded in Snapshot.Sections rather than
// failing the call; the error return is for a snapshot that cannot be built at all.
func (a *App) BuildHealthSnapshot(rctx request.CTX) (*healthcheck.Snapshot, error) {
	return a.buildHealthSnapshotWithLatestVersionURL(rctx, LatestVersionURL)
}

func (a *App) buildHealthSnapshotWithLatestVersionURL(rctx request.CTX, latestVersionURL string) (*healthcheck.Snapshot, error) {
	nodes, err := a.Srv().Platform().CollectHealthNodes(rctx, healthCollectDeadline)
	if err != nil {
		return nil, err
	}

	sections := map[model.WorkspaceSection]error{}
	snapshot := healthcheck.NewSnapshot(nodes)
	snapshot.Sections = sections
	snapshot.CollectedAt = time.Now().UTC()

	snapshot.Config, err = a.Srv().Platform().GetSupportPacketConfig(rctx)
	sections[model.SectionConfig] = err

	snapshot.Stats, err = a.getSupportPacketStats(rctx)
	sections[model.SectionStats] = err

	snapshot.Jobs, err = a.getSupportPacketJobList(rctx)
	sections[model.SectionJobs] = err

	snapshot.Plugins, err = a.getPluginsList(rctx)
	sections[model.SectionPlugins] = err

	snapshot.Version.Current = model.CurrentVersion
	// The Makefile stamps BuildDate with `date -u`; dev builds leave the zero time.
	snapshot.Version.BuildDate, _ = time.Parse(time.UnixDate, model.BuildDate)

	release, appErr := a.GetLatestVersion(rctx, latestVersionURL)
	if appErr != nil {
		sections[model.SectionVersion] = appErr
	} else {
		sections[model.SectionVersion] = nil
		snapshot.Version.Latest = strings.TrimPrefix(release.TagName, "v")
	}

	return snapshot, nil
}
