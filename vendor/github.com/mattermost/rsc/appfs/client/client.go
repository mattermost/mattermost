// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package client implements a basic appfs client.
package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/rsc/appfs/proto"
)

type Client struct {
	Host     string
	User string
	Password string
}

func (c *Client) url(op, path string) string {
	scheme := "https"
	if strings.HasPrefix(c.Host, "localhost:") {
		scheme = "http"
	}
	if strings.HasSuffix(op, "/") && strings.HasPrefix(path, "/") {
		path = path[1:]
	}
	return scheme + "://"+ c.User + ":" + c.Password + "@" + c.Host + op + path
}

func (c *Client) do(u string) error {
	_, err := c.get(u)
	return err
}

func (c *Client) get(u string) ([]byte, error) {
	tries := 0
	for {
		r, err := http.Get(u)
		if err != nil {
			return nil, err
		}
		defer r.Body.Close()
		data, err := ioutil.ReadAll(r.Body)
		if err != nil {
			return nil, err
		}
		if r.StatusCode != 200 {
			if r.StatusCode == 500 {
				if tries++; tries < 3 {
					fmt.Printf("%s %s; sleeping\n", r.Status, data)
					time.Sleep(5*time.Second)
					continue
				}
			}
			return nil, fmt.Errorf("%s %s", r.Status, data)
		}
		return data, nil
	}
	panic("unreachable")
}

func (c *Client) post(u string, data []byte) ([]byte, error) {
	tries := 0
	for {
		r, err := http.Post(u, proto.PostContentType, bytes.NewBuffer(data))
		if err != nil {
			return nil, err
		}
		defer r.Body.Close()
		rdata, err := ioutil.ReadAll(r.Body)
		if err != nil {
			return nil, err
		}
		if r.StatusCode != 200 {
			if r.StatusCode == 500 {
				if tries++; tries < 3 {
					fmt.Printf("%s %s; sleeping\n", r.Status, rdata)
					time.Sleep(5*time.Second)
					continue
				}
			}
			return nil, fmt.Errorf("%s %s", r.Status, rdata)
		}
		return rdata, nil
	}
	panic("unreachable")
}

func (c *Client) Create(path string, isdir bool) error {
	u := c.url(proto.CreateURL, path)
	if isdir {
		u += "?dir=1"
	}
	return c.do(u)
}

func (c *Client) Read(path string) ([]byte, error) {
	return c.get(c.url(proto.ReadURL, path))
}

func (c *Client) Write(path string, data []byte) error {
	u := c.url(proto.WriteURL, path)
	_, err := c.post(u, data)
	return err
}

func (c *Client) Mkfs() error {
	return c.do(c.url(proto.MkfsURL, ""))
}

func (c *Client) Stat(path string) (*proto.FileInfo, error) {
	data, err := c.get(c.url(proto.StatURL, path))
	if err != nil {
		return nil, err
	}
	var fi proto.FileInfo
	if err := json.Unmarshal(data, &fi); err != nil {
		return nil, err
	}
	return &fi, nil
}

func (c *Client) ReadDir(path string) ([]*proto.FileInfo, error) {
	data, err := c.Read(path)
	if err != nil {
		return nil, err
	}
	dec := json.NewDecoder(bytes.NewBuffer(data))
	var out []*proto.FileInfo
	for {
		var fi proto.FileInfo
		err := dec.Decode(&fi)
		if err == io.EOF {
			break
		}
		if err != nil {
			return out, err
		}
		out = append(out, &fi)
	}
	return out, nil
}
