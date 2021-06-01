// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package driver

import (
	"context"
	// "database/sql"
	"database/sql/driver"

	"github.com/mattermost/mattermost-server/v5/plugin"
)

var (
	// Compile-time check to ensure Connector implements the interface.
	_ driver.Connector = &Connector{}
)

// Connector is the DB connector which is used to
// initialize the underlying DB.
type Connector struct {
	// driverName string
	// dsn        string
	// db         *sql.DB
	api plugin.Driver
}

func NewConnector(api plugin.Driver) (*Connector, error) {
	// db, err := sql.Open(driverName, dsn)
	// if err != nil {
	// 	return nil, err
	// }
	return &Connector{
		// driverName: driverName,
		// dsn:        dsn,
		// db:         db,
		api: api,
	}, nil
}

func (c *Connector) Connect(_ context.Context) (driver.Conn, error) {
	connID, err := c.api.Conn()
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
