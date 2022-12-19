// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

type Product interface {
	Start() error
	Stop() error
}

type Manifest struct {
	Initializer  func(map[ServiceKey]any) (Product, error)
	Dependencies map[ServiceKey]struct{}
}

var products = make(map[string]Manifest)

func RegisterProduct(name string, m Manifest) {
	products[name] = m
}

func GetProducts() map[string]Manifest {
	return products
}
