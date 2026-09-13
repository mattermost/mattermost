// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

type CategoriesService struct {
	client *Client
}

// CategoriesIsFavoriteOptions specifies the optional parameters to the
// CategoriesService.IsFavorite method
type CategoriesIsFavoriteOptions struct {
	TeamId   string `url:"team_id,omitempty"`
	ItemId   string `url:"item_id,omitempty"`
	ItemType string `url:"type,omitempty"`
}

// List the conditions for a run (read-only).
func (s *CategoriesService) IsFavorite(ctx context.Context, opts CategoriesIsFavoriteOptions) (bool, error) {
	isFavoriteURL, err := addOptions("my_categories/favorites", opts)
	if err != nil {
		return false, err
	}

	req, err := s.client.newAPIRequest(http.MethodGet, isFavoriteURL, nil)
	if err != nil {
		return false, fmt.Errorf("failed to build request: %w", err)
	}

	var isFavorite bool
	resp, err := s.client.do(ctx, req, &isFavorite)
	if err != nil {
		return false, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return isFavorite, nil
	}

	return false, fmt.Errorf("unable to get favorite status: %d", resp.StatusCode)
}
