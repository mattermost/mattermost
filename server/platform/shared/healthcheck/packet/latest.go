// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package packet

import (
	"context"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/releases"
)

// FillLatestVersion fetches the release at latestURL when the snapshot doesn't record the latest
// one, which packets never do. A failed fetch is not an error: the version-behind rules report
// unknown and the returned note says why.
func FillLatestVersion(ctx context.Context, snapshot *healthcheck.Snapshot, latestURL string) string {
	if snapshot.Version.Latest != "" {
		return ""
	}

	release, err := releases.FetchLatest(ctx, latestURL)
	if err != nil {
		return fmt.Sprintf("Could not fetch the latest release (%s): version-behind findings are unknown.", err)
	}

	snapshot.Version.Latest = strings.TrimPrefix(release.TagName, "v")
	return ""
}
