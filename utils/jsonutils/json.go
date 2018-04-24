// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jsonutils

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/pkg/errors"
)

// HumanizeJsonError extracts error offsets and annotates the error with useful context
func HumanizeJsonError(data []byte, err error) error {
	if syntaxError, ok := err.(*json.SyntaxError); ok {
		return errors.Wrap(syntaxError, describeOffset(data, syntaxError.Offset))
	} else if unmarshalError, ok := err.(*json.UnmarshalTypeError); ok {
		return errors.Wrap(unmarshalError, describeOffset(data, unmarshalError.Offset))
	} else {
		return err
	}
}

func describeOffset(data []byte, offset int64) string {
	if offset < 0 || offset > int64(len(data)) {
		return fmt.Sprintf("invalid offset %d", offset)
	}

	lineSep := []byte{'\n'}

	line := bytes.Count(data[:offset], lineSep)
	lastLineOffset := int64(bytes.LastIndex(data[:offset], lineSep))
	character := offset - (lastLineOffset + 1)

	return fmt.Sprintf("parsing error at line %d, character %d", line+1, character+1)
}
