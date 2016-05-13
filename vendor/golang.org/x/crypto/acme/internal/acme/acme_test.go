// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package acme

import (
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/big"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"
)

// Decodes a JWS-encoded request and unmarshals the decoded JSON into a provided
// interface.
func decodeJWSRequest(t *testing.T, v interface{}, r *http.Request) {
	// Decode request
	var req struct{ Payload string }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		t.Fatal(err)
	}
	payload, err := base64.RawURLEncoding.DecodeString(req.Payload)
	if err != nil {
		t.Fatal(err)
	}
	err = json.Unmarshal(payload, v)
	if err != nil {
		t.Fatal(err)
	}
}

func TestDiscover(t *testing.T) {
	const (
		reg    = "https://example.com/acme/new-reg"
		authz  = "https://example.com/acme/new-authz"
		cert   = "https://example.com/acme/new-cert"
		revoke = "https://example.com/acme/revoke-cert"
	)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		fmt.Fprintf(w, `{
			"new-reg": %q,
			"new-authz": %q,
			"new-cert": %q,
			"revoke-cert": %q
		}`, reg, authz, cert, revoke)
	}))
	defer ts.Close()
	ep, err := (&Client{}).Discover(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	if ep.RegURL != reg {
		t.Errorf("RegURL = %q; want %q", ep.RegURL, reg)
	}
	if ep.AuthzURL != authz {
		t.Errorf("authzURL = %q; want %q", ep.AuthzURL, authz)
	}
	if ep.CertURL != cert {
		t.Errorf("certURL = %q; want %q", ep.CertURL, cert)
	}
	if ep.RevokeURL != revoke {
		t.Errorf("revokeURL = %q; want %q", ep.RevokeURL, revoke)
	}
}

func TestRegister(t *testing.T) {
	contacts := []string{"mailto:admin@example.com"}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "HEAD" {
			w.Header().Set("replay-nonce", "test-nonce")
			return
		}
		if r.Method != "POST" {
			t.Errorf("r.Method = %q; want POST", r.Method)
		}

		var j struct {
			Resource  string
			Contact   []string
			Agreement string
		}
		decodeJWSRequest(t, &j, r)

		// Test request
		if j.Resource != "new-reg" {
			t.Errorf("j.Resource = %q; want new-reg", j.Resource)
		}
		if !reflect.DeepEqual(j.Contact, contacts) {
			t.Errorf("j.Contact = %v; want %v", j.Contact, contacts)
		}

		w.Header().Set("Location", "https://ca.tld/acme/reg/1")
		w.Header().Set("Link", `<https://ca.tld/acme/new-authz>;rel="next"`)
		w.Header().Add("Link", `<https://ca.tld/acme/recover-reg>;rel="recover"`)
		w.Header().Add("Link", `<https://ca.tld/acme/terms>;rel="terms-of-service"`)
		w.WriteHeader(http.StatusCreated)
		b, _ := json.Marshal(contacts)
		fmt.Fprintf(w, `{
			"key":%q,
			"contact":%s
		}`, testKeyThumbprint, b)
	}))
	defer ts.Close()

	c := Client{Key: testKey}
	a := &Account{Contact: contacts}
	var err error
	if a, err = c.Register(ts.URL, a); err != nil {
		t.Fatal(err)
	}
	if a.URI != "https://ca.tld/acme/reg/1" {
		t.Errorf("a.URI = %q; want https://ca.tld/acme/reg/1", a.URI)
	}
	if a.Authz != "https://ca.tld/acme/new-authz" {
		t.Errorf("a.Authz = %q; want https://ca.tld/acme/new-authz", a.Authz)
	}
	if a.CurrentTerms != "https://ca.tld/acme/terms" {
		t.Errorf("a.CurrentTerms = %q; want https://ca.tld/acme/terms", a.CurrentTerms)
	}
	if !reflect.DeepEqual(a.Contact, contacts) {
		t.Errorf("a.Contact = %v; want %v", a.Contact, contacts)
	}
}

