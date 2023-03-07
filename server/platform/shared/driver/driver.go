// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// package driver implements a DB driver that can be used by plugins
// to make SQL queries using RPC. This helps to avoid opening new connections
// for every plugin, and lets everyone use the central connection
// pool in the server.
// The tests for this package are at app/plugin_api_tests/test_db_driver/main.go.
package driver

import (
	"context"
	"database/sql/driver"

	"github.com/mattermost/mattermost-server/server/v7/plugin"
)

var (
	// Compile-time check to ensure Connector implements the interface.
	_ driver.Connector = &Connector{}
)

// Connector is the DB connector which is used to
// communicate with the DB API.
type Connector struct {
	api      plugin.Driver
	isMaster bool
}

// NewConnector returns a DB connector that can be used to return a sql.DB object.
// It takes a plugin.Driver implementation and a boolean flag to indicate whether
// to connect to a master or replica DB instance.
func NewConnector(api plugin.Driver, isMaster bool) *Connector {
	return &Connector{api: api, isMaster: isMaster}
}

func (c *Connector) Connect(_ context.Context) (driver.Conn, error) {
	connID, err := c.api.Conn(c.isMaster)
	if err != nil {
		return nil, err
	}

	return &Conn{id: connID, api: c.api}, nil
}

func (c *Connector) Driver() driver.Driver {
	return &Driver{c: c}
}

// Driver is a DB driver implementation.
type Driver struct {
	c *Connector
}

func (d Driver) Open(name string) (driver.Conn, error) {
	return d.c.Connect(context.Background())
}
