// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/pkg/errors"
)

type Product interface {
	Start() error
	Stop() error
}

type ProductInitializer func(*Server, map[ServiceKey]interface{}) (Product, error)

var products = make(map[string]ProductInitializer)

var dependencies = make(map[string]map[ServiceKey]struct{})

func RegisterProduct(name string, f ProductInitializer) {
	products[name] = f
}

func RegisterProductDependencies(name string, dependencyMap map[ServiceKey]struct{}) {
	dependencies[name] = dependencyMap
}

func (s *Server) initializeProducts(
	productMap map[string]ProductInitializer,
	serviceMap map[ServiceKey]interface{},
	dependencyMap map[string]map[ServiceKey]struct{},
) error {
	// create a product map to consume
	pmap := make(map[string]struct{})
	for name := range productMap {
		pmap[name] = struct{}{}
	}

	maxTry := len(pmap) * len(pmap)

	for len(pmap) > 0 && maxTry != 0 {
	initLoop:
		for product := range pmap {
			productDependencies, ok := dependencyMap[product]
			if ok {
				// we have dependencies defined. Here we check if the serviceMap
				// has all the dependencies registered. If not, we continue to the
				// loop to let other products initialize and register their services
				// if they have any.
				for key := range productDependencies {
					if _, ok := serviceMap[key]; !ok {
						maxTry--
						continue initLoop
					}
				}
			}

			// some products can register themselves/their services
			initializer := productMap[product]
			prod, err2 := initializer(s, serviceMap)
			if err2 != nil {
				return errors.Wrapf(err2, "error initializing product: %s", product)
			}
			s.products[product] = prod

			// we remove this product from the map to not try to initialize it again
			delete(pmap, product)
		}
	}

	if maxTry == 0 && len(pmap) != 0 {
		return errors.New("could not initialize products, possible circular dependency occurred")
	}

	return nil
}
