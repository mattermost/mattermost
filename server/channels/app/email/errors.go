// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"fmt"
	"net/http"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

var (
	CreateEmailTokenError  = errors.New("could not create token")
	SaveTokenError         = errors.New("could not save token")
	NoRateLimiterError     = errors.New("the rate limit could not be found")
	SetupRateLimiterError  = errors.New("the rate limiter could not be set")
	RateLimitExceededError = errors.New("the rate limit is exceeded")
	SendMailError          = errors.New("could not send the email")
)

// InviteBatchExceedsLimitError reports a request inviting more addresses than a user may invite
// per hour. Unlike RateLimitExceededError, waiting never lets it through.
type InviteBatchExceedsLimitError struct {
	Count int
	Limit int
}

func (e *InviteBatchExceedsLimitError) Error() string {
	return fmt.Sprintf("%d invitations exceed the limit of %d per user per hour", e.Count, e.Limit)
}

func (e *InviteBatchExceedsLimitError) AppError(where string) error {
	return model.NewAppError(where, "app.email.invite_batch_exceeds_limit.app_error", map[string]any{"Count": e.Count, "Limit": e.Limit}, "", http.StatusRequestEntityTooLarge).Wrap(e)
}
