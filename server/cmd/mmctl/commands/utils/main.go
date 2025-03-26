package utils

import (
	"context"
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
)

func GetConfig(c client.Client, context context.Context) (*model.Config, error) {
	config, response, err := c.GetConfig(context)
	if err != nil || response.StatusCode < 200 || response.StatusCode >= 300 {
		if err != nil {
			return nil, err
		}
		return nil, errors.New(fmt.Sprintf("Wrong response client: code: %d", response.StatusCode))
	}

	return config, nil
}
