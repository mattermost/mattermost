package api

import (
	"encoding/json"

	"github.com/splitio/go-split-commons/v2/conf"
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/logging"
)

// AuthAPIClient struct is responsible for authenticating client for push services
type AuthAPIClient struct {
	client Client
	logger logging.LoggerInterface
}

// NewAuthAPIClient instantiates and return an AuthAPIClient
func NewAuthAPIClient(apikey string, cfg conf.AdvancedConfig, logger logging.LoggerInterface, metadata dtos.Metadata) *AuthAPIClient {
	return &AuthAPIClient{
		client: NewHTTPClient(apikey, cfg, cfg.AuthServiceURL, logger, metadata),
		logger: logger,
	}
}

// Authenticate performs authentication for push services
func (a *AuthAPIClient) Authenticate() (*dtos.Token, error) {
	raw, err := a.client.Get("/api/auth")
	if err != nil {
		a.logger.Error("Error while authenticating for streaming", err)
		return nil, err
	}

	token := dtos.Token{}
	err = json.Unmarshal(raw, &token)
	if err != nil {
		return nil, err
	}
	return &token, nil
}
