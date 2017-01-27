// Copyright 2016 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package letsencrypt obtains TLS certificates from LetsEncrypt.org.
//
// LetsEncrypt.org is a service that issues free SSL/TLS certificates to servers
// that can prove control over the given domain's DNS records or
// the servers pointed at by those records.
//
// Warning
//
// Like any other random code you find on the internet, this package should
// not be relied upon in important, production systems without thorough testing
// to ensure that it meets your needs.
//
// In the long term you should be using
// https://golang.org/x/crypto/acme/autocert instead of this package.
// Send improvements there, not here.
//
// This is a package that I wrote for my own personal web sites (swtch.com, rsc.io)
// in a hurry when my paid-for SSL certificate was expiring. It has no tests,
// has barely been used, and there is some anecdotal evidence that it does
// not properly renew certificates in a timely fashion, so servers that run for
// more than 3 months may run into trouble.
// I don't run this code anymore: to simplify maintenance, I moved the sites
// off of Ubuntu VMs and onto Google App Engine, configured with inexpensive
// long-term certificates purchased from cheapsslsecurity.com.
//
// This package was interesting primarily as an example of how simple the API
// for using LetsEncrypt.org could be made, in contrast to the low-level
// implementations that existed at the time. In that respect, it helped inform
// the design of the golang.org/x/crypto/acme/autocert package.
//
// Quick Start
//
// A complete HTTP/HTTPS web server using TLS certificates from LetsEncrypt.org,
// redirecting all HTTP access to HTTPS, and maintaining TLS certificates in a file
// letsencrypt.cache across server restarts.
//
//	package main
//
//	import (
//		"fmt"
//		"log"
//		"net/http"
//		"rsc.io/letsencrypt"
//	)
//
//	func main() {
//		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
//			fmt.Fprintf(w, "Hello, TLS!\n")
//		})
//		var m letsencrypt.Manager
//		if err := m.CacheFile("letsencrypt.cache"); err != nil {
//			log.Fatal(err)
//		}
//		log.Fatal(m.Serve())
//	}
//
// Overview
//
// The fundamental type in this package is the Manager, which
// manages obtaining and refreshing a collection of TLS certificates,
// typically for use by an HTTPS server.
// The example above shows the most basic use of a Manager.
// The use can be customized by calling additional methods of the Manager.
//
// Registration
//
// A Manager m registers anonymously with LetsEncrypt.org, including agreeing to
// the letsencrypt.org terms of service, the first time it needs to obtain a certificate.
// To register with a particular email address and with the option of a
// prompt for agreement with the terms of service, call m.Register.
//
// GetCertificate
//
// The Manager's GetCertificate method returns certificates
// from the Manager's cache, filling the cache by requesting certificates
// from LetsEncrypt.org. In this way, a server with a tls.Config.GetCertificate
// set to m.GetCertificate will demand load a certificate for any host name
// it serves. To force loading of certificates ahead of time, install m.GetCertificate
// as before but then call m.Cert for each host name.
//
// A Manager can only obtain a certificate for a given host name if it can prove
// control of that host name to LetsEncrypt.org. By default it proves control by
// answering an HTTPS-based challenge: when
// the LetsEncrypt.org servers connect to the named host on port 443 (HTTPS),
// the TLS SNI handshake must use m.GetCertificate to obtain a per-host certificate.
// The most common way to satisfy this requirement is for the host name to
// resolve to the IP address of a (single) computer running m.ServeHTTPS,
// or at least running a Go TLS server with tls.Config.GetCertificate set to m.GetCertificate.
// However, other configurations are possible. For example, a group of machines
// could use an implementation of tls.Config.GetCertificate that cached
// certificates but handled cache misses by making RPCs to a Manager m
// on an elected leader machine.
//
// In typical usage, then, the setting of tls.Config.GetCertificate to m.GetCertificate
// serves two purposes: it provides certificates to the TLS server for ordinary serving,
// and it also answers challenges to prove ownership of the domains in order to
// obtain those certificates.
//
// To force the loading of a certificate for a given host into the Manager's cache,
// use m.Cert.
//
// Persistent Storage
//
// If a server always starts with a zero Manager m, the server effectively fetches
// a new certificate for each of its host name from LetsEncrypt.org on each restart.
// This is unfortunate both because the server cannot start if LetsEncrypt.org is
// unavailable and because LetsEncrypt.org limits how often it will issue a certificate
// for a given host name (at time of writing, the limit is 5 per week for a given host name).
// To save server state proactively to a cache file and to reload the server state from
// that same file when creating a new manager, call m.CacheFile with the name of
// the file to use.
//
// For alternate storage uses, m.Marshal returns the current state of the Manager
// as an opaque string, m.Unmarshal sets the state of the Manager using a string
// previously returned by m.Marshal (usually a different m), and m.Watch returns
// a channel that receives notifications about state changes.
//
// Limits
//
// To avoid hitting basic rate limits on LetsEncrypt.org, a given Manager limits all its
// interactions to at most one request every minute, with an initial allowed burst of
// 20 requests.
//
// By default, if GetCertificate is asked for a certificate it does not have, it will in turn
// ask LetsEncrypt.org for that certificate. This opens a potential attack where attackers
// connect to a server by IP address and pretend to be asking for an incorrect host name.
// Then GetCertificate will attempt to obtain a certificate for that host, incorrectly,
// eventually hitting LetsEncrypt.org's rate limit for certificate requests and making it
// impossible to obtain actual certificates. Because servers hold certificates for months
// at a time, however, an attack would need to be sustained over a time period
// of at least a month in order to cause real problems.
//
// To mitigate this kind of attack, a given Manager limits
// itself to an average of one certificate request for a new host every three hours,
// with an initial allowed burst of up to 20 requests.
// Long-running servers will therefore stay
// within the LetsEncrypt.org limit of 300 failed requests per month.
// Certificate refreshes are not subject to this limit.
//
// To eliminate the attack entirely, call m.SetHosts to enumerate the exact set
// of hosts that are allowed in certificate requests.
//
// Web Servers
//
// The basic requirement for use of a Manager is that there be an HTTPS server
// running on port 443 and calling m.GetCertificate to obtain TLS certificates.
// Using standard primitives, the way to do this is:
//
//	srv := &http.Server{
//		Addr: ":https",
//		TLSConfig: &tls.Config{
//			GetCertificate: m.GetCertificate,
//		},
//	}
//	srv.ListenAndServeTLS("", "")
//
// However, this pattern of serving HTTPS with demand-loaded TLS certificates
// comes up enough to wrap into a single method m.ServeHTTPS.
//
// Similarly, many HTTPS servers prefer to redirect HTTP clients to the HTTPS URLs.
// That functionality is provided by RedirectHTTP.
//
// The combination of serving HTTPS with demand-loaded TLS certificates and
// serving HTTPS redirects to HTTP clients is provided by m.Serve, as used in
// the original example above.
//
package letsencrypt

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/time/rate"

	"github.com/xenolf/lego/acme"
)

