// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package acme provides an ACME client implementation.
// See https://ietf-wg-acme.github.io/acme/ for details.
//
// This package is a work in progress and makes no API stability promises.
package acme

import (
	"bytes"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context"
)

// Client is an ACME client.
type Client struct {
	// HTTPClient optionally specifies an HTTP client to use
	// instead of http.DefaultClient.
	HTTPClient *http.Client

	// Key is the account key used to register with a CA
	// and sign requests.
	Key *rsa.PrivateKey
}

// Discover performs ACME server discovery using the provided discovery endpoint URL.
func (c *Client) Discover(url string) (*Directory, error) {
	res, err := c.httpClient().Get(url)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, responseError(res)
	}
	var v struct {
		Reg    string `json:"new-reg"`
		Authz  string `json:"new-authz"`
		Cert   string `json:"new-cert"`
		Revoke string `json:"revoke-cert"`
		Meta   struct {
			Terms   string   `json:"terms-of-service"`
			Website string   `json:"website"`
			CAA     []string `json:"caa-identities"`
		}
	}
	if json.NewDecoder(res.Body).Decode(&v); err != nil {
		return nil, err
	}
	return &Directory{
		RegURL:    v.Reg,
		AuthzURL:  v.Authz,
		CertURL:   v.Cert,
		RevokeURL: v.Revoke,
		Terms:     v.Meta.Terms,
		Website:   v.Meta.Website,
		CAA:       v.Meta.CAA,
	}, nil
}

// CreateCert requests a new certificate.
// In the case where CA server does not provide the issued certificate in the response,
// CreateCert will poll certURL using c.FetchCert, which will result in additional round-trips.
// In such scenario the caller can cancel the polling with ctx.
//
// If the bundle is true, the returned value will also contain CA (the issuer) certificate.
// The url argument is an Directory.CertURL value, typically obtained from c.Discover.
// The csr is a DER encoded certificate signing request.
func (c *Client) CreateCert(ctx context.Context, url string, csr []byte, exp time.Duration, bundle bool) (der [][]byte, certURL string, err error) {
	req := struct {
		Resource  string `json:"resource"`
		CSR       string `json:"csr"`
		NotBefore string `json:"notBefore,omitempty"`
		NotAfter  string `json:"notAfter,omitempty"`
	}{
		Resource: "new-cert",
		CSR:      base64.RawURLEncoding.EncodeToString(csr),
	}
	now := timeNow()
	req.NotBefore = now.Format(time.RFC3339)
	if exp > 0 {
		req.NotAfter = now.Add(exp).Format(time.RFC3339)
	}

	res, err := c.postJWS(url, req)
	if err != nil {
		return nil, "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		return nil, "", responseError(res)
	}

	curl := res.Header.Get("location") // cert permanent URL
	if res.ContentLength == 0 {
		// no cert in the body; poll until we get it
		cert, err := c.FetchCert(ctx, curl, bundle)
		return cert, curl, err
	}
	// slurp issued cert and ca, if requested
	cert, err := responseCert(c.httpClient(), res, bundle)
	return cert, curl, err
}

