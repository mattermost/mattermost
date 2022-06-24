/*
 * MinIO Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2015-2022 MinIO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package credentials

import (
	"encoding/xml"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// CustomTokenResult - Contains temporary creds and user metadata.
type CustomTokenResult struct {
	Credentials struct {
		AccessKey    string    `xml:"AccessKeyId"`
		SecretKey    string    `xml:"SecretAccessKey"`
		Expiration   time.Time `xml:"Expiration"`
		SessionToken string    `xml:"SessionToken"`
	} `xml:",omitempty"`

	AssumedUser string `xml:",omitempty"`
}

// AssumeRoleWithCustomTokenResponse contains the result of a successful
// AssumeRoleWithCustomToken request.
type AssumeRoleWithCustomTokenResponse struct {
	XMLName  xml.Name          `xml:"https://sts.amazonaws.com/doc/2011-06-15/ AssumeRoleWithCustomTokenResponse" json:"-"`
	Result   CustomTokenResult `xml:"AssumeRoleWithCustomTokenResult"`
	Metadata struct {
		RequestID string `xml:"RequestId,omitempty"`
	} `xml:"ResponseMetadata,omitempty"`
}

// CustomTokenIdentity - satisfies the Provider interface, and retrieves
// credentials from MinIO using the AssumeRoleWithCustomToken STS API.
type CustomTokenIdentity struct {
	Expiry

	Client *http.Client

	// MinIO server STS endpoint to fetch STS credentials.
	STSEndpoint string

	// The custom token to use with the request.
	Token string

	// RoleArn associated with the identity
	RoleArn string

	// RequestedExpiry is to set the validity of the generated credentials
	// (this value bounded by server).
	RequestedExpiry time.Duration
}

// Retrieve - to satisfy Provider interface; fetches credentials from MinIO.
func (c *CustomTokenIdentity) Retrieve() (value Value, err error) {
	u, err := url.Parse(c.STSEndpoint)
	if err != nil {
		return value, err
	}

	v := url.Values{}
	v.Set("Action", "AssumeRoleWithCustomToken")
	v.Set("Version", STSVersion)
	v.Set("RoleArn", c.RoleArn)
	v.Set("Token", c.Token)
	if c.RequestedExpiry != 0 {
		v.Set("DurationSeconds", fmt.Sprintf("%d", int(c.RequestedExpiry.Seconds())))
	}

	u.RawQuery = v.Encode()

	req, err := http.NewRequest(http.MethodPost, u.String(), nil)
	if err != nil {
		return value, stripPassword(err)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return value, stripPassword(err)
	}

	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return value, errors.New(resp.Status)
	}

	r := AssumeRoleWithCustomTokenResponse{}
	if err = xml.NewDecoder(resp.Body).Decode(&r); err != nil {
		return
	}

	cr := r.Result.Credentials
	c.SetExpiration(cr.Expiration, DefaultExpiryWindow)
	return Value{
		AccessKeyID:     cr.AccessKey,
		SecretAccessKey: cr.SecretKey,
		SessionToken:    cr.SessionToken,
		SignerType:      SignatureV4,
	}, nil
}

// NewCustomTokenCredentials - returns credentials using the
// AssumeRoleWithCustomToken STS API.
func NewCustomTokenCredentials(stsEndpoint, token, roleArn string, optFuncs ...CustomTokenOpt) (*Credentials, error) {
	c := CustomTokenIdentity{
		Client:      &http.Client{Transport: http.DefaultTransport},
		STSEndpoint: stsEndpoint,
		Token:       token,
		RoleArn:     roleArn,
	}
	for _, optFunc := range optFuncs {
		optFunc(&c)
	}
	return New(&c), nil
}

// CustomTokenOpt is a function type to configure the custom-token based
// credentials using NewCustomTokenCredentials.
type CustomTokenOpt func(*CustomTokenIdentity)

// CustomTokenValidityOpt sets the validity duration of the requested
// credentials. This value is ignored if the server enforces a lower validity
// period.
func CustomTokenValidityOpt(d time.Duration) CustomTokenOpt {
	return func(c *CustomTokenIdentity) {
		c.RequestedExpiry = d
	}
}