const letsEncryptURL = "https://acme-v01.api.letsencrypt.org/directory"
const debug = false

// A Manager m takes care of obtaining and refreshing a collection of TLS certificates
// obtained by LetsEncrypt.org.
//  The zero Manager is not yet registered with LetsEncrypt.org and has no TLS certificates
// but is nonetheless ready for use.
// See the package comment for an overview of how to use a Manager.
type Manager struct {
	mu           sync.Mutex
	state        state
	rateLimit    *rate.Limiter
	newHostLimit *rate.Limiter
	certCache    map[string]*cacheEntry
	certTokens   map[string]*tls.Certificate
	watchChan    chan struct{}
}

// Serve runs an HTTP/HTTPS web server using TLS certificates obtained by the manager.
// The HTTP server redirects all requests to the HTTPS server.
// The HTTPS server obtains TLS certificates as needed and responds to requests
// by invoking http.DefaultServeMux.
//
// Serve does not return unitil the HTTPS server fails to start or else stops.
// Either way, Serve can only return a non-nil error, never nil.
func (m *Manager) Serve() error {
	l, err := net.Listen("tcp", ":http")
	if err != nil {
		return err
	}
	defer l.Close()
	go http.Serve(l, http.HandlerFunc(RedirectHTTP))

	return m.ServeHTTPS()
}