// FetchCert retrieves already issued certificate from the given url, in DER format.
// It retries the request until the certificate is successfully retrieved,
// context is cancelled by the caller or an error response is received.
//
// The returned value will also contain CA (the issuer) certificate if bundle == true.
//
// http.DefaultClient is used if client argument is nil.
func (c *Client) FetchCert(ctx context.Context, url string, bundle bool) ([][]byte, error) {
	for {
		res, err := c.httpClient().Get(url)
		if err != nil {
			return nil, err
		}
		defer res.Body.Close()
		if res.StatusCode == http.StatusOK {
			return responseCert(c.httpClient(), res, bundle)
		}
		if res.StatusCode > 299 {
			return nil, responseError(res)
		}
		d, err := retryAfter(res.Header.Get("retry-after"))
		if err != nil {
			d = 3 * time.Second
		}
		select {
		case <-time.After(d):
			// retry
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

// Register creates a new account registration by following the "new-reg" flow.
// It returns registered account. The a argument is not modified.
//
// The url argument is typically an Directory.RegURL obtained from c.Discover.
func (c *Client) Register(url string, a *Account) (*Account, error) {
	return c.doReg(url, "new-reg", a)
}

// GetReg retrieves an existing registration.
// The url argument is an Account.URI, typically obtained from c.Register.
func (c *Client) GetReg(url string) (*Account, error) {
	a := &Account{URI: url}
	return c.doReg(url, "reg", a)
}

// UpdateReg updates an existing registration.
// It returns an updated account copy. The provided account is not modified.
//
// The url argument is an Account.URI, usually obtained with c.Register.
func (c *Client) UpdateReg(url string, a *Account) (*Account, error) {
	return c.doReg(url, "reg", a)
}

// Authorize performs the initial step in an authorization flow.
// The caller will then need to choose from and perform a set of returned
// challenges using c.Accept in order to successfully complete authorization.
//
// The url argument is an authz URL, usually obtained with c.Register.
func (c *Client) Authorize(url, domain string) (*Authorization, error) {
	type authzID struct {
		Type  string `json:"type"`
		Value string `json:"value"`
	}
	req := struct {
		Resource   string  `json:"resource"`
		Identifier authzID `json:"identifier"`
	}{
		Resource:   "new-authz",
		Identifier: authzID{Type: "dns", Value: domain},
	}
	res, err := c.postJWS(url, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		return nil, responseError(res)
	}

	var v wireAuthz
	if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("Decode: %v", err)
	}
	if v.Status != StatusPending {
		return nil, fmt.Errorf("Unexpected status: %s", v.Status)
	}
	return v.authorization(res.Header.Get("Location")), nil
}

// GetAuthz retrieves the current status of an authorization flow.
//
// A client typically polls an authz status using this method.
func (c *Client) GetAuthz(url string) (*Authorization, error) {
	res, err := c.httpClient().Get(url)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusAccepted {
		return nil, responseError(res)
	}
	var v wireAuthz
	if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("Decode: %v", err)
	}
	return v.authorization(url), nil
}

// GetChallenge retrieves the current status of an challenge.
//
// A client typically polls a challenge status using this method.
func (c *Client) GetChallenge(url string) (*Challenge, error) {
	res, err := c.httpClient().Get(url)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusAccepted {
		return nil, responseError(res)
	}
	v := wireChallenge{URI: url}
	if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("Decode: %v", err)
	}
	return v.challenge(), nil
}

// Accept informs the server that the client accepts one of its challenges
// previously obtained with c.Authorize.
//
// The server will then perform the validation asynchronously.
func (c *Client) Accept(chal *Challenge) (*Challenge, error) {
	req := struct {
		Resource string `json:"resource"`
		Type     string `json:"type"`
		Auth     string `json:"keyAuthorization"`
	}{
		Resource: "challenge",
		Type:     chal.Type,
		Auth:     keyAuth(&c.Key.PublicKey, chal.Token),
	}
	res, err := c.postJWS(chal.URI, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	// Note: the protocol specifies 200 as the expected response code, but
	// letsencrypt seems to be returning 202.
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusAccepted {
		return nil, responseError(res)
	}

	var v wireChallenge
	if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("Decode: %v", err)
	}
	return v.challenge(), nil
}

// HTTP01Handler creates a new handler which responds to a http-01 challenge.
// The token argument is a Challenge.Token value.
func (c *Client) HTTP01Handler(token string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, token) {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("content-type", "text/plain")
		w.Write([]byte(keyAuth(&c.Key.PublicKey, token)))
	})
}

func (c *Client) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return http.DefaultClient
}

// postJWS signs body and posts it to the provided url.
// The body argument must be JSON-serializable.
func (c *Client) postJWS(url string, body interface{}) (*http.Response, error) {
	nonce, err := fetchNonce(c.httpClient(), url)
	if err != nil {
		return nil, err
	}
	b, err := jwsEncodeJSON(body, c.Key, nonce)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", url, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	return c.httpClient().Do(req)
}

