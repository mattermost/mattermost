// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package releases looks up Mattermost server releases.
package releases

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// LatestURL is the GitHub endpoint for the latest server release.
const LatestURL = "https://api.github.com/repos/mattermost/mattermost-server/releases/latest"

// FetchLatest requests the release at latestURL, bounded by ctx. It uses the default transport,
// so HTTPS_PROXY and friends are honoured.
func FetchLatest(ctx context.Context, latestURL string) (*model.GithubReleaseInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, latestURL, nil)
	if err != nil {
		return nil, err
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, res.Body)
		return nil, fmt.Errorf("unexpected status code %d", res.StatusCode)
	}

	var release model.GithubReleaseInfo
	if err := json.NewDecoder(res.Body).Decode(&release); err != nil {
		return nil, err
	}

	if appErr := release.IsValid(); appErr != nil {
		return nil, appErr
	}

	return &release, nil
}

// Version returns release's version, without the tag's v prefix.
func Version(release *model.GithubReleaseInfo) string {
	return strings.TrimPrefix(release.TagName, "v")
}
