package main

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// roundRobinProxy stands in for the load balancer in front of an HA cluster.
// It serves the cluster's SiteURL and spreads requests over the nodes marked up.
type roundRobinProxy struct {
	mu       sync.Mutex
	backends []*proxyBackend
	next     int
	srv      *http.Server
}

type proxyBackend struct {
	url   string
	up    bool
	proxy *httputil.ReverseProxy
}

// startRoundRobinProxy listens on the port of siteURL. All backends start down.
func startRoundRobinProxy(logger *mlog.Logger, siteURL string, backendURLs []string) (*roundRobinProxy, error) {
	site, err := url.Parse(siteURL)
	if err != nil {
		return nil, fmt.Errorf("parse %q: %w", siteURL, err)
	}
	if site.Port() == "" {
		return nil, fmt.Errorf("%q has no port to listen on", siteURL)
	}

	p := &roundRobinProxy{}
	for _, raw := range backendURLs {
		target, err := url.Parse(raw)
		if err != nil {
			return nil, fmt.Errorf("parse %q: %w", raw, err)
		}
		p.backends = append(p.backends, &proxyBackend{
			url: raw,
			proxy: &httputil.ReverseProxy{
				Rewrite: func(r *httputil.ProxyRequest) {
					r.SetURL(target)
					r.SetXForwarded()
				},
			},
		})
	}

	ln, err := net.Listen("tcp", ":"+site.Port())
	if err != nil {
		return nil, err
	}
	p.srv = &http.Server{Handler: p}
	go func() {
		if err := p.srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Proxy stopped", mlog.String("url", siteURL), mlog.Err(err))
		}
	}()
	return p, nil
}

func (p *roundRobinProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	b := p.pick()
	if b == nil {
		http.Error(w, "no cluster nodes available", http.StatusServiceUnavailable)
		return
	}
	b.proxy.ServeHTTP(w, r)
}

func (p *roundRobinProxy) pick() *proxyBackend {
	p.mu.Lock()
	defer p.mu.Unlock()
	for range p.backends {
		b := p.backends[p.next%len(p.backends)]
		p.next++
		if b.up {
			return b
		}
	}
	return nil
}

func (p *roundRobinProxy) setUp(backendURL string, up bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, b := range p.backends {
		if b.url == backendURL {
			b.up = up
		}
	}
}

func (p *roundRobinProxy) Close() {
	_ = p.srv.Close()
}
