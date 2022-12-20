// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app/platform"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/product"
)

const (
	testSrvKey1 = "test_1"
	testSrvKey2 = "test_2"
	testSrvKey3 = "test_3"
)

var errMissingDependency = errors.New("missing dependency")

type productA struct{}

func newProductA(m map[product.ServiceKey]any) (product.Product, error) {
	m[testSrvKey1] = nil
	return &productA{}, nil
}

func (p *productA) Start(services map[product.ServiceKey]any) error {
	dependencies := []product.ServiceKey{
		product.ConfigKey,
		product.LicenseKey,
		product.FilestoreKey,
		product.ClusterKey,
		testSrvKey2,
	}
	return checkDependencies(dependencies, services)
}
func (p *productA) Stop() error { return nil }

type productB struct{}

func newProductB(m map[product.ServiceKey]any) (product.Product, error) {
	m[testSrvKey2] = nil
	return &productB{}, nil
}

func (p *productB) Start(services map[product.ServiceKey]any) error {
	dependencies := []product.ServiceKey{
		product.ConfigKey,
		product.LicenseKey,
		product.FilestoreKey,
		product.ClusterKey,
		testSrvKey1,
	}
	return checkDependencies(dependencies, services)
}
func (p *productB) Stop() error { return nil }

type productC struct{}

func newProductC(m map[product.ServiceKey]any) (product.Product, error) {
	m[testSrvKey3] = nil
	return &productC{}, nil
}

func (p *productC) Start(services map[product.ServiceKey]any) error {
	dependencies := []product.ServiceKey{}
	return checkDependencies(dependencies, services)
}
func (p *productC) Stop() error { return nil }

func checkDependencies(deps []product.ServiceKey, services map[product.ServiceKey]any) error {
	for _, key := range deps {
		if _, ok := services[key]; !ok {
			return errMissingDependency
		}
	}
	return nil
}

func TestInitializeProducts(t *testing.T) {
	ps, err := platform.New(platform.ServiceConfig{ConfigStore: config.NewTestMemoryStore()})
	require.NoError(t, err)

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
			},
			"productB": {
				Initializer: newProductB,
			},
		}

		server := &Server{
			products: make(map[string]product.Product),
			platform: ps,
		}

		err = server.initializeProducts(products, serviceMap)
		require.NoError(t, err)
		require.Len(t, server.products, 2)
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
			},
			"productC": {
				Initializer: newProductC,
			},
		}
		server := &Server{
			products: make(map[string]product.Product),
			platform: ps,
		}

		err := server.initializeProducts(products, serviceMap)
		require.NoError(t, err)
		require.Len(t, server.products, 2)
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