// ServeHTTPS runs an HTTPS web server using TLS certificates obtained by the manager.
// The HTTPS server obtains TLS certificates as needed and responds to requests
// by invoking http.DefaultServeMux.
// ServeHTTPS does not return unitil the HTTPS server fails to start or else stops.
// Either way, ServeHTTPS can only return a non-nil error, never nil.
func (m *Manager) ServeHTTPS() error {
	srv := &http.Server{
		Addr: ":https",
		TLSConfig: &tls.Config{
			GetCertificate: m.GetCertificate,
		},
	}
	return srv.ListenAndServeTLS("", "")
}

// RedirectHTTP is an HTTP handler (suitable for use with http.HandleFunc)
// that responds to all requests by redirecting to the same URL served over HTTPS.
// It should only be invoked for requests received over HTTP.
func RedirectHTTP(w http.ResponseWriter, r *http.Request) {
	if r.TLS != nil || r.Host == "" {
		http.Error(w, "not found", 404)
	}

	u := r.URL
	u.Host = r.Host
	u.Scheme = "https"
	http.Redirect(w, r, u.String(), 302)
}

// state is the serializable state for the Manager.
// It also implements acme.User.
type state struct {
	Email string
	Reg   *acme.RegistrationResource
	Key   string
	key   *ecdsa.PrivateKey
	Hosts []string
	Certs map[string]stateCert
}

func (s *state) GetEmail() string                            { return s.Email }
func (s *state) GetRegistration() *acme.RegistrationResource { return s.Reg }
func (s *state) GetPrivateKey() crypto.PrivateKey            { return s.key }

type stateCert struct {
	Cert string
	Key  string
}

func (cert stateCert) toTLS() (*tls.Certificate, error) {
	c, err := tls.X509KeyPair([]byte(cert.Cert), []byte(cert.Key))
	if err != nil {
		return nil, err
	}
	return &c, err
}

type cacheEntry struct {
	host string
	m    *Manager

	mu         sync.Mutex
	cert       *tls.Certificate
	timeout    time.Time
	refreshing bool
	err        error
}

func (m *Manager) init() {
	m.mu.Lock()
	if m.certCache == nil {
		m.rateLimit = rate.NewLimiter(rate.Every(1*time.Minute), 20)
		m.newHostLimit = rate.NewLimiter(rate.Every(3*time.Hour), 20)
		m.certCache = map[string]*cacheEntry{}
		m.certTokens = map[string]*tls.Certificate{}
		m.watchChan = make(chan struct{}, 1)
		m.watchChan <- struct{}{}
	}
	m.mu.Unlock()
}

// Watch returns the manager's watch channel,
// which delivers a notification after every time the
// manager's state (as exposed by Marshal and Unmarshal) changes.
// All calls to Watch return the same watch channel.
//
// The watch channel includes notifications about changes
// before the first call to Watch, so that in the pattern below,
// the range loop executes once immediately, saving
// the result of setup (along with any background updates that
// may have raced in quickly).
//
//	m := new(letsencrypt.Manager)
//	setup(m)
//	go backgroundUpdates(m)
//	for range m.Watch() {
//		save(m.Marshal())
//	}
//
func (m *Manager) Watch() <-chan struct{} {
	m.init()
	m.updated()
	return m.watchChan
}

func (m *Manager) updated() {
	select {
	case m.watchChan <- struct{}{}:
	default:
	}
}

func (m *Manager) CacheFile(name string) error {
	f, err := os.OpenFile(name, os.O_RDWR|os.O_CREATE, 0600)
	if err != nil {
		return err
	}
	f.Close()
	data, err := ioutil.ReadFile(name)
	if err != nil {
		return err
	}
	if len(data) > 0 {
		if err := m.Unmarshal(string(data)); err != nil {
			return err
		}
	}
	go func() {
		for range m.Watch() {
			err := ioutil.WriteFile(name, []byte(m.Marshal()), 0600)
			if err != nil {
				log.Printf("writing letsencrypt cache: %v", err)
			}
		}
	}()
	return nil
}