func TestUpdateReg(t *testing.T) {
	const terms = "https://ca.tld/acme/terms"
	contacts := []string{"mailto:admin@example.com"}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "HEAD" {
			w.Header().Set("replay-nonce", "test-nonce")
			return
		}
		if r.Method != "POST" {
			t.Errorf("r.Method = %q; want POST", r.Method)
		}

		var j struct {
			Resource  string
			Contact   []string
			Agreement string
		}
		decodeJWSRequest(t, &j, r)

		// Test request
		if j.Resource != "reg" {
			t.Errorf("j.Resource = %q; want reg", j.Resource)
		}
		if j.Agreement != terms {
			t.Errorf("j.Agreement = %q; want %q", j.Agreement, terms)
		}
		if !reflect.DeepEqual(j.Contact, contacts) {
			t.Errorf("j.Contact = %v; want %v", j.Contact, contacts)
		}

		w.Header().Set("Link", `<https://ca.tld/acme/new-authz>;rel="next"`)
		w.Header().Add("Link", `<https://ca.tld/acme/recover-reg>;rel="recover"`)
		w.Header().Add("Link", fmt.Sprintf(`<%s>;rel="terms-of-service"`, terms))
		w.WriteHeader(http.StatusOK)
		b, _ := json.Marshal(contacts)
		fmt.Fprintf(w, `{
			"key":%q,
			"contact":%s,
			"agreement":%q
		}`, testKeyThumbprint, b, terms)
	}))
	defer ts.Close()

	c := Client{Key: testKey}
	a := &Account{Contact: contacts, AgreedTerms: terms}
	var err error
	if a, err = c.UpdateReg(ts.URL, a); err != nil {
		t.Fatal(err)
	}
	if a.Authz != "https://ca.tld/acme/new-authz" {
		t.Errorf("a.Authz = %q; want https://ca.tld/acme/new-authz", a.Authz)
	}
	if a.AgreedTerms != terms {
		t.Errorf("a.AgreedTerms = %q; want %q", a.AgreedTerms, terms)
	}
	if a.CurrentTerms != terms {
		t.Errorf("a.CurrentTerms = %q; want %q", a.CurrentTerms, terms)
	}
}

func TestGetReg(t *testing.T) {
	const terms = "https://ca.tld/acme/terms"
	const newTerms = "https://ca.tld/acme/new-terms"
	contacts := []string{"mailto:admin@example.com"}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "HEAD" {
			w.Header().Set("replay-nonce", "test-nonce")
			return
		}
		if r.Method != "POST" {
			t.Errorf("r.Method = %q; want POST", r.Method)
		}

		var j struct {
			Resource  string
			Contact   []string
			Agreement string
		}
		decodeJWSRequest(t, &j, r)

		// Test request
		if j.Resource != "reg" {
			t.Errorf("j.Resource = %q; want reg", j.Resource)
		}
		if len(j.Contact) != 0 {
			t.Errorf("j.Contact = %v", j.Contact)
		}
		if j.Agreement != "" {
			t.Errorf("j.Agreement = %q", j.Agreement)
		}

		w.Header().Set("Link", `<https://ca.tld/acme/new-authz>;rel="next"`)
		w.Header().Add("Link", `<https://ca.tld/acme/recover-reg>;rel="recover"`)
		w.Header().Add("Link", fmt.Sprintf(`<%s>;rel="terms-of-service"`, newTerms))
		w.WriteHeader(http.StatusOK)
		b, _ := json.Marshal(contacts)
		fmt.Fprintf(w, `{
			"key":%q,
			"contact":%s,
			"agreement":%q
		}`, testKeyThumbprint, b, terms)
	}))
	defer ts.Close()

	c := Client{Key: testKey}
	a, err := c.GetReg(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	if a.Authz != "https://ca.tld/acme/new-authz" {
		t.Errorf("a.AuthzURL = %q; want https://ca.tld/acme/new-authz", a.Authz)
	}
	if a.AgreedTerms != terms {
		t.Errorf("a.AgreedTerms = %q; want %q", a.AgreedTerms, terms)
	}
	if a.CurrentTerms != newTerms {
		t.Errorf("a.CurrentTerms = %q; want %q", a.CurrentTerms, newTerms)
	}
}

