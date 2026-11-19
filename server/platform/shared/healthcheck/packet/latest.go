// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package packet

import (
	"context"
	"strings"

	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/releases"
)

// FillLatestVersion fetches the release at latestURL when the snapshot doesn't record the latest
// one, which packets never do. On error the snapshot is unchanged and the version-behind rules
// report unknown, so callers can evaluate anyway.
func FillLatestVersion(ctx context.Context, snapshot *healthcheck.Snapshot, latestURL string) error {
	if snapshot.Version.Latest != "" {
		return nil
	}

	release, err := releases.FetchLatest(ctx, latestURL)
	if err != nil {
		return err
	}

	snapshot.Version.Latest = strings.TrimPrefix(release.TagName, "v")
	return nil
}