// doReg sends all types of registration requests.
// The type of request is identified by typ argument, which is a "resource"
// in the ACME spec terms.
//
// A non-nil acct argument indicates whether the intention is to mutate data
// of the Account. Only Contact and Agreement of its fields are used
// in such cases.
//
// The fields of acct will be populate with the server response
// and may be overwritten.
func (c *Client) doReg(url string, typ string, acct *Account) (*Account, error) {
	req := struct {
		Resource  string   `json:"resource"`
		Contact   []string `json:"contact,omitempty"`
		Agreement string   `json:"agreement,omitempty"`
	}{
		Resource: typ,
	}
	if acct != nil {
		req.Contact = acct.Contact
		req.Agreement = acct.AgreedTerms
	}
	res, err := c.postJWS(url, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return nil, responseError(res)
	}

	var v struct {
		Contact        []string
		Agreement      string
		Authorizations string
		Certificates   string
	}
	if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("Decode: %v", err)
	}
	return &Account{
		URI:            res.Header.Get("Location"),
		Contact:        v.Contact,
		AgreedTerms:    v.Agreement,
		CurrentTerms:   linkHeader(res.Header, "terms-of-service"),
		Authz:          linkHeader(res.Header, "next"),
		Authorizations: v.Authorizations,
		Certificates:   v.Certificates,
	}, nil
}

func responseCert(client *http.Client, res *http.Response, bundle bool) ([][]byte, error) {
	b, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("ReadAll: %v", err)
	}
	cert := [][]byte{b}
	if !bundle {
		return cert, nil
	}

	// append ca cert
	up := linkHeader(res.Header, "up")
	if up == "" {
		return nil, errors.New("rel=up link not found")
	}
	res, err = client.Get(up)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, responseError(res)
	}
	b, err = ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	return append(cert, b), nil
}

// responseError creates an error of Error type from resp.
func responseError(resp *http.Response) error {
	// don't care if ReadAll returns an error:
	// json.Unmarshal will fail in that case anyway
	b, _ := ioutil.ReadAll(resp.Body)
	e := struct {
		Status int
		Type   string
		Detail string
	}{
		Status: resp.StatusCode,
	}
	if err := json.Unmarshal(b, &e); err != nil {
		// this is not a regular error response:
		// populate detail with anything we received,
		// e.Status will already contain HTTP response code value
		e.Detail = string(b)
		if e.Detail == "" {
			e.Detail = resp.Status
		}
	}
	return &Error{
		StatusCode:  e.Status,
		ProblemType: e.Type,
		Detail:      e.Detail,
		Header:      resp.Header,
	}
}

func fetchNonce(client *http.Client, url string) (string, error) {
	resp, err := client.Head(url)
	if err != nil {
		return "", nil
	}
	defer resp.Body.Close()
	enc := resp.Header.Get("replay-nonce")
	if enc == "" {
		return "", errors.New("nonce not found")
	}
	return enc, nil
}

func linkHeader(h http.Header, rel string) string {
	for _, v := range h["Link"] {
		parts := strings.Split(v, ";")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if !strings.HasPrefix(p, "rel=") {
				continue
			}
			if v := strings.Trim(p[4:], `"`); v == rel {
				return strings.Trim(parts[0], "<>")
			}
		}
	}
	return ""
}

func retryAfter(v string) (time.Duration, error) {
	if i, err := strconv.Atoi(v); err == nil {
		return time.Duration(i) * time.Second, nil
	}
	t, err := http.ParseTime(v)
	if err != nil {
		return 0, err
	}
	return t.Sub(timeNow()), nil
}

// keyAuth generates a key authorization string for a given token.
func keyAuth(pub *rsa.PublicKey, token string) string {
	return fmt.Sprintf("%s.%s", token, JWKThumbprint(pub))
}

// timeNow is useful for testing for fixed current time.
var timeNow = time.Now