func TestAuthorize(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "HEAD" {
			w.Header().Set("replay-nonce", "test-nonce")
			return
		}
		if r.Method != "POST" {
			t.Errorf("r.Method = %q; want POST", r.Method)
		}

		var j struct {
			Resource   string
			Identifier struct {
				Type  string
				Value string
			}
		}
		decodeJWSRequest(t, &j, r)

		// Test request
		if j.Resource != "new-authz" {
			t.Errorf("j.Resource = %q; want new-authz", j.Resource)
		}
		if j.Identifier.Type != "dns" {
			t.Errorf("j.Identifier.Type = %q; want dns", j.Identifier.Type)
		}
		if j.Identifier.Value != "example.com" {
			t.Errorf("j.Identifier.Value = %q; want example.com", j.Identifier.Value)
		}

		w.Header().Set("Location", "https://ca.tld/acme/auth/1")
		w.WriteHeader(http.StatusCreated)
		fmt.Fprintf(w, `{
			"identifier": {"type":"dns","value":"example.com"},
			"status":"pending",
			"challenges":[
				{
					"type":"http-01",
					"status":"pending",
					"uri":"https://ca.tld/acme/challenge/publickey/id1",
					"token":"token1"
				},
				{
					"type":"tls-sni-01",
					"status":"pending",
					"uri":"https://ca.tld/acme/challenge/publickey/id2",
					"token":"token2"
				}
			],
			"combinations":[[0],[1]]}`)
	}))
	defer ts.Close()

	cl := Client{Key: testKey}
	auth, err := cl.Authorize(ts.URL, "example.com")
	if err != nil {
		t.Fatal(err)
	}

	if auth.URI != "https://ca.tld/acme/auth/1" {
		t.Errorf("URI = %q; want https://ca.tld/acme/auth/1", auth.URI)
	}
	if auth.Status != "pending" {
		t.Errorf("Status = %q; want pending", auth.Status)
	}
	if auth.Identifier.Type != "dns" {
		t.Errorf("Identifier.Type = %q; want dns", auth.Identifier.Type)
	}
	if auth.Identifier.Value != "example.com" {
		t.Errorf("Identifier.Value = %q; want example.com", auth.Identifier.Value)
	}

	if n := len(auth.Challenges); n != 2 {
		t.Fatalf("len(auth.Challenges) = %d; want 2", n)
	}

	c := auth.Challenges[0]
	if c.Type != "http-01" {
		t.Errorf("c.Type = %q; want http-01", c.Type)
	}
	if c.URI != "https://ca.tld/acme/challenge/publickey/id1" {
		t.Errorf("c.URI = %q; want https://ca.tld/acme/challenge/publickey/id1", c.URI)
	}
	if c.Token != "token1" {
		t.Errorf("c.Token = %q; want token1", c.Type)
	}

	c = auth.Challenges[1]
	if c.Type != "tls-sni-01" {
		t.Errorf("c.Type = %q; want tls-sni-01", c.Type)
	}
	if c.URI != "https://ca.tld/acme/challenge/publickey/id2" {
		t.Errorf("c.URI = %q; want https://ca.tld/acme/challenge/publickey/id2", c.URI)
	}
	if c.Token != "token2" {
		t.Errorf("c.Token = %q; want token2", c.Type)
	}

	combs := [][]int{{0}, {1}}
	if !reflect.DeepEqual(auth.Combinations, combs) {
		t.Errorf("auth.Combinations: %+v\nwant: %+v\n", auth.Combinations, combs)
	}
}

