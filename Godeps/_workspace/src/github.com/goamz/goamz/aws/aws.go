//
// goamz - Go packages to interact with the Amazon Web Services.
//
//   https://wiki.ubuntu.com/goamz
//
// Copyright (c) 2011 Canonical Ltd.
//
// Written by Gustavo Niemeyer <gustavo.niemeyer@canonical.com>
//
package aws

import (
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/vaughan0/go-ini"
)

// Defines the valid signers
const (
	V2Signature      = iota
	V4Signature      = iota
	Route53Signature = iota
)

// Defines the service endpoint and correct Signer implementation to use
// to sign requests for this endpoint
type ServiceInfo struct {
	Endpoint string
	Signer   uint
}

// Region defines the URLs where AWS services may be accessed.
//
// See http://goo.gl/d8BP1 for more details.
type Region struct {
	Name                   string // the canonical name of this region.
	EC2Endpoint            string
	S3Endpoint             string
	S3BucketEndpoint       string // Not needed by AWS S3. Use ${bucket} for bucket name.
	S3LocationConstraint   bool   // true if this region requires a LocationConstraint declaration.
	S3LowercaseBucket      bool   // true if the region requires bucket names to be lower case.
	SDBEndpoint            string
	SESEndpoint            string
	SNSEndpoint            string
	SQSEndpoint            string
	IAMEndpoint            string
	ELBEndpoint            string
	DynamoDBEndpoint       string
	CloudWatchServicepoint ServiceInfo
	AutoScalingEndpoint    string
	RDSEndpoint            ServiceInfo
	STSEndpoint            string
	CloudFormationEndpoint string
	ECSEndpoint            string
}

var Regions = map[string]Region{
	APNortheast.Name:  APNortheast,
	APSoutheast.Name:  APSoutheast,
	APSoutheast2.Name: APSoutheast2,
	EUCentral.Name:    EUCentral,
	EUWest.Name:       EUWest,
	USEast.Name:       USEast,
	USWest.Name:       USWest,
	USWest2.Name:      USWest2,
	USGovWest.Name:    USGovWest,
	SAEast.Name:       SAEast,
	CNNorth.Name:      CNNorth,
}

// Designates a signer interface suitable for signing AWS requests, params
// should be appropriately encoded for the request before signing.
//
// A signer should be initialized with Auth and the appropriate endpoint.
type Signer interface {
	Sign(method, path string, params map[string]string)
}

// An AWS Service interface with the API to query the AWS service
//
// Supplied as an easy way to mock out service calls during testing.
type AWSService interface {
	// Queries the AWS service at a given method/path with the params and
	// returns an http.Response and error
	Query(method, path string, params map[string]string) (*http.Response, error)
	// Builds an error given an XML payload in the http.Response, can be used
	// to process an error if the status code is not 200 for example.
	BuildError(r *http.Response) error
}

// Implements a Server Query/Post API to easily query AWS services and build
// errors when desired
type Service struct {
	service ServiceInfo
	signer  Signer
}

// Create a base set of params for an action
func MakeParams(action string) map[string]string {
	params := make(map[string]string)
	params["Action"] = action
	return params
}

// Create a new AWS server to handle making requests
func NewService(auth Auth, service ServiceInfo) (s *Service, err error) {
	var signer Signer
	switch service.Signer {
	case V2Signature:
		signer, err = NewV2Signer(auth, service)
	// case V4Signature:
	// 	signer, err = NewV4Signer(auth, service, Regions["eu-west-1"])
	default:
		err = fmt.Errorf("Unsupported signer for service")
	}
	if err != nil {
		return
	}
	s = &Service{service: service, signer: signer}
	return
}

