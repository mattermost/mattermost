// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/server/v8/channels/product"
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

	// We figure out the initialization order by trial and error fashion hence maxTry
	// is the maximum possible trials of initialization attempts. The order is not
	// determined elsewhere therefore we do a on the fly sorting here. Which means the
	// initialization order will be resolved during the loop.
	maxTry := len(pmap) * len(pmap)

	for len(pmap) > 0 && maxTry != 0 {
	initLoop:
		for product := range pmap {
			manifest := productMap[product]
			// we have dependencies defined. Here we check if the serviceMap
			// has all the dependencies registered. If not, we continue to the
			// loop to let other products initialize and register their services
			// if they have any.
			for key := range manifest.Dependencies {
				if _, ok := serviceMap[key]; !ok {
					maxTry--
					continue initLoop
				}
			}

			// some products can register themselves/their services
			initializer := manifest.Initializer
			prod, err := initializer(serviceMap)
			if err != nil {
				return fmt.Errorf("error initializing product %q: %w", product, err)
			}
			s.products[product] = prod

			// we remove this product from the map to not try to initialize it again
			delete(pmap, product)
		}
	}

	if maxTry == 0 && len(pmap) != 0 {
		var products string
		for p := range pmap {
			products = strings.Join([]string{products, fmt.Sprintf("%q", p)}, " ")
		}
		return fmt.Errorf("could not initialize product(s) due to circular dependency: %s", products)
	}

	return nil
}

func (s *Server) shouldStart(product string) bool {
	if !s.Config().FeatureFlags.BoardsProduct && product == "boards" {
		return false
	}

	return true
}

func (s *Server) HasBoardProduct() (bool, error) {
	prod, exists := s.services[product.BoardsKey]
	if !exists {
		return false, nil
	}
	if prod == nil {
		return false, errors.New("board product is nil")
	}
	if _, ok := prod.(product.BoardsService); !ok {
		return false, errors.New("board product key does not match its definition")
	}
	return true, nil
}

func (a *App) HasBoardProduct() (bool, error) {
	return a.Srv().HasBoardProduct()
}
