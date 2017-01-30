// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// TODO: Something about redialing.

package google

import (
	//	"flag"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/rpc"
	"os"
	"os/exec"
	"syscall"
	"time"
)

func Dir() string {
	dir := os.Getenv("HOME") + "/.goog"
	st, err := os.Stat(dir)
	if err != nil {
		if err := os.Mkdir(dir, 0700); err != nil {
			log.Fatal(err)
		}
		st, err = os.Stat(dir)
		if err != nil {
			log.Fatal(err)
		}
	}
	if !st.IsDir() {
		log.Fatalf("%s exists but is not a directory", dir)
	}
	if st.Mode()&0077 != 0 {
		log.Fatalf("%s exists but allows group or other permissions: %#o", dir, st.Mode()&0777)
	}
	return dir
}

func Dial() (*Client, error) {
	socket := Dir() + "/socket"
	c, err := net.Dial("unix", socket)
	if err == nil {
		return &Client{rpc.NewClient(c)}, nil
	}
	log.Print("starting server")
	os.Remove(socket)
	runServer()
	for i := 0; i < 50; i++ {
		c, err = net.Dial("unix", socket)
		if err == nil {
			return &Client{rpc.NewClient(c)}, nil
		}
		time.Sleep(200e6)
		if i == 0 {
			log.Print("waiting for server...")
		}
	}
	return nil, err
}

type Client struct {
	client *rpc.Client
}

type Empty struct{}

func (g *Client) Ping() error {
	return g.client.Call("goog.Ping", &Empty{}, &Empty{})
}

func (g *Client) Accounts() ([]string, error) {
	var out []string
	if err := g.client.Call("goog.Accounts", &Empty{}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func runServer() {
	cmd := exec.Command("googleserver", "serve")
	cmd.SysProcAttr = &syscall.SysProcAttr{}
	if err := cmd.Start(); err != nil {
		log.Fatal(err)
	}
}

type Config struct {
	Account []*Account
}

type Account struct {
	Email    string
	Password string
	Nick     string
}

func (cfg *Config) AccountByEmail(email string) *Account {
	for _, a := range cfg.Account {
		if a.Email == email {
			return a
		}
	}
	return nil
}

var Cfg Config

func ReadConfig() {
	file := Dir() + "/config"
	st, err := os.Stat(file)
	if err != nil {
		return
	}
	if st.Mode()&0077 != 0 {
		log.Fatalf("%s exists but allows group or other permissions: %#o", file, st.Mode()&0777)
	}
	data, err := ioutil.ReadFile(file)
	if err != nil {
		log.Fatal(err)
	}
	Cfg = Config{}
	if err := json.Unmarshal(data, &Cfg); err != nil {
		log.Fatal(err)
	}
}

func WriteConfig() {
	file := Dir() + "/config"
	st, err := os.Stat(file)
	if err != nil {
		if err := ioutil.WriteFile(file, nil, 0600); err != nil {
			log.Fatal(err)
		}
		st, err = os.Stat(file)
		if err != nil {
			log.Fatal(err)
		}
	}
	if st.Mode()&0077 != 0 {
		log.Fatalf("%s exists but allows group or other permissions: %#o", file, st.Mode()&0777)
	}
	data, err := json.MarshalIndent(&Cfg, "", "\t")
	if err != nil {
		log.Fatal(err)
	}
	if err := ioutil.WriteFile(file, data, 0600); err != nil {
		log.Fatal(err)
	}
	st, err = os.Stat(file)
	if err != nil {
		log.Fatal(err)
	}
	if st.Mode()&0077 != 0 {
		log.Fatalf("%s allows group or other permissions after writing: %#o", file, st.Mode()&0777)
	}
}

func Acct(name string) Account {
	ReadConfig()
	if name == "" {
		if len(Cfg.Account) == 0 {
			fmt.Fprintf(os.Stderr, "no accounts configured\n")
			os.Exit(2)
		}
		return *Cfg.Account[0]
	}

	for _, a := range Cfg.Account {
		if a.Email == name || a.Nick == name {
			return *a
		}
	}
	fmt.Fprintf(os.Stderr, "cannot find account %#q", name)
	os.Exit(2)
	panic("not reached")
}
