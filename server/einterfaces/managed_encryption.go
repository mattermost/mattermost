// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// MECryptoInterface groups the message-level encrypt/decrypt operations.
type MECryptoInterface interface {
	EncryptPostMessage(rctx request.CTX, post *model.Post) (string, error)
	DecryptPostMessage(rctx request.CTX, post *model.Post) (string, error)
}

// MEKeyLifecycleInterface groups channel key lifecycle operations.
type MEKeyLifecycleInterface interface {
	CreateChannelKey(rctx request.CTX, channelID string) error
	RevokeChannelKeyPermanent(rctx request.CTX, channelID string) error
	EvictChannelKey(rctx request.CTX, channelID string)
	HandleChannelKeyInvalidation(channelID string)
	RevokeAll()
}

// ManagedEncryptionInterface is the enterprise Managed Encryption interface. It
// composes startup with the crypto and key lifecycle sub-interfaces.
//
// TestConnection is intentionally not on this interface: the MBE plugin exposes
// its own /test-connection HTTP endpoint, and the admin console settings page
// (owned by the plugin) calls it directly.
type ManagedEncryptionInterface interface {
	Initialize(rctx request.CTX) error
	MECryptoInterface
	MEKeyLifecycleInterface
}