func (s *Service) Query(method, path string, params map[string]string) (resp *http.Response, err error) {
	params["Timestamp"] = time.Now().UTC().Format(time.RFC3339)
	u, err := url.Parse(s.service.Endpoint)
	if err != nil {
		return nil, err
	}
	u.Path = path

	s.signer.Sign(method, path, params)
	if method == "GET" {
		u.RawQuery = multimap(params).Encode()
		resp, err = http.Get(u.String())
	} else if method == "POST" {
		resp, err = http.PostForm(u.String(), multimap(params))
	}

	return
}

func (s *Service) BuildError(r *http.Response) error {
	errors := ErrorResponse{}
	xml.NewDecoder(r.Body).Decode(&errors)
	var err Error
	err = errors.Errors
	err.RequestId = errors.RequestId
	err.StatusCode = r.StatusCode
	if err.Message == "" {
		err.Message = r.Status
	}
	return &err
}

type ErrorResponse struct {
	Errors    Error  `xml:"Error"`
	RequestId string // A unique ID for tracking the request
}

type Error struct {
	StatusCode int
	Type       string
	Code       string
	Message    string
	RequestId  string
}

func (err *Error) Error() string {
	return fmt.Sprintf("Type: %s, Code: %s, Message: %s",
		err.Type, err.Code, err.Message,
	)
}

type Auth struct {
	AccessKey, SecretKey string
	token                string
	expiration           time.Time
}

func (a *Auth) Token() string {
	if a.token == "" {
		return ""
	}
	if time.Since(a.expiration) >= -30*time.Second { //in an ideal world this should be zero assuming the instance is synching it's clock
		*a, _ = GetAuth("", "", "", time.Time{})
	}
	return a.token
}

func (a *Auth) Expiration() time.Time {
	return a.expiration
}

// To be used with other APIs that return auth credentials such as STS
func NewAuth(accessKey, secretKey, token string, expiration time.Time) *Auth {
	return &Auth{
		AccessKey:  accessKey,
		SecretKey:  secretKey,
		token:      token,
		expiration: expiration,
	}
}

// ResponseMetadata
type ResponseMetadata struct {
	RequestId string // A unique ID for tracking the request
}

type BaseResponse struct {
	ResponseMetadata ResponseMetadata
}

var unreserved = make([]bool, 128)
var hex = "0123456789ABCDEF"

func init() {
	// RFC3986
	u := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01234567890-_.~"
	for _, c := range u {
		unreserved[c] = true
	}
}

func multimap(p map[string]string) url.Values {
	q := make(url.Values, len(p))
	for k, v := range p {
		q[k] = []string{v}
	}
	return q
}

type credentials struct {
	Code            string
	LastUpdated     string
	Type            string
	AccessKeyId     string
	SecretAccessKey string
	Token           string
	Expiration      string
}

// GetMetaData retrieves instance metadata about the current machine.
//
// See http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AESDG-chapter-instancedata.html for more details.
func GetMetaData(path string) (contents []byte, err error) {
	url := "http://169.254.169.254/latest/meta-data/" + path

	resp, err := RetryingClient.Get(url)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err = fmt.Errorf("Code %d returned for url %s", resp.StatusCode, url)
		return
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return
	}
	return []byte(body), err
}

func getInstanceCredentials() (cred credentials, err error) {
	credentialPath := "iam/security-credentials/"

	// Get the instance role
	role, err := GetMetaData(credentialPath)
	if err != nil {
		return
	}

	// Get the instance role credentials
	credentialJSON, err := GetMetaData(credentialPath + string(role))
	if err != nil {
		return
	}

	err = json.Unmarshal([]byte(credentialJSON), &cred)
	return
}