// Registered reports whether the manager has registered with letsencrypt.org yet.
func (m *Manager) Registered() bool {
	m.init()
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.registered()
}

func (m *Manager) registered() bool {
	return m.state.Reg != nil && m.state.Reg.Body.Agreement != ""
}

// Register registers the manager with letsencrypt.org, using the given email address.
// Registration may require agreeing to the letsencrypt.org terms of service.
// If so, Register calls prompt(url) where url is the URL of the terms of service.
// Prompt should report whether the caller agrees to the terms.
// A nil prompt func is taken to mean that the user always agrees.
// The email address is sent to LetsEncrypt.org but otherwise unchecked;
// it can be omitted by passing the empty string.
//
// Calling Register is only required to make sure registration uses a
// particular email address or to insert an explicit prompt into the
// registration sequence. If the manager is not registered, it will
// automatically register with no email address and automatic
// agreement to the terms of service at the first call to Cert or GetCertificate.
func (m *Manager) Register(email string, prompt func(string) bool) error {
	m.init()
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.register(email, prompt)
}

func (m *Manager) register(email string, prompt func(string) bool) error {
	if m.registered() {
		return fmt.Errorf("already registered")
	}
	m.state.Email = email
	if m.state.key == nil {
		key, err := newKey()
		if err != nil {
			return fmt.Errorf("generating key: %v", err)
		}
		Key, err := marshalKey(key)
		if err != nil {
			return fmt.Errorf("generating key: %v", err)
		}
		m.state.key = key
		m.state.Key = string(Key)
	}

	c, err := acme.NewClient(letsEncryptURL, &m.state, acme.EC256)
	if err != nil {
		return fmt.Errorf("create client: %v", err)
	}
	reg, err := c.Register()
	if err != nil {
		return fmt.Errorf("register: %v", err)
	}

	m.state.Reg = reg
	if reg.Body.Agreement == "" {
		if prompt != nil && !prompt(reg.TosURL) {
			return fmt.Errorf("did not agree to TOS")
		}
		if err := c.AgreeToTOS(); err != nil {
			return fmt.Errorf("agreeing to TOS: %v", err)
		}
	}

	m.updated()

	return nil
}

// Marshal returns an encoding of the manager's state,
// suitable for writing to disk and reloading by calling Unmarshal.
// The state includes registration status, the configured host list
// from SetHosts, and all known certificates, including their private
// cryptographic keys.
// Consequently, the state should be kept private.
func (m *Manager) Marshal() string {
	m.init()
	m.mu.Lock()
	js, err := json.MarshalIndent(&m.state, "", "\t")
	m.mu.Unlock()
	if err != nil {
		panic("unexpected json.Marshal failure")
	}
	return string(js)
}

// Unmarshal restores the state encoded by a previous call to Marshal
// (perhaps on a different Manager in a different program).
func (m *Manager) Unmarshal(enc string) error {
	m.init()
	var st state
	if err := json.Unmarshal([]byte(enc), &st); err != nil {
		return err
	}
	if st.Key != "" {
		key, err := unmarshalKey(st.Key)
		if err != nil {
			return err
		}
		st.key = key
	}
	m.mu.Lock()
	m.state = st
	m.mu.Unlock()
	for host, cert := range m.state.Certs {
		c, err := cert.toTLS()
		if err != nil {
			log.Printf("letsencrypt: ignoring entry for %s: %v", host, err)
			continue
		}
		m.certCache[host] = &cacheEntry{host: host, m: m, cert: c}
	}
	m.updated()
	return nil
}

// SetHosts sets the manager's list of known host names.
// If the list is non-nil, the manager will only ever attempt to acquire
// certificates for host names on the list.
// If the list is nil, the manager does not restrict the hosts it will
// ask for certificates for.
func (m *Manager) SetHosts(hosts []string) {
	m.init()
	m.mu.Lock()
	m.state.Hosts = append(m.state.Hosts[:0], hosts...)
	m.mu.Unlock()
	m.updated()
}

