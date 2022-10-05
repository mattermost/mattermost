// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import "github.com/pkg/errors"

var (
	CreateEmailTokenError  = errors.New("could not create token")
	NoRateLimiterError     = errors.New("the rate limit could not be found")
	SetupRateLimiterError  = errors.New("the rate limiter could not be set")
	RateLimitExceededError = errors.New("the rate limit is exceeded")
	SendMailError          = errors.New("could not send the email")
)
