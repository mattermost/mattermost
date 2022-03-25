// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

const (
	testSrvKey1 = "test_1"
	testSrvKey2 = "test_2"
)

type productA struct{}

func newProductA(s *Server, m map[ServiceKey]interface{}) (Product, error) {
	m[testSrvKey1] = nil
	return &productA{}, nil
}

func (p *productA) Start() error { return nil }
func (p *productA) Stop() error  { return nil }

type productB struct{}

func newProductB(s *Server, m map[ServiceKey]interface{}) (Product, error) {
	m[testSrvKey2] = nil
	return &productB{}, nil
}

func (p *productB) Start() error { return nil }
func (p *productB) Stop() error  { return nil }

func TestInitializeProducts(t *testing.T) {
	t.Run("2 products and no circular dependency", func(t *testing.T) {
		serviceMap := map[ServiceKey]interface{}{
			ConfigKey:    nil,
			LicenseKey:   nil,
			FilestoreKey: nil,
			ClusterKey:   nil,
		}

		dependencies := map[string]map[ServiceKey]struct{}{
			"productA": {
				ConfigKey:    {},
				LicenseKey:   {},
				FilestoreKey: {},
				ClusterKey:   {},
			},
			"productB": {
				ConfigKey:    {},
				testSrvKey1:  {},
				FilestoreKey: {},
				ClusterKey:   {},
			},
		}

		products := map[string]ProductInitializer{
			"productA": newProductA,
			"productB": newProductB,
		}
		server := &Server{
			products: make(map[string]Product),
		}

		err := server.initializeProducts(products, serviceMap, dependencies)
		require.NoError(t, err)
		require.Len(t, server.products, 2)
	})

	t.Run("2 products and circular dependency", func(t *testing.T) {
		serviceMap := map[ServiceKey]interface{}{
			ConfigKey:    nil,
			LicenseKey:   nil,
			FilestoreKey: nil,
			ClusterKey:   nil,
		}

		dependencies := map[string]map[ServiceKey]struct{}{
			"productA": {
				ConfigKey:    {},
				LicenseKey:   {},
				FilestoreKey: {},
				ClusterKey:   {},
				testSrvKey2:  {},
			},
			"productB": {
				ConfigKey:    {},
				testSrvKey1:  {},
				FilestoreKey: {},
				ClusterKey:   {},
			},
		}

		products := map[string]ProductInitializer{
			"productA": newProductA,
			"productB": newProductB,
		}
		server := &Server{
			products: make(map[string]Product),
		}

		err := server.initializeProducts(products, serviceMap, dependencies)
		require.Error(t, err)
	})

	t.Run("2 products and one w/o any dependency", func(t *testing.T) {
		serviceMap := map[ServiceKey]interface{}{
			ConfigKey:    nil,
			LicenseKey:   nil,
			FilestoreKey: nil,
			ClusterKey:   nil,
		}

		dependencies := map[string]map[ServiceKey]struct{}{
			"productA": {
				ConfigKey:  {},
				LicenseKey: {},
			},
		}

		products := map[string]ProductInitializer{
			"productA": newProductA,
			"productB": newProductB,
		}
		server := &Server{
			products: make(map[string]Product),
		}

		err := server.initializeProducts(products, serviceMap, dependencies)
		require.NoError(t, err)
		require.Len(t, server.products, 2)
	})
}
