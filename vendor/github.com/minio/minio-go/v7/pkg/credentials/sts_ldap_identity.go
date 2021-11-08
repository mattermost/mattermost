/*
 * MinIO Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2019-2021 MinIO, Inc.
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

// AssumeRoleWithLDAPResponse contains the result of successful
// AssumeRoleWithLDAPIdentity request
type AssumeRoleWithLDAPResponse struct {
	XMLName          xml.Name           `xml:"https://sts.amazonaws.com/doc/2011-06-15/ AssumeRoleWithLDAPIdentityResponse" json:"-"`
	Result           LDAPIdentityResult `xml:"AssumeRoleWithLDAPIdentityResult"`
	ResponseMetadata struct {
		RequestID string `xml:"RequestId,omitempty"`
	} `xml:"ResponseMetadata,omitempty"`
}

// LDAPIdentityResult - contains credentials for a successful
// AssumeRoleWithLDAPIdentity request.
type LDAPIdentityResult struct {
	Credentials struct {
		AccessKey    string    `xml:"AccessKeyId" json:"accessKey,omitempty"`
		SecretKey    string    `xml:"SecretAccessKey" json:"secretKey,omitempty"`
		Expiration   time.Time `xml:"Expiration" json:"expiration,omitempty"`
		SessionToken string    `xml:"SessionToken" json:"sessionToken,omitempty"`
	} `xml:",omitempty"`

	SubjectFromToken string `xml:",omitempty"`
}

// LDAPIdentity retrieves credentials from MinIO
type LDAPIdentity struct {
	Expiry

	// Required http Client to use when connecting to MinIO STS service.
	Client *http.Client

	// Exported STS endpoint to fetch STS credentials.
	STSEndpoint string

	// LDAP username/password used to fetch LDAP STS credentials.
	LDAPUsername, LDAPPassword string

	// Session policy to apply to the generated credentials. Leave empty to
	// use the full access policy available to the user.
	Policy string

	// RequestedExpiry is the configured expiry duration for credentials
	// requested from LDAP.
	RequestedExpiry time.Duration
}

// NewLDAPIdentity returns new credentials object that uses LDAP
// Identity.
func NewLDAPIdentity(stsEndpoint, ldapUsername, ldapPassword string, optFuncs ...LDAPIdentityOpt) (*Credentials, error) {
	l := LDAPIdentity{
		Client:       &http.Client{Transport: http.DefaultTransport},
		STSEndpoint:  stsEndpoint,
		LDAPUsername: ldapUsername,
		LDAPPassword: ldapPassword,
	}
	for _, optFunc := range optFuncs {
		optFunc(&l)
	}
	return New(&l), nil
}

// LDAPIdentityOpt is a function type used to configured the LDAPIdentity
// instance.
type LDAPIdentityOpt func(*LDAPIdentity)

// LDAPIdentityPolicyOpt sets the session policy for requested credentials.
func LDAPIdentityPolicyOpt(policy string) LDAPIdentityOpt {
	return func(k *LDAPIdentity) {
		k.Policy = policy
	}
}

// LDAPIdentityExpiryOpt sets the expiry duration for requested credentials.
func LDAPIdentityExpiryOpt(d time.Duration) LDAPIdentityOpt {
	return func(k *LDAPIdentity) {
		k.RequestedExpiry = d
	}
}

func stripPassword(err error) error {
	urlErr, ok := err.(*url.Error)
	if ok {
		u, _ := url.Parse(urlErr.URL)
		if u == nil {
			return urlErr
		}
		values := u.Query()
		values.Set("LDAPPassword", "xxxxx")
		u.RawQuery = values.Encode()
		urlErr.URL = u.String()
		return urlErr
	}
	return err
}

// NewLDAPIdentityWithSessionPolicy returns new credentials object that uses
// LDAP Identity with a specified session policy. The `policy` parameter must be
// a JSON string specifying the policy document.
//
// DEPRECATED: Use the `LDAPIdentityPolicyOpt` with `NewLDAPIdentity` instead.
func NewLDAPIdentityWithSessionPolicy(stsEndpoint, ldapUsername, ldapPassword, policy string) (*Credentials, error) {
	return New(&LDAPIdentity{
		Client:       &http.Client{Transport: http.DefaultTransport},
		STSEndpoint:  stsEndpoint,
		LDAPUsername: ldapUsername,
		LDAPPassword: ldapPassword,
		Policy:       policy,
	}), nil
}

// Retrieve gets the credential by calling the MinIO STS API for
// LDAP on the configured stsEndpoint.
func (k *LDAPIdentity) Retrieve() (value Value, err error) {
	u, err := url.Parse(k.STSEndpoint)
	if err != nil {
		return value, err
	}

	v := url.Values{}
	v.Set("Action", "AssumeRoleWithLDAPIdentity")
	v.Set("Version", STSVersion)
	v.Set("LDAPUsername", k.LDAPUsername)
	v.Set("LDAPPassword", k.LDAPPassword)
	if k.Policy != "" {
		v.Set("Policy", k.Policy)
	}
	if k.RequestedExpiry != 0 {
		v.Set("DurationSeconds", fmt.Sprintf("%d", int(k.RequestedExpiry.Seconds())))
	}

	u.RawQuery = v.Encode()

	req, err := http.NewRequest(http.MethodPost, u.String(), nil)
	if err != nil {
		return value, stripPassword(err)
	}

	resp, err := k.Client.Do(req)
	if err != nil {
		return value, stripPassword(err)
	}

	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return value, errors.New(resp.Status)
	}

	r := AssumeRoleWithLDAPResponse{}
	if err = xml.NewDecoder(resp.Body).Decode(&r); err != nil {
		return
	}

	cr := r.Result.Credentials
	k.SetExpiration(cr.Expiration, DefaultExpiryWindow)
	return Value{
		AccessKeyID:     cr.AccessKey,
		SecretAccessKey: cr.SecretKey,
		SessionToken:    cr.SessionToken,
		SignerType:      SignatureV4,
	}, nil
}
