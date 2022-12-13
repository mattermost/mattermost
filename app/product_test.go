// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/app/platform"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/stretchr/testify/require"
)

const (
	testSrvKey1 = "test_1"
	testSrvKey2 = "test_2"
)

type productA struct{}

func newProductA(s *Server, m map[ServiceKey]any) (Product, error) {
	m[testSrvKey1] = nil
	return &productA{}, nil
}

func (p *productA) Start() error { return nil }
func (p *productA) Stop() error  { return nil }

type productB struct{}

func newProductB(s *Server, m map[ServiceKey]any) (Product, error) {
	m[testSrvKey2] = nil
	return &productB{}, nil
}

func (p *productB) Start() error { return nil }
func (p *productB) Stop() error  { return nil }

func TestInitializeProducts(t *testing.T) {
	ps, err := platform.New(platform.ServiceConfig{ConfigStore: config.NewTestMemoryStore()})
	require.NoError(t, err)

	t.Run("2 products and no circular dependency", func(t *testing.T) {
		serviceMap := map[ServiceKey]any{
			ConfigKey:    nil,
			LicenseKey:   nil,
			FilestoreKey: nil,
			ClusterKey:   nil,
		}

		products := map[string]ProductManifest{
			"productA": {
				Initializer: newProductA,
				Dependencies: map[ServiceKey]struct{}{
					ConfigKey:    {},
					LicenseKey:   {},
					FilestoreKey: {},
					ClusterKey:   {},
				},
			},
			"productB": {
				Initializer: newProductB,
				Dependencies: map[ServiceKey]struct{}{
					ConfigKey:    {},
					testSrvKey1:  {},
					FilestoreKey: {},
					ClusterKey:   {},
				},
			},
		}

		server := &Server{
			products: make(map[string]Product),
			platform: ps,
		}

		err = server.initializeProducts(products, serviceMap)
		require.NoError(t, err)
		require.Len(t, server.products, 2)
	})

	t.Run("2 products and circular dependency", func(t *testing.T) {
		serviceMap := map[ServiceKey]any{
			ConfigKey:    nil,
			LicenseKey:   nil,
			FilestoreKey: nil,
			ClusterKey:   nil,
		}

		products := map[string]ProductManifest{
			"productA": {
				Initializer: newProductA,
				Dependencies: map[ServiceKey]struct{}{
					ConfigKey:    {},
					LicenseKey:   {},
					FilestoreKey: {},
					ClusterKey:   {},
					testSrvKey2:  {},
				},
			},
			"productB": {
				Initializer: newProductB,
				Dependencies: map[ServiceKey]struct{}{
					ConfigKey:    {},
					testSrvKey1:  {},
					FilestoreKey: {},
					ClusterKey:   {},
				},
			},
		}
		server := &Server{
			products: make(map[string]Product),
			platform: ps,
		}

		err := server.initializeProducts(products, serviceMap)
		require.Error(t, err)
	})

	t.Run("2 products and one w/o any dependency", func(t *testing.T) {
		serviceMap := map[ServiceKey]any{
			ConfigKey:    nil,
			LicenseKey:   nil,
			FilestoreKey: nil,
			ClusterKey:   nil,
		}

		products := map[string]ProductManifest{
			"productA": {
				Initializer: newProductA,
				Dependencies: map[ServiceKey]struct{}{
					ConfigKey:  {},
					LicenseKey: {},
				},
			},
			"productB": {
				Initializer: newProductB,
			},
		}
		server := &Server{
			products: make(map[string]Product),
			platform: ps,
		}

		err := server.initializeProducts(products, serviceMap)
		require.NoError(t, err)
		require.Len(t, server.products, 2)
	})

	t.Run("boards product to be blocked", func(t *testing.T) {
		products := map[string]ProductManifest{
			"productA": {
				Initializer: newProductA,
			},
			"boards": {
				Initializer: newProductB,
			},
		}

		server := &Server{
			products: make(map[string]Product),
			platform: ps,
		}

		err := server.initializeProducts(products, map[ServiceKey]any{})
		require.NoError(t, err)
		require.Len(t, server.products, 1)
	})
}
