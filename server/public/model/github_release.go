// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// LatestVersionURL is the GitHub endpoint for the latest server release.
const LatestVersionURL = "https://api.github.com/repos/mattermost/mattermost-server/releases/latest"

type GithubReleaseInfo struct {
	Id          int    `json:"id"`
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	CreatedAt   string `json:"created_at"`
	PublishedAt string `json:"published_at"`
	Body        string `json:"body"`
	Url         string `json:"html_url"`
}

func (g *GithubReleaseInfo) IsValid() *AppError {
	if g.Id == 0 {
		return NewAppError("GithubReleaseInfo.IsValid", NoTranslation, nil, "empty ID", http.StatusInternalServerError)
	}

	return nil
}

// FetchLatestVersion requests the release at latestVersionURL, bounded by ctx. It uses the
// default transport, so HTTPS_PROXY and friends are honoured.
func FetchLatestVersion(ctx context.Context, latestVersionURL string) (*GithubReleaseInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, latestVersionURL, nil)
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

	var release GithubReleaseInfo
	if err := json.NewDecoder(res.Body).Decode(&release); err != nil {
		return nil, err
	}

	if appErr := release.IsValid(); appErr != nil {
		return nil, appErr
	}

	return &release, nil
}
