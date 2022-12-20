// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v6/product"
)

func (s *Server) initializeProducts(
	productMap map[string]product.Manifest,
	serviceMap map[product.ServiceKey]any,
) error {
	// create a product map to consume
	pmap := make(map[string]struct{})
	for name := range productMap {
		if !s.shouldStart(name) {
			continue
		}
		pmap[name] = struct{}{}
	}

	// Initialize each product. Products will populate the serviceMap with services they provide.
	for product := range pmap {
		manifest := productMap[product]

		initializer := manifest.Initializer
		prod, err := initializer(serviceMap)
		if err != nil {
			return fmt.Errorf("error initializing product %q: %w", product, err)
		}
		s.products[product] = prod
	}
	return nil
}

func (s *Server) shouldStart(product string) bool {
	if !s.Config().FeatureFlags.BoardsProduct && product == "boards" {
		return false
	}

	return true
}
