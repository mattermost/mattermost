// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
)

func GetConfig(context context.Context, c client.Client) (*model.Config, error) {
	config, response, err := c.GetConfig(context)
	if err != nil || response.StatusCode < 200 || response.StatusCode >= 300 {
		if err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("wrong response client: code: %d", response.StatusCode)
	}

	return config, nil
}
