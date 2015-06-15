package aws

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/vaughan0/go-ini"
)

var currentTime = time.Now

// Credentials are used to authenticate and authorize calls that you make to
// AWS.
type Credentials struct {
	AccessKeyID     string
	SecretAccessKey string
	SessionToken    string
}

// A CredentialsProvider is a provider of credentials.
type CredentialsProvider interface {
	// Credentials returns a set of credentials (or an error if no credentials
	// could be provided).
	Credentials() (*Credentials, error)
}

var (
	// ErrAccessKeyIDNotFound is returned when the AWS Access Key ID can't be
	// found in the process's environment.
	ErrAccessKeyIDNotFound = fmt.Errorf("AWS_ACCESS_KEY_ID or AWS_ACCESS_KEY not found in environment")
	// ErrSecretAccessKeyNotFound is returned when the AWS Secret Access Key
	// can't be found in the process's environment.
	ErrSecretAccessKeyNotFound = fmt.Errorf("AWS_SECRET_ACCESS_KEY or AWS_SECRET_KEY not found in environment")
)

type DefaultCredentialsProvider struct {
}

func (p *DefaultCredentialsProvider) Credentials() (*Credentials, error) {
	env, err := EnvCreds()
	if err == nil {
		return env.Credentials()
	}

	profile, err := ProfileCreds("", "", 10*time.Minute)
	if err == nil {
		profileCreds, err := profile.Credentials()
		if err == nil {
			return profileCreds, nil
		}
	}

	return IAMCreds().Credentials()
}

func DefaultCreds() CredentialsProvider {
	return &DefaultCredentialsProvider{}
}

// DetectCreds returns a CredentialsProvider based on the available information.
//
// If the access key ID and secret access key are provided, it returns a basic
// provider.
//
// If credentials are available via environment variables, it returns an
// environment provider.
//
// If a profile configuration file is available in the default location and has
// a default profile configured, it returns a profile provider.
//
// Otherwise, it returns an IAM instance provider.
func DetectCreds(accessKeyID, secretAccessKey, sessionToken string) CredentialsProvider {
	if accessKeyID != "" && secretAccessKey != "" {
		return Creds(accessKeyID, secretAccessKey, sessionToken)
	}

	env, err := EnvCreds()
	if err == nil {
		return env
	}

	profile, err := ProfileCreds("", "", 10*time.Minute)
	if err != nil {
		return IAMCreds()
	}

	_, err = profile.Credentials()
	if err != nil {
		return IAMCreds()
	}

	return profile
}

// EnvCreds returns a static provider of AWS credentials from the process's
// environment, or an error if none are found.
func EnvCreds() (CredentialsProvider, error) {
	id := os.Getenv("AWS_ACCESS_KEY_ID")
	if id == "" {
		id = os.Getenv("AWS_ACCESS_KEY")
	}

	secret := os.Getenv("AWS_SECRET_ACCESS_KEY")
	if secret == "" {
		secret = os.Getenv("AWS_SECRET_KEY")
	}

	if id == "" {
		return nil, ErrAccessKeyIDNotFound
	}

	if secret == "" {
		return nil, ErrSecretAccessKeyNotFound
	}

	return Creds(id, secret, os.Getenv("AWS_SESSION_TOKEN")), nil
}

// Creds returns a static provider of credentials.
func Creds(accessKeyID, secretAccessKey, sessionToken string) CredentialsProvider {
	return staticCredentialsProvider{
		creds: Credentials{
			AccessKeyID:     accessKeyID,
			SecretAccessKey: secretAccessKey,
			SessionToken:    sessionToken,
		},
	}
}

// IAMCreds returns a provider which pulls credentials from the local EC2
// instance's IAM roles.
func IAMCreds() CredentialsProvider {
	return &iamProvider{}
}

// ProfileCreds returns a provider which pulls credentials from the profile
// configuration file.
func ProfileCreds(filename, profile string, expiry time.Duration) (CredentialsProvider, error) {
	if filename == "" {
		homeDir := os.Getenv("HOME") // *nix
		if homeDir == "" {           // Windows
			homeDir = os.Getenv("USERPROFILE")
		}
		if homeDir == "" {
			return nil, errors.New("User home directory not found.")
		}

		filename = filepath.Join(homeDir, ".aws", "credentials")
	}

	if profile == "" {
		profile = "default"
	}

	return &profileProvider{
		filename: filename,
		profile:  profile,
		expiry:   expiry,
	}, nil
}

type profileProvider struct {
	filename string
	profile  string
	expiry   time.Duration

	creds      Credentials
	m          sync.Mutex
	expiration time.Time
}

func (p *profileProvider) Credentials() (*Credentials, error) {
	p.m.Lock()
	defer p.m.Unlock()

	if p.expiration.After(currentTime()) {
		return &p.creds, nil
	}

	config, err := ini.LoadFile(p.filename)
	if err != nil {
		return nil, err
	}
	profile := config.Section(p.profile)

	accessKeyID, ok := profile["aws_access_key_id"]
	if !ok {
		return nil, fmt.Errorf("profile %s in %s did not contain aws_access_key_id", p.profile, p.filename)
	}

	secretAccessKey, ok := profile["aws_secret_access_key"]
	if !ok {
		return nil, fmt.Errorf("profile %s in %s did not contain aws_secret_access_key", p.profile, p.filename)
	}

	sessionToken := profile["aws_session_token"]

	p.creds = Credentials{
		AccessKeyID:     accessKeyID,
		SecretAccessKey: secretAccessKey,
		SessionToken:    sessionToken,
	}
	p.expiration = currentTime().Add(p.expiry)

	return &p.creds, nil
}

type iamProvider struct {
	creds      Credentials
	m          sync.Mutex
	expiration time.Time
}

var metadataCredentialsEndpoint = "http://169.254.169.254/latest/meta-data/iam/security-credentials/"

// IAMClient is the HTTP client used to query the metadata endpoint for IAM
// credentials.
var IAMClient = http.Client{
	Timeout: 1 * time.Second,
}

func (p *iamProvider) Credentials() (*Credentials, error) {
	p.m.Lock()
	defer p.m.Unlock()

	if p.expiration.After(currentTime()) {
		return &p.creds, nil
	}

	var body struct {
		Expiration      time.Time
		AccessKeyID     string
		SecretAccessKey string
		Token           string
	}

	resp, err := IAMClient.Get(metadataCredentialsEndpoint)
	if err != nil {
		return nil, fmt.Errorf("listing IAM credentials")
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	// Take the first line of the body of the metadata endpoint
	s := bufio.NewScanner(resp.Body)
	if !s.Scan() {
		return nil, fmt.Errorf("unable to find default IAM credentials")
	} else if s.Err() != nil {
		return nil, fmt.Errorf("%s listing IAM credentials", s.Err())
	}

	resp, err = IAMClient.Get(metadataCredentialsEndpoint + s.Text())
	if err != nil {
		return nil, fmt.Errorf("getting %s IAM credentials", s.Text())
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decoding %s IAM credentials", s.Text())
	}

	p.creds = Credentials{
		AccessKeyID:     body.AccessKeyID,
		SecretAccessKey: body.SecretAccessKey,
		SessionToken:    body.Token,
	}
	p.expiration = body.Expiration

	return &p.creds, nil
}

type staticCredentialsProvider struct {
	creds Credentials
}

func (p staticCredentialsProvider) Credentials() (*Credentials, error) {
	return &p.creds, nil
}
