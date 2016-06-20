//
// sts: This package provides types and functions to interact with the AWS STS API
//
// Depends on https://github.com/goamz/goamz
//

package sts

import (
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/goamz/goamz/aws"
)

// The STS type encapsulates operations within a specific EC2 region.
type STS struct {
	aws.Auth
	aws.Region
	private byte // Reserve the right of using private data.
}

// New creates a new STS Client.
// We can only use us-east for region because AWS..
func New(auth aws.Auth, region aws.Region) *STS {
	// Make sure we can run the package tests
	if region.Name == "" {
		return &STS{auth, region, 0}
	}
	return &STS{auth, aws.Regions["us-east-1"], 0}
}

const debug = false

// ----------------------------------------------------------------------------
// Request dispatching logic.

// Error encapsulates an error returned by the AWS STS API.
//
// See http://goo.gl/zDZbuQ  for more details.
type Error struct {
	// HTTP status code (200, 403, ...)
	StatusCode int
	// STS error code
	Code string
	// The human-oriented error message
	Message   string
	RequestId string `xml:"RequestID"`
}

func (err *Error) Error() string {
	if err.Code == "" {
		return err.Message
	}

	return fmt.Sprintf("%s (%s)", err.Message, err.Code)
}

type xmlErrors struct {
	RequestId string  `xml:"RequestId"`
	Errors    []Error `xml:"Error"`
}

func (sts *STS) query(params map[string]string, resp interface{}) error {
	params["Version"] = "2011-06-15"

	data := strings.NewReader(multimap(params).Encode())

	hreq, err := http.NewRequest("POST", sts.Region.STSEndpoint+"/", data)
	if err != nil {
		return err
	}

	hreq.Header.Set("Content-Type", "application/x-www-form-urlencoded; param=value")

	token := sts.Auth.Token()
	if token != "" {
		hreq.Header.Set("X-Amz-Security-Token", token)
	}

	signer := aws.NewV4Signer(sts.Auth, "sts", sts.Region)
	signer.Sign(hreq)

	if debug {
		log.Printf("%v -> {\n", hreq)
	}
	r, err := http.DefaultClient.Do(hreq)

	if err != nil {
		log.Printf("Error calling Amazon")
		return err
	}

	defer r.Body.Close()

	if debug {
		dump, _ := httputil.DumpResponse(r, true)
		log.Printf("response:\n")
		log.Printf("%v\n}\n", string(dump))
	}
	if r.StatusCode != 200 {
		return buildError(r)
	}
	err = xml.NewDecoder(r.Body).Decode(resp)
	return err
}

func buildError(r *http.Response) error {
	var (
		err    Error
		errors xmlErrors
	)
	xml.NewDecoder(r.Body).Decode(&errors)
	if len(errors.Errors) > 0 {
		err = errors.Errors[0]
	}

	err.RequestId = errors.RequestId
	err.StatusCode = r.StatusCode
	if err.Message == "" {
		err.Message = r.Status
	}
	return &err
}

func makeParams(action string) map[string]string {
	params := make(map[string]string)
	params["Action"] = action
	return params
}

func multimap(p map[string]string) url.Values {
	q := make(url.Values, len(p))
	for k, v := range p {
		q[k] = []string{v}
	}
	return q
}

// options for the AssumeRole function
//
// See http://goo.gl/Ld6Dbk for details
type AssumeRoleParams struct {
	DurationSeconds int
	ExternalId      string
	Policy          string
	RoleArn         string
	RoleSessionName string
}

type AssumedRoleUser struct {
	Arn           string `xml:"Arn"`
	AssumedRoleId string `xml:"AssumedRoleId"`
}

type Credentials struct {
	AccessKeyId     string    `xml:"AccessKeyId"`
	Expiration      time.Time `xml:"Expiration"`
	SecretAccessKey string    `xml:"SecretAccessKey"`
	SessionToken    string    `xml:"SessionToken"`
}

type AssumeRoleResult struct {
	AssumedRoleUser  AssumedRoleUser `xml:"AssumeRoleResult>AssumedRoleUser"`
	Credentials      Credentials     `xml:"AssumeRoleResult>Credentials"`
	PackedPolicySize int             `xml:"AssumeRoleResult>PackedPolicySize"`
	RequestId        string          `xml:"ResponseMetadata>RequestId"`
}

// AssumeRole assumes the specified role
//
// See http://goo.gl/zDZbuQ for more details.
func (sts *STS) AssumeRole(options *AssumeRoleParams) (resp *AssumeRoleResult, err error) {
	params := makeParams("AssumeRole")

	params["RoleArn"] = options.RoleArn
	params["RoleSessionName"] = options.RoleSessionName

	if options.DurationSeconds != 0 {
		params["DurationSeconds"] = strconv.Itoa(options.DurationSeconds)
	}
	if options.ExternalId != "" {
		params["ExternalId"] = options.ExternalId
	}
	if options.Policy != "" {
		params["Policy"] = options.Policy
	}

	resp = new(AssumeRoleResult)
	if err := sts.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// FederatedUser presents dentifiers for the federated user that is associated with the credentials.
//
// See http://goo.gl/uPtr7V for more details
type FederatedUser struct {
	Arn             string `xml:"Arn"`
	FederatedUserId string `xml:"FederatedUserId"`
}

// GetFederationToken wraps GetFederationToken response
//
// See http://goo.gl/Iujjeg for more details
type GetFederationTokenResult struct {
	Credentials      Credentials   `xml:"GetFederationTokenResult>Credentials"`
	FederatedUser    FederatedUser `xml:"GetFederationTokenResult>FederatedUser"`
	PackedPolicySize int           `xml:"GetFederationTokenResult>PackedPolicySize"`
	RequestId        string        `xml:"ResponseMetadata>RequestId"`
}

// GetFederationToken returns a set of temporary credentials for an AWS account or IAM user
//
// See http://goo.gl/Iujjeg for more details
func (sts *STS) GetFederationToken(name, policy string, durationSeconds int) (
	resp *GetFederationTokenResult, err error) {
	params := makeParams("GetFederationToken")
	params["Name"] = name

	if durationSeconds != 0 {
		params["DurationSeconds"] = strconv.Itoa(durationSeconds)
	}
	if policy != "" {
		params["Policy"] = policy
	}

	resp = new(GetFederationTokenResult)
	if err := sts.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// GetSessionToken wraps GetSessionToken response
//
// See http://goo.gl/v8s5Y for more details
type GetSessionTokenResult struct {
	Credentials Credentials `xml:"GetSessionTokenResult>Credentials"`
	RequestId   string      `xml:"ResponseMetadata>RequestId"`
}

// GetSessionToken returns a set of temporary credentials for an AWS account or IAM user
//
// See http://goo.gl/v8s5Y for more details
func (sts *STS) GetSessionToken(durationSeconds int, serialnNumber, tokenCode string) (
	resp *GetSessionTokenResult, err error) {
	params := makeParams("GetSessionToken")

	if durationSeconds != 0 {
		params["DurationSeconds"] = strconv.Itoa(durationSeconds)
	}
	if serialnNumber != "" {
		params["SerialNumber"] = serialnNumber
	}
	if tokenCode != "" {
		params["TokenCode"] = tokenCode
	}

	resp = new(GetSessionTokenResult)
	if err := sts.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}
