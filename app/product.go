// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/gorilla/mux"

type Product interface {
	Start() error
	Stop() error
}

var products = make(map[string]func(*Server, *mux.Router) (Product, error))

func RegisterProduct(name string, f func(*Server, *mux.Router) (Product, error)) {
	products[name] = f
}