// GetCertificate can be placed a tls.Config's GetCertificate field to make
// the TLS server use Let's Encrypt certificates.
// Each time a client connects to the TLS server expecting a new host name,
// the TLS server's call to GetCertificate will trigger an exchange with the
// Let's Encrypt servers to obtain that certificate, subject to the manager rate limits.
//
// As noted in the Manager's documentation comment,
// to obtain a certificate for a given host name, that name
// must resolve to a computer running a TLS server on port 443
// that obtains TLS SNI certificates by calling m.GetCertificate.
// In the standard usage, then, installing m.GetCertificate in the tls.Config
// both automatically provisions the TLS certificates needed for
// ordinary HTTPS service and answers the challenges from LetsEncrypt.org.
func (m *Manager) GetCertificate(clientHello *tls.ClientHelloInfo) (*tls.Certificate, error) {
	m.init()

	host := clientHello.ServerName

	if debug {
		log.Printf("GetCertificate %s", host)
	}

	if strings.HasSuffix(host, ".acme.invalid") {
		m.mu.Lock()
		cert := m.certTokens[host]
		m.mu.Unlock()
		if cert == nil {
			return nil, fmt.Errorf("unknown host")
		}
		return cert, nil
	}

	return m.Cert(host)
}

// Cert returns the certificate for the given host name, obtaining a new one if necessary.
//
// As noted in the documentation for Manager and for the GetCertificate method,
// obtaining a certificate requires that m.GetCertificate be associated with host.
// In most servers, simply starting a TLS server with a configuration referring
// to m.GetCertificate is sufficient, and Cert need not be called.
//
// The main use of Cert is to force the manager to obtain a certificate
// for a particular host name ahead of time.
func (m *Manager) Cert(host string) (*tls.Certificate, error) {
	host = strings.ToLower(host)
	if debug {
		log.Printf("Cert %s", host)
	}

	m.init()
	m.mu.Lock()
	if !m.registered() {
		m.register("", nil)
	}

	ok := false
	if m.state.Hosts == nil {
		ok = true
	} else {
		for _, h := range m.state.Hosts {
			if host == h {
				ok = true
				break
			}
		}
	}
	if !ok {
		m.mu.Unlock()
		return nil, fmt.Errorf("unknown host")
	}

	// Otherwise look in our cert cache.
	entry, ok := m.certCache[host]
	if !ok {
		r := m.rateLimit.Reserve()
		ok := r.OK()
		if ok {
			ok = m.newHostLimit.Allow()
			if !ok {
				r.Cancel()
			}
		}
		if !ok {
			m.mu.Unlock()
			return nil, fmt.Errorf("rate limited")
		}
		entry = &cacheEntry{host: host, m: m}
		m.certCache[host] = entry
	}
	m.mu.Unlock()

	entry.mu.Lock()
	defer entry.mu.Unlock()
	entry.init()
	if entry.err != nil {
		return nil, entry.err
	}
	return entry.cert, nil
}

func (e *cacheEntry) init() {
	if e.err != nil && time.Now().Before(e.timeout) {
		return
	}
	if e.cert != nil {
		if e.timeout.IsZero() {
			t, err := certRefreshTime(e.cert)
			if err != nil {
				e.err = err
				e.timeout = time.Now().Add(1 * time.Minute)
				e.cert = nil
				return
			}
			e.timeout = t
		}
		if time.Now().After(e.timeout) && !e.refreshing {
			e.refreshing = true
			go e.refresh()
		}
		return
	}

	cert, refreshTime, err := e.m.verify(e.host)
	e.m.mu.Lock()
	e.m.certCache[e.host] = e
	e.m.mu.Unlock()
	e.install(cert, refreshTime, err)
}

func (e *cacheEntry) install(cert *tls.Certificate, refreshTime time.Time, err error) {
	e.cert = nil
	e.timeout = time.Time{}
	e.err = nil

	if err != nil {
		e.err = err
		e.timeout = time.Now().Add(1 * time.Minute)
		return
	}

	e.cert = cert
	e.timeout = refreshTime
}

