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
	// This method returns the translation for the requesting user immediately if available,
	// and asynchronously fans out translations to other users with active WebSocket connections (ADLS).
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
	//   - nil, nil if the user hasn't opted in or the source content language matches the user's preferred language (translations still fan out to other users)
	//   - error if a critical failure occurs
	Translate(ctx context.Context, objectType, objectID, channelID, userID string, content any) (*model.Translation, *model.AppError)

	// GetOrWaitForTranslation retrieves a translation for a specific user, optionally waiting for in-flight creation.
	// This method is designed for WebSocket augmentation (hooks) where translations may be created asynchronously
	// by the ADLS fan-out mechanism from a Translate() call.
	//
	// The method automatically retrieves the user's language preference and skips translation if:
	//   - The user hasn't opted in to auto-translation
	//   - The source content language matches the user's preferred language (no translation needed)
	//
	// Behavior:
	//   1. Retrieves user's language preference and checks enablement
	//   2. Checks cache for existing translation (fast path)
	//   3. Checks database for existing translation
	//   4. If waitForInFlight is true and translation is currently being created by another goroutine:
	//      - Joins the singleflight group to wait for completion
	//      - Returns the translation if it completes within timeout
	//   5. Returns nil if translation is not found and not being created
	//
	// Parameters:
	//   - ctx: context for cancellation, deadlines, and request-scoped values
	//   - objectType: type of content (e.g., "post", "playbook_run")
	//   - objectID: unique identifier for the object
	//   - channelID: channel containing the object
	//   - userID: user requesting the translation (language will be looked up)
	//   - waitForInFlight: if true, waits for in-flight translations; if false, returns immediately
	//
	// Returns:
	//   - Translation if found or completed within timeout
	//   - nil, nil if not found, user not opted in, or no translation needed (caller should use original)
	//   - error only for critical failures (not for timeouts or not-found)
	//
	// Usage Example (WebSocket hook):
	//   translation, err := autoTranslation.GetOrWaitForTranslation(ctx, "post", postID, channelID, userID, true)
	GetOrWaitForTranslation(ctx context.Context, objectType, objectID, channelID, userID string, waitForInFlight bool) (*model.Translation, *model.AppError)

	// Detect detects the language of the provided content.
	// The content can be a string, json.RawMessage, map[string]any, or *model.Post.
	// Returns the ISO language code (e.g., "en", "es", "pt-BR") and an optional confidence score.
	//
	// Detection Strategy:
	//   1. First, use local library-based detection (e.g., lingua-go) for fast, offline detection
	//   2. If local detection fails or confidence is below threshold, fall back to provider's Detect API
	//   3. If both fail, return empty string (caller should decide whether to translate or skip)
	//
	// Parameters:
	//   - content: the content to detect language from (string, json.RawMessage, map[string]any, or *model.Post)
	//
	// Returns:
	//   - lang: ISO language code (e.g., "en", "es", "fr"), empty if detection fails
	//   - confidence: detection confidence (0.0 to 1.0), nil if not available
	//   - error: only for critical failures, not for failed detection
	Detect(text string) (lang string, confidence *float64, err *model.AppError)

	// Close cleans up resources used by the auto-translation implementation.
	// This includes removing the config listener and shutting down the provider if present.
	Close() error
}
