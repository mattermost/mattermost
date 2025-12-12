// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
)

// AutoTranslationInterface defines the enterprise advanced auto-translation functionality.
// This interface provides methods for managing channel and user translation settings,
// and performing translations on content.
type AutoTranslationInterface interface {
	// IsChannelEnabled checks if auto-translation is enabled for a channel.
	// Returns false if the feature is unavailable (license, config, etc.).
	IsChannelEnabled(channelID string) (bool, *model.AppError)

	// SetChannelEnabled enables or disables auto-translation for a channel.
	// Only available when the feature is properly licensed and configured.
	SetChannelEnabled(channelID string, enabled bool) *model.AppError

	// IsUserEnabled checks if auto-translation is enabled for a specific user in a channel.
	// This checks both channel enablement AND user opt-in status.
	// Returns false if the feature is unavailable or the user hasn't opted in.
	IsUserEnabled(channelID, userID string) (bool, *model.AppError)

	// SetUserEnabled enables or disables auto-translation for a user in a channel.
	// Only available when the feature is properly licensed and configured.
	SetUserEnabled(channelID, userID string, enabled bool) *model.AppError

	// Translate translates content in a channel.
	//
	// Parameters:
	//   - ctx: context for cancellation, deadlines, and request-scoped values (e.g., translation path for metrics)
	//   - objectType: type of content being translated (e.g., "post", "playbook_run")
	//   - objectID: unique identifier for the object
	//   - channelID: channel containing the object
	//   - userID: user requesting the translation
	//   - content: the content to translate (string, json.RawMessage, map[string]any or *model.Post)
	//
	// Returns:
	//   - Translation with state indicating success, skip, or unavailability for the requesting user
	//   - nil, nil if the user hasn't opted in or the source content language matches the user's preferred language (translations still fans out to channel)
	//   - error if a critical failure occurs
	Translate(ctx context.Context, objectType, objectID, channelID, userID string, content any) (*model.Translation, *model.AppError)

	// GetBatch fetches a batch of translations for a list of object IDs and a destination language.
	// This is used for efficiently populating translations for list views (e.g., channel history).
	GetBatch(objectIDs []string, dstLang string) (map[string]*model.Translation, *model.AppError)

	// GetUserLanguage returns the preferred language for a user in a channel if auto-translation is enabled.
	// Returns the language code or error.
	GetUserLanguage(userID, channelID string) (string, *model.AppError)

	// Close cleans up resources used by the auto-translation implementation.
	// This includes removing the config listener and shutting down the provider if present.
	Close() error

	// Start initializes and starts the auto-translation service, including workers.
	Start() error

	// Shutdown gracefully shuts down the auto-translation service.
	Shutdown() error
}
