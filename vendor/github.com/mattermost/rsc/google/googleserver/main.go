// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	//	"flag"
	"bufio"
	"fmt"
	"log"
	"net"
	"net/rpc"
	"os"
	"strings"
	"syscall"

	"github.com/mattermost/rsc/google"
	"github.com/mattermost/rsc/xmpp"
)

func main() {
	google.ReadConfig()
	switch os.Args[1] {
	case "add":
		google.Cfg.Account = append(google.Cfg.Account, &google.Account{Email: os.Args[2], Password: os.Args[3]})
		google.WriteConfig()
	case "serve":
		serve()
	case "accounts":
		c, err := google.Dial()
		if err != nil {
			log.Fatal(err)
		}
		out, err := c.Accounts()
		if err != nil {
			log.Fatal(err)
		}
		for _, email := range out {
			fmt.Printf("%s\n", email)
		}
	case "ping":
		c, err := google.Dial()
		if err != nil {
			log.Fatal(err)
		}
		if err := c.Ping(); err != nil {
			log.Fatal(err)
		}
	case "chat":
		c, err := google.Dial()
		if err != nil {
			log.Fatal(err)
		}
		cid := &google.ChatID{ID: "1", Email: os.Args[2], Status: xmpp.Available, StatusMsg: ""}
		go chatRecv(c, cid)
		c.ChatRoster(cid)
		b := bufio.NewReader(os.Stdin)
		for {
			line, err := b.ReadString('\n')
			if err != nil {
				log.Fatal(err)
			}
			line = line[:len(line)-1]
			i := strings.Index(line, ": ")
			if i < 0 {
				log.Printf("<who>: <msg>, please")
				continue
			}
			who, msg := line[:i], line[i+2:]
			if err := c.ChatSend(cid, &xmpp.Chat{Remote: who, Type: "chat", Text: msg}); err != nil {
				log.Fatal(err)
			}
		}
	}
}

func chatRecv(c *google.Client, cid *google.ChatID) {
	for {
		msg, err := c.ChatRecv(cid)
		if err != nil {
			log.Fatal(err)
		}
		switch msg.Type {
		case "roster":
			for _, contact := range msg.Roster {
				fmt.Printf("%v\n", contact)
			}
		case "presence":
			fmt.Printf("%v\n", msg.Presence)
		case "chat":
			fmt.Printf("%s: %s\n", msg.Remote, msg.Text)
		default:
			fmt.Printf("<%s>\n", msg.Type)
		}
	}
}

func listen() net.Listener {
	socket := google.Dir() + "/socket"
	os.Remove(socket)
	l, err := net.Listen("unix", socket)
	if err != nil {
		log.Fatal(err)
	}
	return l
}

func serve() {
	f, err := os.OpenFile(google.Dir()+"/log", os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0600)
	if err != nil {
		log.Fatal(err)
	}
	log.SetOutput(f)
	syscall.Dup2(f.Fd(), 2)
	os.Stdout = f
	os.Stderr = f
	l := listen()
	rpc.RegisterName("goog", &Server{})
	rpc.Accept(l)
	log.Fatal("rpc.Accept finished: server exiting")
}

type Server struct{}

type Empty google.Empty

func (*Server) Ping(*Empty, *Empty) error {
	return nil
}

func (*Server) Accounts(_ *Empty, out *[]string) error {
	var email []string
	for _, a := range google.Cfg.Account {
		email = append(email, a.Email)
	}
	*out = email
	return nil
}
