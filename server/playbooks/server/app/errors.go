// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/pkg/errors"

// ErrNotFound used when an entity is not found.
var ErrNotFound = errors.New("not found")

// ErrChannelDisplayNameInvalid is used when a channel name is too long.
var ErrChannelDisplayNameInvalid = errors.New("channel name is invalid or too long")

// ErrPlaybookRunNotActive occurs when trying to run a command on a playbook run that has ended.
var ErrPlaybookRunNotActive = errors.New("already ended")

// ErrPlaybookRunActive occurs when trying to run a command on a playbook run that is active.
var ErrPlaybookRunActive = errors.New("already active")

// ErrMalformedPlaybookRun occurs when a playbook run is not valid.
var ErrMalformedPlaybookRun = errors.New("malformed")

// ErrDuplicateEntry occurs when failing to insert because the entry already existed.
var ErrDuplicateEntry = errors.New("duplicate entry")
