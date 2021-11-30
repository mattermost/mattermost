// MinIO Go Library for Amazon S3 Compatible Cloud Storage
// Copyright 2021 MinIO, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package credentials

import (
	"crypto/tls"
	"encoding/xml"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// CertificateIdentityOption is an optional AssumeRoleWithCertificate
// parameter - e.g. a custom HTTP transport configuration or S3 credental
// livetime.
type CertificateIdentityOption func(*STSCertificateIdentity)

// CertificateIdentityWithTransport returns a CertificateIdentityOption that
// customizes the STSCertificateIdentity with the given http.RoundTripper.
func CertificateIdentityWithTransport(t http.RoundTripper) CertificateIdentityOption {
	return CertificateIdentityOption(func(i *STSCertificateIdentity) { i.Client.Transport = t })
}

// CertificateIdentityWithExpiry returns a CertificateIdentityOption that
// customizes the STSCertificateIdentity with the given livetime.
//
// Fetched S3 credentials will have the given livetime if the STS server
// allows such credentials.
func CertificateIdentityWithExpiry(livetime time.Duration) CertificateIdentityOption {
	return CertificateIdentityOption(func(i *STSCertificateIdentity) { i.S3CredentialLivetime = livetime })
}

// A STSCertificateIdentity retrieves S3 credentials from the MinIO STS API and
// rotates those credentials once they expire.
type STSCertificateIdentity struct {
	Expiry

	// STSEndpoint is the base URL endpoint of the STS API.
	// For example, https://minio.local:9000
	STSEndpoint string

	// S3CredentialLivetime is the duration temp. S3 access
	// credentials should be valid.
	//
	// It represents the access credential livetime requested
	// by the client. The STS server may choose to issue
	// temp. S3 credentials that have a different - usually
	// shorter - livetime.
	//
	// The default livetime is one hour.
	S3CredentialLivetime time.Duration

	// Client is the HTTP client used to authenticate and fetch
	// S3 credentials.
	//
	// A custom TLS client configuration can be specified by
	// using a custom http.Transport:
	//   Client: http.Client {
	//       Transport: &http.Transport{
	//           TLSClientConfig: &tls.Config{},
	//       },
	//   }
	Client http.Client
}

var _ Provider = (*STSWebIdentity)(nil) // compiler check

// NewSTSCertificateIdentity returns a STSCertificateIdentity that authenticates
// to the given STS endpoint with the given TLS certificate and retrieves and
// rotates S3 credentials.
func NewSTSCertificateIdentity(endpoint string, certificate tls.Certificate, options ...CertificateIdentityOption) (*Credentials, error) {
	if endpoint == "" {
		return nil, errors.New("STS endpoint cannot be empty")
	}
	if _, err := url.Parse(endpoint); err != nil {
		return nil, err
	}
	var identity = &STSCertificateIdentity{
		STSEndpoint: endpoint,
		Client: http.Client{
			Transport: &http.Transport{
				Proxy: http.ProxyFromEnvironment,
				DialContext: (&net.Dialer{
					Timeout:   30 * time.Second,
					KeepAlive: 30 * time.Second,
				}).DialContext,
				ForceAttemptHTTP2:     true,
				MaxIdleConns:          100,
				IdleConnTimeout:       90 * time.Second,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 5 * time.Second,
				TLSClientConfig: &tls.Config{
					Certificates: []tls.Certificate{certificate},
				},
			},
		},
	}
	for _, option := range options {
		option(identity)
	}
	return New(identity), nil
}

// Retrieve fetches a new set of S3 credentials from the configured
// STS API endpoint.
func (i *STSCertificateIdentity) Retrieve() (Value, error) {
	endpointURL, err := url.Parse(i.STSEndpoint)
	if err != nil {
		return Value{}, err
	}
	var livetime = i.S3CredentialLivetime
	if livetime == 0 {
		livetime = 1 * time.Hour
	}

	queryValues := url.Values{}
	queryValues.Set("Action", "AssumeRoleWithCertificate")
	queryValues.Set("Version", STSVersion)
	endpointURL.RawQuery = queryValues.Encode()

	req, err := http.NewRequest(http.MethodPost, endpointURL.String(), nil)
	if err != nil {
		return Value{}, err
	}
	req.Form.Add("DurationSeconds", strconv.FormatUint(uint64(livetime.Seconds()), 10))

	resp, err := i.Client.Do(req)
	if err != nil {
		return Value{}, err
	}
	if resp.Body != nil {
		defer resp.Body.Close()
	}
	if resp.StatusCode != http.StatusOK {
		return Value{}, errors.New(resp.Status)
	}

	const MaxSize = 10 * 1 << 20
	var body io.Reader = resp.Body
	if resp.ContentLength > 0 && resp.ContentLength < MaxSize {
		body = io.LimitReader(body, resp.ContentLength)
	} else {
		body = io.LimitReader(body, MaxSize)
	}

	var response assumeRoleWithCertificateResponse
	if err = xml.NewDecoder(body).Decode(&response); err != nil {
		return Value{}, err
	}
	i.SetExpiration(response.Result.Credentials.Expiration, DefaultExpiryWindow)
	return Value{
		AccessKeyID:     response.Result.Credentials.AccessKey,
		SecretAccessKey: response.Result.Credentials.SecretKey,
		SessionToken:    response.Result.Credentials.SessionToken,
		SignerType:      SignatureDefault,
	}, nil
}

// Expiration returns the expiration time of the current S3 credentials.
func (i *STSCertificateIdentity) Expiration() time.Time { return i.expiration }

type assumeRoleWithCertificateResponse struct {
	XMLName xml.Name `xml:"https://sts.amazonaws.com/doc/2011-06-15/ AssumeRoleWithCertificateResponse" json:"-"`
	Result  struct {
		Credentials struct {
			AccessKey    string    `xml:"AccessKeyId" json:"accessKey,omitempty"`
			SecretKey    string    `xml:"SecretAccessKey" json:"secretKey,omitempty"`
			Expiration   time.Time `xml:"Expiration" json:"expiration,omitempty"`
			SessionToken string    `xml:"SessionToken" json:"sessionToken,omitempty"`
		} `xml:"Credentials" json:"credentials,omitempty"`
	} `xml:"AssumeRoleWithCertificateResult"`
	ResponseMetadata struct {
		RequestID string `xml:"RequestId,omitempty"`
	} `xml:"ResponseMetadata,omitempty"`
}
