// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

// Valid: consistent receiver names
type ValidServer struct {
	name string
}

func (s *ValidServer) Start() {
}

func (s *ValidServer) Stop() {
}

func (s *ValidServer) GetName() string {
	return s.name
}

// Invalid: inconsistent receiver names
type InvalidServer struct {
	name string
}

func (s *InvalidServer) Start() {
}

func (srv *InvalidServer) Stop() { // want "Different receiver name used for the struct \"InvalidServer\" in different methods"
}

func (server *InvalidServer) GetName() string { // want "Different receiver name used for the struct \"InvalidServer\" in different methods"
	return server.name
}

// Valid: different structs can use different receiver names
type Client struct{}

func (c *Client) Connect() {
}

func (c *Client) Disconnect() {
}

// Invalid: more than two different receiver names
type Database struct{}

func (d *Database) Open() {
}

func (db *Database) Close() { // want "Different receiver name used for the struct \"Database\" in different methods"
}

func (database *Database) Query() { // want "Different receiver name used for the struct \"Database\" in different methods"
}

// Valid: non-pointer receivers
type Counter struct {
	count int
}

func (c Counter) Increment() Counter {
	c.count++
	return c
}

func (c Counter) Get() int {
	return c.count
}