func TestPollAuthz(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("r.Method = %q; want GET", r.Method)
		}

		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{
			"identifier": {"type":"dns","value":"example.com"},
			"status":"pending",
			"challenges":[
				{
					"type":"http-01",
					"status":"pending",
					"uri":"https://ca.tld/acme/challenge/publickey/id1",
					"token":"token1"
				},
				{
					"type":"tls-sni-01",
					"status":"pending",
					"uri":"https://ca.tld/acme/challenge/publickey/id2",
					"token":"token2"
				}
			],
			"combinations":[[0],[1]]}`)
	}))
	defer ts.Close()

	cl := Client{Key: testKey}
	auth, err := cl.GetAuthz(ts.URL)
	if err != nil {
		t.Fatal(err)
	}

	if auth.Status != "pending" {
		t.Errorf("Status = %q; want pending", auth.Status)
	}
	if auth.Identifier.Type != "dns" {
		t.Errorf("Identifier.Type = %q; want dns", auth.Identifier.Type)
	}
	if auth.Identifier.Value != "example.com" {
		t.Errorf("Identifier.Value = %q; want example.com", auth.Identifier.Value)
	}

	if n := len(auth.Challenges); n != 2 {
		t.Fatalf("len(set.Challenges) = %d; want 2", n)
	}

	c := auth.Challenges[0]
	if c.Type != "http-01" {
		t.Errorf("c.Type = %q; want http-01", c.Type)
	}
	if c.URI != "https://ca.tld/acme/challenge/publickey/id1" {
		t.Errorf("c.URI = %q; want https://ca.tld/acme/challenge/publickey/id1", c.URI)
	}
	if c.Token != "token1" {
		t.Errorf("c.Token = %q; want token1", c.Type)
	}

	c = auth.Challenges[1]
	if c.Type != "tls-sni-01" {
		t.Errorf("c.Type = %q; want tls-sni-01", c.Type)
	}
	if c.URI != "https://ca.tld/acme/challenge/publickey/id2" {
		t.Errorf("c.URI = %q; want https://ca.tld/acme/challenge/publickey/id2", c.URI)
	}
	if c.Token != "token2" {
		t.Errorf("c.Token = %q; want token2", c.Type)
	}

	combs := [][]int{{0}, {1}}
	if !reflect.DeepEqual(auth.Combinations, combs) {
		t.Errorf("auth.Combinations: %+v\nwant: %+v\n", auth.Combinations, combs)
	}
}

func TestPollChallenge(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("r.Method = %q; want GET", r.Method)
		}

		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{
			"type":"http-01",
			"status":"pending",
			"uri":"https://ca.tld/acme/challenge/publickey/id1",
			"token":"token1"}`)
	}))
	defer ts.Close()

	cl := Client{Key: testKey}
	chall, err := cl.GetChallenge(ts.URL)
	if err != nil {
		t.Fatal(err)
	}

	if chall.Status != "pending" {
		t.Errorf("Status = %q; want pending", chall.Status)
	}
	if chall.Type != "http-01" {
		t.Errorf("c.Type = %q; want http-01", chall.Type)
	}
	if chall.URI != "https://ca.tld/acme/challenge/publickey/id1" {
		t.Errorf("c.URI = %q; want https://ca.tld/acme/challenge/publickey/id1", chall.URI)
	}
	if chall.Token != "token1" {
		t.Errorf("c.Token = %q; want token1", chall.Type)
	}
}

