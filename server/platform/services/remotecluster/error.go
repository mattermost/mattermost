// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"errors"
	"fmt"
)

var (
	RemoteClusterAlreadyConfirmedError = errors.New("the remote cluster has already been confirmed")
)

type BufferFullError struct {
	capacity int
}

func NewBufferFullError(capacity int) BufferFullError {
	return BufferFullError{
		capacity: capacity,
	}
}

func (e BufferFullError) Capacity() int {
	return e.capacity
}

func (e BufferFullError) Error() string {
	return fmt.Sprintf("buffer capacity (%d) exceeded", e.capacity)
}
