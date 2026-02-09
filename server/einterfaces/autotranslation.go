// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	ejobs "github.com/mattermost/mattermost/server/v8/einterfaces/jobs"
)

// AutoTranslationInterface defines the enterprise advanced auto-translation functionality.
// This interface provides methods for managing channel and user translation settings,
// and performing translations on content.
type AutoTranslationInterface interface {
	// IsFeatureAvailable checks if the auto-translation feature is available.
	// Returns true if license, feature flag, and config all allow auto-translation.
	// Callers should check this before calling other methods to handle unavailability gracefully.
	IsFeatureAvailable() bool

	// IsChannelEnabled checks if auto-translation is enabled for a channel.
	// Returns false if the feature is unavailable (license, config, etc.).
	IsChannelEnabled(channelID string) (bool, *model.AppError)

	// IsUserEnabled checks if auto-translation is enabled for a specific user in a channel.
	// This checks both channel enablement AND user opt-in status.
	// Returns false if the feature is unavailable or the user hasn't opted in.
	IsUserEnabled(channelID, userID string) (bool, *model.AppError)

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
	//   - Translation object, nil error: Translation available or being created for the requesting user
	//   - nil, nil: User has not opted in to auto-translation (not an error - user choice)
	//   - nil, error: Feature unavailable, validation failed, DB error, or no translatable content
	//
	// Note: Translations are still initialized for other users even when returning nil, nil for a non-opted-in user.
	Translate(ctx context.Context, objectType, objectID, channelID, userID string, content any) (*model.Translation, *model.AppError)

	// GetBatch fetches a batch of translations for a list of object IDs and a destination language.
	// This is used for efficiently populating translations for list views (e.g., channel history).
	// Returns error if the feature is unavailable.
	GetBatch(objectType string, objectIDs []string, dstLang string) (map[string]*model.Translation, *model.AppError)

	// GetUserLanguage returns the preferred language for a user in a channel if auto-translation is enabled.
	// Returns the language code or error if feature is unavailable.
	GetUserLanguage(userID, channelID string) (string, *model.AppError)

	// DetectRemote detects the language of the provided content using the remote provider.
	// Returns error if the feature is unavailable.
	DetectRemote(ctx context.Context, text string) (string, *float64, *model.AppError)

	// Close cleans up resources used by the auto-translation implementation.
	// This includes removing the config listener and shutting down the provider if present.
	Close() error

	// Start initializes and starts the auto-translation service, including workers.
	Start() error

	// Shutdown gracefully shuts down the auto-translation service.
	Shutdown() error

	// MakeWorker creates a worker for the autotranslation recovery sweep job.
	// The worker picks up stuck translations and re-queues them for processing.
	MakeWorker() model.Worker

	// MakeScheduler creates a scheduler for the autotranslation recovery sweep job.
	// The scheduler runs periodically to detect stuck translations.
	MakeScheduler() ejobs.Scheduler
}
