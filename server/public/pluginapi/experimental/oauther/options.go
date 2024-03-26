package oauther

import "time"

// Option defines each option that can be passed in the creation of the OAuther.
// Options functions available are OAuthURL, StorePrefix, ConnectedString and OAuth2StateTimeToLive and PayloadTimeToLive.
type Option func(*oAuther)

// OAuthURL defines the URL the OAuther will use to register its endpoints.
// Defaults to "/oauth2".
func OAuthURL(url string) Option {
	return func(o *oAuther) {
		o.oAuthURL = url
	}
}

// StorePrefix defines the prefix the OAuther will use to store information in the KVStore.
// Defaults to "oauth_".
func StorePrefix(prefix string) Option {
	return func(o *oAuther) {
		o.storePrefix = prefix
	}
}

// ConnectedString defines the string shown to the user when the oauth flow is completed.
// Defaults to "Successfully connected. Please close this window.".
func ConnectedString(text string) Option {
	return func(o *oAuther) {
		o.connectedString = text
	}
}

// OAuth2StateTimeToLive is the duration the states from the OAuth flow will live in the KVStore.
// Defaults to 5 minutes.
func OAuth2StateTimeToLive(ttl time.Duration) Option {
	return func(o *oAuther) {
		o.oAuth2StateTimeToLive = ttl
	}
}

// PayloadTimeToLive is the duration the payload from the OAuth flow will live in the KVStore.
// Defaults to 10 minutes.
func PayloadTimeToLive(ttl time.Duration) Option {
	return func(o *oAuther) {
		o.payloadTimeToLive = ttl
	}
}