func (e *cacheEntry) refresh() {
	e.m.rateLimit.Wait(context.Background())
	cert, refreshTime, err := e.m.verify(e.host)

	e.mu.Lock()
	defer e.mu.Unlock()
	e.refreshing = false
	if err == nil {
		e.install(cert, refreshTime, nil)
	}
}

func (m *Manager) verify(host string) (cert *tls.Certificate, refreshTime time.Time, err error) {
	c, err := acme.NewClient(letsEncryptURL, &m.state, acme.EC256)
	if err != nil {
		return
	}
	if err = c.SetChallengeProvider(acme.TLSSNI01, tlsProvider{m}); err != nil {
		return
	}
	c.SetChallengeProvider(acme.TLSSNI01, tlsProvider{m})
	c.ExcludeChallenges([]acme.Challenge{acme.HTTP01})
	acmeCert, errmap := c.ObtainCertificate([]string{host}, true, nil)
	if len(errmap) > 0 {
		if debug {
			log.Printf("ObtainCertificate %v => %v", host, errmap)
		}
		err = fmt.Errorf("%v", errmap)
		return
	}
	entryCert := stateCert{
		Cert: string(acmeCert.Certificate),
		Key:  string(acmeCert.PrivateKey),
	}
	cert, err = entryCert.toTLS()
	if err != nil {
		if debug {
			log.Printf("ObtainCertificate %v toTLS failure: %v", host, err)
		}
		err = err
		return
	}
	if refreshTime, err = certRefreshTime(cert); err != nil {
		return
	}

	m.mu.Lock()
	if m.state.Certs == nil {
		m.state.Certs = make(map[string]stateCert)
	}
	m.state.Certs[host] = entryCert
	m.mu.Unlock()
	m.updated()

	return cert, refreshTime, nil
}

func certRefreshTime(cert *tls.Certificate) (time.Time, error) {
	xc, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		if debug {
			log.Printf("ObtainCertificate to X.509 failure: %v", err)
		}
		return time.Time{}, err
	}
	t := xc.NotBefore.Add(xc.NotAfter.Sub(xc.NotBefore) / 2)
	monthEarly := xc.NotAfter.Add(-30 * 24 * time.Hour)
	if t.Before(monthEarly) {
		t = monthEarly
	}
	return t, nil
}

// tlsProvider implements acme.ChallengeProvider for TLS handshake challenges.
type tlsProvider struct {
	m *Manager
}

func (p tlsProvider) Present(domain, token, keyAuth string) error {
	cert, dom, err := acme.TLSSNI01ChallengeCertDomain(keyAuth)
	if err != nil {
		return err
	}

	p.m.mu.Lock()
	p.m.certTokens[dom] = &cert
	p.m.mu.Unlock()

	return nil
}

func (p tlsProvider) CleanUp(domain, token, keyAuth string) error {
	_, dom, err := acme.TLSSNI01ChallengeCertDomain(keyAuth)
	if err != nil {
		return err
	}

	p.m.mu.Lock()
	delete(p.m.certTokens, dom)
	p.m.mu.Unlock()

	return nil
}

func marshalKey(key *ecdsa.PrivateKey) ([]byte, error) {
	data, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return nil, err
	}
	return pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: data}), nil
}

func unmarshalKey(text string) (*ecdsa.PrivateKey, error) {
	b, _ := pem.Decode([]byte(text))
	if b == nil {
		return nil, fmt.Errorf("unmarshalKey: missing key")
	}
	if b.Type != "EC PRIVATE KEY" {
		return nil, fmt.Errorf("unmarshalKey: found %q, not %q", b.Type, "EC PRIVATE KEY")
	}
	k, err := x509.ParseECPrivateKey(b.Bytes)
	if err != nil {
		return nil, fmt.Errorf("unmarshalKey: %v", err)
	}
	return k, nil
}

func newKey() (*ecdsa.PrivateKey, error) {
	return ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
}
