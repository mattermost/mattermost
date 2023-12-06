// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"io"
)

var ErrSizeLimitExceeded = errors.New("size limit exceeded")

type LimitedReaderWithError struct {
	limitedReader *io.LimitedReader
}

func NewLimitedReaderWithError(reader io.Reader, maxBytes int64) *LimitedReaderWithError {
	return &LimitedReaderWithError{
		limitedReader: &io.LimitedReader{R: reader, N: maxBytes + 1},
	}
}

func (l *LimitedReaderWithError) Read(p []byte) (int, error) {
	n, err := l.limitedReader.Read(p)
	if l.limitedReader.N <= 0 && err == io.EOF {
		return n, ErrSizeLimitExceeded
	}
	return n, err
}