// GetAuth creates an Auth based on either passed in credentials,
// environment information or instance based role credentials.
func GetAuth(accessKey string, secretKey, token string, expiration time.Time) (auth Auth, err error) {
	// First try passed in credentials
	if accessKey != "" && secretKey != "" {
		return Auth{accessKey, secretKey, token, expiration}, nil
	}

	// Next try to get auth from the shared credentials file
	auth, err = SharedAuth()
	if err == nil {
		// Found auth, return
		return
	}

	// Next try to get auth from the environment
	auth, err = EnvAuth()
	if err == nil {
		// Found auth, return
		return
	}

	// Next try getting auth from the instance role
	cred, err := getInstanceCredentials()
	if err == nil {
		// Found auth, return
		auth.AccessKey = cred.AccessKeyId
		auth.SecretKey = cred.SecretAccessKey
		auth.token = cred.Token
		exptdate, err := time.Parse("2006-01-02T15:04:05Z", cred.Expiration)
		if err != nil {
			err = fmt.Errorf("Error Parseing expiration date: cred.Expiration :%s , error: %s \n", cred.Expiration, err)
		}
		auth.expiration = exptdate
		return auth, err
	}
	err = errors.New("No valid AWS authentication found")
	return auth, err
}

// EnvAuth creates an Auth based on environment information.
// The AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment
// variables are used.
// AWS_SESSION_TOKEN is used if present.
func EnvAuth() (auth Auth, err error) {
	auth.AccessKey = os.Getenv("AWS_ACCESS_KEY_ID")
	if auth.AccessKey == "" {
		auth.AccessKey = os.Getenv("AWS_ACCESS_KEY")
	}

	auth.SecretKey = os.Getenv("AWS_SECRET_ACCESS_KEY")
	if auth.SecretKey == "" {
		auth.SecretKey = os.Getenv("AWS_SECRET_KEY")
	}
	if auth.AccessKey == "" {
		err = errors.New("AWS_ACCESS_KEY_ID or AWS_ACCESS_KEY not found in environment")
	}
	if auth.SecretKey == "" {
		err = errors.New("AWS_SECRET_ACCESS_KEY or AWS_SECRET_KEY not found in environment")
	}

	auth.token = os.Getenv("AWS_SESSION_TOKEN")
	return
}

// SharedAuth creates an Auth based on shared credentials stored in
// $HOME/.aws/credentials. The AWS_PROFILE environment variables is used to
// select the profile.
func SharedAuth() (auth Auth, err error) {
	var profileName = os.Getenv("AWS_PROFILE")

	if profileName == "" {
		profileName = "default"
	}

	var credentialsFile = os.Getenv("AWS_CREDENTIAL_FILE")
	if credentialsFile == "" {
		var homeDir = os.Getenv("HOME")
		if homeDir == "" {
			err = errors.New("Could not get HOME")
			return
		}
		credentialsFile = homeDir + "/.aws/credentials"
	}

	file, err := ini.LoadFile(credentialsFile)
	if err != nil {
		err = errors.New("Couldn't parse AWS credentials file")
		return
	}

	var profile = file[profileName]
	if profile == nil {
		err = errors.New("Couldn't find profile in AWS credentials file")
		return
	}

	auth.AccessKey = profile["aws_access_key_id"]
	auth.SecretKey = profile["aws_secret_access_key"]

	if auth.AccessKey == "" {
		err = errors.New("AWS_ACCESS_KEY_ID not found in environment in credentials file")
	}
	if auth.SecretKey == "" {
		err = errors.New("AWS_SECRET_ACCESS_KEY not found in credentials file")
	}
	return
}

// Encode takes a string and URI-encodes it in a way suitable
// to be used in AWS signatures.
func Encode(s string) string {
	encode := false
	for i := 0; i != len(s); i++ {
		c := s[i]
		if c > 127 || !unreserved[c] {
			encode = true
			break
		}
	}
	if !encode {
		return s
	}
	e := make([]byte, len(s)*3)
	ei := 0
	for i := 0; i != len(s); i++ {
		c := s[i]
		if c > 127 || !unreserved[c] {
			e[ei] = '%'
			e[ei+1] = hex[c>>4]
			e[ei+2] = hex[c&0xF]
			ei += 3
		} else {
			e[ei] = c
			ei += 1
		}
	}
	return string(e[:ei])
}
