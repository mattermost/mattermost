// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package oauther

import (
	"net/http"
	"time"

	"golang.org/x/oauth2"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-api/experimental/bot/logger"
	"github.com/mattermost/mattermost-plugin-api/experimental/common"
)

const (
	// DefaultStorePrefix is the prefix used when storing information in the KVStore by default.
	DefaultStorePrefix = "oauth_"
	// DefaultOAuthURL is the URL the OAuther will use to register its endpoints by default.
	DefaultOAuthURL = "/oauth2"
	// DefaultConnectedString is the string shown to the user when the oauth flow is completed by default.
	DefaultConnectedString = "Successfully connected. Please close this window."
	// DefaultOAuth2StateTimeToLive is the duration the states from the OAuth flow will live in the KVStore by default.
	DefaultOAuth2StateTimeToLive = 5 * time.Minute
	// DefaultPayloadTimeToLive is the duration the user payload will live in the KVStore by default.
	DefaultPayloadTimeToLive = 10 * time.Minute
)

const (
	connectURL  = "/connect"
	completeURL = "/complete"
)

// OAuther defines an object able to perform the OAuth flow.
type OAuther interface {
	// GetToken returns the oauth token for userID, or error if it does not exist or there is any store error.
	GetToken(userID string) (*oauth2.Token, error)
	// GetConnectURL returns the URL to reach in order to start the OAuth flow.
	GetConnectURL() string
	// Deauthorize removes the token for userID. Return error if there is any store error.
	Deauthorize(userID string) error
	// ServeHTTP implements http.Handler
	ServeHTTP(w http.ResponseWriter, r *http.Request)
	// AddPayload stores some information to be returned after the flow is over
	AddPayload(userID string, payload []byte) error
}

type oAuther struct {
	pluginURL             string
	config                oauth2.Config
	onConnect             func(userID string, token oauth2.Token, payload []byte)
	store                 common.KVStore
	logger                logger.Logger
	storePrefix           string
	oAuthURL              string
	connectedString       string
	oAuth2StateTimeToLive time.Duration
	payloadTimeToLive     time.Duration
}

/*
New creates a new OAuther.

- pluginURL: The base URL for the plugin (e.g. https://www.instance.com/plugins/pluginid).

- oAuthConfig: The configuration of the Authorization flow to perform.

- onConnect: What to do when the Authorization process is complete.

- store: A KVStore to store the data of the OAuther.

- l Logger: A logger to log errors during authorization.

- options: Optional options for the OAuther. Available options are StorePrefix, OAuthURL, ConnectedString and OAuth2StateTimeToLive.
*/
func New(
	pluginURL string,
	oAuthConfig oauth2.Config,
	onConnect func(userID string, token oauth2.Token, payload []byte),
	store common.KVStore,
	l logger.Logger,
	options ...Option,
) OAuther {
	o := &oAuther{
		pluginURL:             pluginURL,
		config:                oAuthConfig,
		onConnect:             onConnect,
		store:                 store,
		logger:                l,
		storePrefix:           DefaultStorePrefix,
		oAuthURL:              DefaultOAuthURL,
		connectedString:       DefaultConnectedString,
		oAuth2StateTimeToLive: DefaultOAuth2StateTimeToLive,
		payloadTimeToLive:     DefaultPayloadTimeToLive,
	}

	for _, option := range options {
		option(o)
	}

	o.config.RedirectURL = o.pluginURL + o.oAuthURL + "/complete"

	return o
}

/*
NewFromClient creates a new OAuther from the plugin api client.

- pluginapi: A plugin api client.

- pluginID: The plugin ID.

- oAuthConfig: The configuration of the Authorization flow to perform.

- onConnect: What to do when the Authorization process is complete.

- l Logger: A logger to log errors during authorization.

- options: Optional options for the OAuther. Available options are StorePrefix, OAuthURL, ConnectedString and OAuth2StateTimeToLive.
*/
func NewFromClient(
	client *pluginapi.Client,
	oAuthConfig oauth2.Config,
	onConnect func(userID string, token oauth2.Token, payload []byte),
	l logger.Logger,
	options ...Option,
) OAuther {
	return New(
		common.GetPluginURL(client),
		oAuthConfig,
		onConnect,
		&client.KV,
		l,
		options...,
	)
}

func (o *oAuther) GetConnectURL() string {
	return o.pluginURL + o.oAuthURL + "/connect"
}

func (o *oAuther) GetToken(userID string) (*oauth2.Token, error) {
	var token *oauth2.Token
	err := o.store.Get(o.getTokenKey(userID), &token)
	if err != nil {
		return nil, err
	}
	return token, nil
}

func (o *oAuther) getTokenKey(userID string) string {
	return o.storePrefix + "token_" + userID
}

func (o *oAuther) getStateKey(userID string) string {
	return o.storePrefix + "state_" + userID
}

func (o *oAuther) getPayloadKey(userID string) string {
	return o.storePrefix + "payload_" + userID
}

func (o *oAuther) Deauthorize(userID string) error {
	err := o.store.Delete(o.getTokenKey(userID))
	if err != nil {
		return err
	}

	return nil
}

func (o *oAuther) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case o.oAuthURL + connectURL:
		o.oauth2Connect(w, r)
	case o.oAuthURL + completeURL:
		o.oauth2Complete(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (o *oAuther) AddPayload(userID string, payload []byte) error {
	_, err := o.store.Set(o.getPayloadKey(userID), payload, pluginapi.SetExpiry(o.payloadTimeToLive))
	if err != nil {
		return err
	}

	return nil
}
