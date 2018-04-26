// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jsonutils

import (
	"bytes"
	"encoding/json"

	"github.com/pkg/errors"
)

type HumanizedJsonError struct {
	Err       error
	Line      int
	Character int
}

func (e *HumanizedJsonError) Error() string {
	return e.Err.Error()
}

// HumanizeJsonError extracts error offsets and annotates the error with useful context
func HumanizeJsonError(err error, data []byte) error {
	if syntaxError, ok := err.(*json.SyntaxError); ok {
		return NewHumanizedJsonError(syntaxError, data, syntaxError.Offset)
	} else if unmarshalError, ok := err.(*json.UnmarshalTypeError); ok {
		return NewHumanizedJsonError(unmarshalError, data, unmarshalError.Offset)
	} else {
		return err
	}
}

func NewHumanizedJsonError(err error, data []byte, offset int64) *HumanizedJsonError {
	if err == nil {
		return nil
	}

	if offset < 0 || offset > int64(len(data)) {
		return &HumanizedJsonError{
			Err: errors.Wrapf(err, "invalid offset %d", offset),
		}
	}

	lineSep := []byte{'\n'}

	line := bytes.Count(data[:offset], lineSep) + 1
	lastLineOffset := bytes.LastIndex(data[:offset], lineSep)
	character := int(offset) - (lastLineOffset + 1) + 1

	return &HumanizedJsonError{
		Line:      line,
		Character: character,
		Err:       errors.Wrapf(err, "parsing error at line %d, character %d", line, character),
	}
}
