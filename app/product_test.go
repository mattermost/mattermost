// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/app/platform"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/stretchr/testify/require"
)

const (
	testSrvKey1 = "test_1"
	testSrvKey2 = "test_2"
)

type productA struct{}

func newProductA(m map[product.ServiceKey]any) (product.Product, error) {
	m[testSrvKey1] = nil
	return &productA{}, nil
}

func (p *productA) Start() error { return nil }
func (p *productA) Stop() error  { return nil }

type productB struct{}

func newProductB(m map[product.ServiceKey]any) (product.Product, error) {
	m[testSrvKey2] = nil
	return &productB{}, nil
}

func (p *productB) Start() error { return nil }
func (p *productB) Stop() error  { return nil }

func TestInitializeProducts(t *testing.T) {
	ps, err := platform.New(platform.ServiceConfig{ConfigStore: config.NewTestMemoryStore()})
	require.NoError(t, err)

	t.Run("2 products and no circular dependency", func(t *testing.T) {
		serviceMap := map[product.ServiceKey]any{
			product.ConfigKey:    nil,
			product.LicenseKey:   nil,
			product.FilestoreKey: nil,
			product.ClusterKey:   nil,
		}

		products := map[string]product.Manifest{
			"productA": {
				Initializer: newProductA,
				Dependencies: map[product.ServiceKey]struct{}{
					product.ConfigKey:    {},
					product.LicenseKey:   {},
					product.FilestoreKey: {},
					product.ClusterKey:   {},
				},
			},
			"productB": {
				Initializer: newProductB,
				Dependencies: map[product.ServiceKey]struct{}{
					product.ConfigKey:    {},
					testSrvKey1:          {},
					product.FilestoreKey: {},
					product.ClusterKey:   {},
				},
			},
		}

		server := &Server{
			Products: make(map[string]product.Product),
			platform: ps,
		}

		err = server.initializeProducts(products, serviceMap)
		require.NoError(t, err)
		require.Len(t, server.Products, 2)
	})

	t.Run("2 products and circular dependency", func(t *testing.T) {
		serviceMap := map[product.ServiceKey]any{
			product.ConfigKey:    nil,
			product.LicenseKey:   nil,
			product.FilestoreKey: nil,
			product.ClusterKey:   nil,
		}

		products := map[string]product.Manifest{
			"productA": {
				Initializer: newProductA,
				Dependencies: map[product.ServiceKey]struct{}{
					product.ConfigKey:    {},
					product.LicenseKey:   {},
					product.FilestoreKey: {},
					product.ClusterKey:   {},
					testSrvKey2:          {},
				},
			},
			"productB": {
				Initializer: newProductB,
				Dependencies: map[product.ServiceKey]struct{}{
					product.ConfigKey:    {},
					testSrvKey1:          {},
					product.FilestoreKey: {},
					product.ClusterKey:   {},
				},
			},
		}
		server := &Server{
			Products: make(map[string]product.Product),
			platform: ps,
		}

		err := server.initializeProducts(products, serviceMap)
		require.Error(t, err)
	})

	t.Run("2 products and one w/o any dependency", func(t *testing.T) {
		serviceMap := map[product.ServiceKey]any{
			product.ConfigKey:    nil,
			product.LicenseKey:   nil,
			product.FilestoreKey: nil,
			product.ClusterKey:   nil,
		}

		products := map[string]product.Manifest{
			"productA": {
				Initializer: newProductA,
				Dependencies: map[product.ServiceKey]struct{}{
					product.ConfigKey:  {},
					product.LicenseKey: {},
				},
			},
			"productB": {
				Initializer: newProductB,
			},
		}
		server := &Server{
			Products: make(map[string]product.Product),
			platform: ps,
		}

		err := server.initializeProducts(products, serviceMap)
		require.NoError(t, err)
		require.Len(t, server.Products, 2)
	})

	t.Run("boards product to be blocked", func(t *testing.T) {
		products := map[string]product.Manifest{
			"productA": {
				Initializer: newProductA,
			},
			"boards": {
				Initializer: newProductB,
			},
		}

		server := &Server{
			products: make(map[string]product.Product),
			platform: ps,
		}

		err := server.initializeProducts(products, map[product.ServiceKey]any{})
		require.NoError(t, err)
		require.Len(t, server.products, 1)
	})
}
