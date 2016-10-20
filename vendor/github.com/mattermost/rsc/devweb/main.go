// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Devweb is a simple environment for developing a web server.
// It runs its own web server on the given address and proxies
// all requests to the http server program named by importpath.
// It takes care of recompiling and restarting the program as needed.
//
// The server program should be a trivial main program like:
//
//	package main
//	
//	import (
//		"github.com/mattermost/rsc/devweb/slave"
//	
//		_ "this/package"
//		_ "that/package"
//	)
//	
//	func main() {
//		slave.Main()
//	}
//
// The import _ lines import packages that register HTTP handlers,
// like in an App Engine program.
//
// As you make changes to this/package or that/package (or their
// dependencies), devweb recompiles and relaunches the servers as
// needed to serve requests.
//
package main

// BUG(rsc): Devweb should probably 

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

func usage() {
	fmt.Fprint(os.Stderr, `usage: devweb [-addr :8000] importpath

Devweb runs a web server on the given address and proxies all requests
to the http server program named by importpath.  It takes care of
recompiling and restarting the program as needed.

The http server program must itself have a -addr argument that
says which TCP port to listen on.
`,
	)
}

var addr = flag.String("addr", ":8000", "web service address")
var rootPackage string

func main() {
	flag.Usage = usage
	flag.Parse()
	args := flag.Args()
	if len(args) != 1 {
		usage()
	}
	rootPackage = args[0]

	log.Fatal(http.ListenAndServe(*addr, http.HandlerFunc(relay)))
}

func relay(w http.ResponseWriter, req *http.Request) {
	defer func() {
		if err := recover(); err != nil {
			http.Error(w, fmt.Sprint(err), 200)
		}
	}()

	c, proxy, err := buildProxy()
	if err != nil {
		panic(err)
	}
	defer c.Close()
	_ = proxy

	outreq := new(http.Request)
	*outreq = *req // includes shallow copies of maps, but okay

	outreq.Proto = "HTTP/1.1"
	outreq.ProtoMajor = 1
	outreq.ProtoMinor = 1
	outreq.Close = false

	// Remove the connection header to the backend.  We want a
	// persistent connection, regardless of what the client sent
	// to us.  This is modifying the same underlying map from req
	// (shallow copied above) so we only copy it if necessary.
	if outreq.Header.Get("Connection") != "" {
		outreq.Header = make(http.Header)
		copyHeader(outreq.Header, req.Header)
		outreq.Header.Del("Connection")
	}

	outreq.Write(c)

	br := bufio.NewReader(c)
	resp, err := http.ReadResponse(br, outreq)
	if err != nil {
		panic(err)
	}

	copyHeader(w.Header(), resp.Header)
	w.WriteHeader(resp.StatusCode)

	if resp.Body != nil {
		io.Copy(w, resp.Body)
	}
}

func copyHeader(dst, src http.Header) {
	for k, vv := range src {
		for _, v := range vv {
			dst.Add(k, v)
		}
	}
}

type cmdProxy struct {
	cmd  *exec.Cmd
	addr string
}

func (p *cmdProxy) kill() {
	if p == nil {
		return
	}
	p.cmd.Process.Kill()
	p.cmd.Wait()
}

var proxyInfo struct {
	sync.Mutex
	build  time.Time
	check  time.Time
	active *cmdProxy
	err    error
}

func buildProxy() (c net.Conn, proxy *cmdProxy, err error) {
	p := &proxyInfo

	t := time.Now()
	p.Lock()
	defer p.Unlock()
	if t.Before(p.check) {
		// We waited for the lock while someone else dialed.
		// If we can connect, done.
		if p.active != nil {
			if c, err := net.DialTimeout("tcp", p.active.addr, 5*time.Second); err == nil {
				return c, p.active, nil
			}
		}
	}

	defer func() {
		p.err = err
		p.check = time.Now()
	}()

	pkgs, err := loadPackage(rootPackage)
	if err != nil {
		return nil, nil, fmt.Errorf("load %s: %s", rootPackage, err)
	}

	deps := pkgs[0].Deps
	if len(deps) > 0 && deps[0] == "C" {
		deps = deps[1:]
	}
	pkgs1, err := loadPackage(deps...)
	if err != nil {
		return nil, nil, fmt.Errorf("load %v: %s", deps, err)
	}
	pkgs = append(pkgs, pkgs1...)

	var latest time.Time

	for _, pkg := range pkgs {
		var files []string
		files = append(files, pkg.GoFiles...)
		files = append(files, pkg.CFiles...)
		files = append(files, pkg.HFiles...)
		files = append(files, pkg.SFiles...)
		files = append(files, pkg.CgoFiles...)

		for _, file := range files {
			if fi, err := os.Stat(filepath.Join(pkg.Dir, file)); err == nil && fi.ModTime().After(latest) {
				latest = fi.ModTime()
			}
		}
	}

	if latest.After(p.build) {
		p.active.kill()
		p.active = nil

		out, err := exec.Command("go", "build", "-o", "prox.exe", rootPackage).CombinedOutput()
		if len(out) > 0 {
			return nil, nil, fmt.Errorf("%s", out)
		}
		if err != nil {
			return nil, nil, err
		}

		p.build = latest
	}

	// If we can connect, done.
	if p.active != nil {
		if c, err := net.DialTimeout("tcp", p.active.addr, 5*time.Second); err == nil {
			return c, p.active, nil
		}
	}

	// Otherwise, start a new server.
	p.active.kill()
	p.active = nil

	l, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return nil, nil, err
	}
	addr := l.Addr().String()

	cmd := exec.Command("prox.exe", "LISTEN_STDIN")
	cmd.Stdin, err = l.(*net.TCPListener).File()
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err != nil {
		l.Close()
		return nil, nil, err
	}
	err = cmd.Start()
	l.Close()

	if err != nil {
		return nil, nil, err
	}

	c, err = net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return nil, nil, err
	}

	p.active = &cmdProxy{cmd, addr}
	return c, p.active, nil
}

type Pkg struct {
	ImportPath string
	Dir        string
	GoFiles    []string
	CFiles     []string
	HFiles     []string
	SFiles     []string
	CgoFiles   []string
	Deps       []string
}

func loadPackage(name ...string) ([]*Pkg, error) {
	args := []string{"list", "-json"}
	args = append(args, name...)
	var stderr bytes.Buffer
	cmd := exec.Command("go", args...)
	r, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	dec := json.NewDecoder(r)
	var pkgs []*Pkg
	for {
		p := new(Pkg)
		if err := dec.Decode(p); err != nil {
			if err == io.EOF {
				break
			}
			cmd.Process.Kill()
			return nil, err
		}
		pkgs = append(pkgs, p)
	}

	err = cmd.Wait()
	if b := stderr.Bytes(); len(b) > 0 {
		return nil, fmt.Errorf("%s", b)
	}
	if err != nil {
		return nil, err
	}
	if len(pkgs) != len(name) {
		return nil, fmt.Errorf("found fewer packages than expected")
	}
	return pkgs, nil
}