func TestAcceptChallenge(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "HEAD" {
			w.Header().Set("replay-nonce", "test-nonce")
			return
		}
		if r.Method != "POST" {
			t.Errorf("r.Method = %q; want POST", r.Method)
		}

		var j struct {
			Resource string
			Type     string
			Auth     string `json:"keyAuthorization"`
		}
		decodeJWSRequest(t, &j, r)

		// Test request
		if j.Resource != "challenge" {
			t.Errorf(`resource = %q; want "challenge"`, j.Resource)
		}
		if j.Type != "http-01" {
			t.Errorf(`type = %q; want "http-01"`, j.Type)
		}
		keyAuth := "token1." + testKeyThumbprint
		if j.Auth != keyAuth {
			t.Errorf(`keyAuthorization = %q; want %q`, j.Auth, keyAuth)
		}

		// Respond to request
		w.WriteHeader(http.StatusAccepted)
		fmt.Fprintf(w, `{
			"type":"http-01",
			"status":"pending",
			"uri":"https://ca.tld/acme/challenge/publickey/id1",
			"token":"token1",
			"keyAuthorization":%q
		}`, keyAuth)
	}))
	defer ts.Close()

	cl := Client{Key: testKey}
	c, err := cl.Accept(&Challenge{
		URI:   ts.URL,
		Token: "token1",
		Type:  "http-01",
	})
	if err != nil {
		t.Fatal(err)
	}

	if c.Type != "http-01" {
		t.Errorf("c.Type = %q; want http-01", c.Type)
	}
	if c.URI != "https://ca.tld/acme/challenge/publickey/id1" {
		t.Errorf("c.URI = %q; want https://ca.tld/acme/challenge/publickey/id1", c.URI)
	}
	if c.Token != "token1" {
		t.Errorf("c.Token = %q; want token1", c.Type)
	}
}

func TestNewCert(t *testing.T) {
	notBefore := time.Now()
	notAfter := notBefore.AddDate(0, 2, 0)
	timeNow = func() time.Time { return notBefore }

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "HEAD" {
			w.Header().Set("replay-nonce", "test-nonce")
			return
		}
		if r.Method != "POST" {
			t.Errorf("r.Method = %q; want POST", r.Method)
		}

		var j struct {
			Resource  string `json:"resource"`
			CSR       string `json:"csr"`
			NotBefore string `json:"notBefore,omitempty"`
			NotAfter  string `json:"notAfter,omitempty"`
		}
		decodeJWSRequest(t, &j, r)

		// Test request
		if j.Resource != "new-cert" {
			t.Errorf(`resource = %q; want "new-cert"`, j.Resource)
		}
		if j.NotBefore != notBefore.Format(time.RFC3339) {
			t.Errorf(`notBefore = %q; wanted %q`, j.NotBefore, notBefore.Format(time.RFC3339))
		}
		if j.NotAfter != notAfter.Format(time.RFC3339) {
			t.Errorf(`notAfter = %q; wanted %q`, j.NotAfter, notAfter.Format(time.RFC3339))
		}

		// Respond to request
		template := x509.Certificate{
			SerialNumber: big.NewInt(int64(1)),
			Subject: pkix.Name{
				Organization: []string{"goacme"},
			},
			NotBefore: notBefore,
			NotAfter:  notAfter,

			KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
			ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
			BasicConstraintsValid: true,
		}

		sampleCert, err := x509.CreateCertificate(rand.Reader, &template, &template, &testKey.PublicKey, testKey)
		if err != nil {
			t.Fatalf("Error creating certificate: %v", err)
		}

		w.Header().Set("Location", "https://ca.tld/acme/cert/1")
		w.WriteHeader(http.StatusCreated)
		w.Write(sampleCert)
	}))
	defer ts.Close()

	csr := x509.CertificateRequest{
		Version: 0,
		Subject: pkix.Name{
			CommonName:   "example.com",
			Organization: []string{"goacme"},
		},
	}
	csrb, err := x509.CreateCertificateRequest(rand.Reader, &csr, testKey)
	if err != nil {
		t.Fatal(err)
	}

	c := Client{Key: testKey}
	cert, certURL, err := c.CreateCert(context.Background(), ts.URL, csrb, notAfter.Sub(notBefore), false)
	if err != nil {
		t.Fatal(err)
	}
	if cert == nil {
		t.Errorf("cert is nil")
	}
	if certURL != "https://ca.tld/acme/cert/1" {
		t.Errorf("certURL = %q; want https://ca.tld/acme/cert/1", certURL)
	}
}

func TestFetchCert(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte{1})
	}))
	defer ts.Close()
	res, err := (&Client{}).FetchCert(context.Background(), ts.URL, false)
	if err != nil {
		t.Fatalf("FetchCert: %v", err)
	}
	cert := [][]byte{{1}}
	if !reflect.DeepEqual(res, cert) {
		t.Errorf("res = %v; want %v", res, cert)
	}
}

