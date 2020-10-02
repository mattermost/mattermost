// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filesstore

import (
	"context"
	"net/http"

	"github.com/minio/minio-go/v7/pkg/credentials"
)

// customTransport is used to point the request to a different server.
// This is helpful in situations where a different service is handling AWS S3 requests
// from multiple Mattermost applications, and the Mattermost service itself does not
// have any S3 credentials.
type customTransport struct {
	base   http.RoundTripper
	host   string
	scheme string
	cli    http.Client
}

// RoundTrip implements the transport's roundtripper implementation.
func (t *customTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Rountrippers should not modify the original request.
	newReq := req.Clone(context.Background())
	*newReq.URL = *req.URL
	req.URL.Scheme = t.scheme
	req.URL.Host = t.host
	return t.cli.Do(req)
}

// customProvider is a dummy credentials provider for the minio client to work
// without actually providing credentials. This is needed with a custom transport
// in cases where the minio client does not actually have credentials with itself,
// rather needs responses from another entity.
//
// It satisfies the credentials.Provider interface.
type customProvider struct {
	isSignV2 bool
}

// Retrieve just returns empty credentials.
func (cp customProvider) Retrieve() (credentials.Value, error) {
	sign := credentials.SignatureV4
	if cp.isSignV2 {
		sign = credentials.SignatureV2
	}
	return credentials.Value{
		AccessKeyID:     "",
		SecretAccessKey: "",
		SessionToken:    "",
		SignerType:      sign,
	}, nil
}

// IsExpired just returns true always.
func (cp customProvider) IsExpired() bool { return false }