func TestFetchCertRetry(t *testing.T) {
	var count int
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if count < 1 {
			w.Header().Set("retry-after", "0")
			w.WriteHeader(http.StatusAccepted)
			count++
			return
		}
		w.Write([]byte{1})
	}))
	defer ts.Close()
	res, err := (&Client{}).FetchCert(context.Background(), ts.URL, false)
	if err != nil {
		t.Fatalf("FetchCert: %v", err)
	}
	cert := [][]byte{{1}}
	if !reflect.DeepEqual(res, cert) {
		t.Errorf("res = %v; want %v", res, cert)
	}
}

func TestFetchCertCancel(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("retry-after", "0")
		w.WriteHeader(http.StatusAccepted)
	}))
	defer ts.Close()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	var err error
	go func() {
		_, err = (&Client{}).FetchCert(ctx, ts.URL, false)
		close(done)
	}()
	cancel()
	<-done
	if err != context.Canceled {
		t.Errorf("err = %v; want %v", err, context.Canceled)
	}
}

func TestFetchNonce(t *testing.T) {
	tests := []struct {
		code  int
		nonce string
	}{
		{http.StatusOK, "nonce1"},
		{http.StatusBadRequest, "nonce2"},
		{http.StatusOK, ""},
	}
	var i int
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "HEAD" {
			t.Errorf("%d: r.Method = %q; want HEAD", i, r.Method)
		}
		w.Header().Set("replay-nonce", tests[i].nonce)
		w.WriteHeader(tests[i].code)
	}))
	defer ts.Close()
	for ; i < len(tests); i++ {
		test := tests[i]
		n, err := fetchNonce(http.DefaultClient, ts.URL)
		if n != test.nonce {
			t.Errorf("%d: n=%q; want %q", i, n, test.nonce)
		}
		switch {
		case err == nil && test.nonce == "":
			t.Errorf("%d: n=%q, err=%v; want non-nil error", i, n, err)
		case err != nil && test.nonce != "":
			t.Errorf("%d: n=%q, err=%v; want %q", i, n, err, test.nonce)
		}
	}
}

func TestLinkHeader(t *testing.T) {
	h := http.Header{"Link": {
		`<https://example.com/acme/new-authz>;rel="next"`,
		`<https://example.com/acme/recover-reg>; rel=recover`,
		`<https://example.com/acme/terms>; foo=bar; rel="terms-of-service"`,
	}}
	tests := []struct{ in, out string }{
		{"next", "https://example.com/acme/new-authz"},
		{"recover", "https://example.com/acme/recover-reg"},
		{"terms-of-service", "https://example.com/acme/terms"},
		{"empty", ""},
	}
	for i, test := range tests {
		if v := linkHeader(h, test.in); v != test.out {
			t.Errorf("%d: parseLinkHeader(%q): %q; want %q", i, test.in, v, test.out)
		}
	}
}

func TestErrorResponse(t *testing.T) {
	s := `{
		"status": 400,
		"type": "urn:acme:error:xxx",
		"detail": "text"
	}`
	res := &http.Response{
		StatusCode: 400,
		Status:     "400 Bad Request",
		Body:       ioutil.NopCloser(strings.NewReader(s)),
		Header:     http.Header{"X-Foo": {"bar"}},
	}
	err := responseError(res)
	v, ok := err.(*Error)
	if !ok {
		t.Fatalf("err = %+v (%T); want *Error type", err, err)
	}
	if v.StatusCode != 400 {
		t.Errorf("v.StatusCode = %v; want 400", v.StatusCode)
	}
	if v.ProblemType != "urn:acme:error:xxx" {
		t.Errorf("v.ProblemType = %q; want urn:acme:error:xxx", v.ProblemType)
	}
	if v.Detail != "text" {
		t.Errorf("v.Detail = %q; want text", v.Detail)
	}
	if !reflect.DeepEqual(v.Header, res.Header) {
		t.Errorf("v.Header = %+v; want %+v", v.Header, res.Header)
	}
}
