// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package safemapstructure

import (
	"github.com/mitchellh/mapstructure"
)

func Decode(input interface{}, output interface{}) error {
	config := &mapstructure.DecoderConfig{
		Metadata:  nil,
		Result:    output,
		MatchName: func(a string, b string) bool { return a == b }, // Only match exactly
	}

	decoder, err := mapstructure.NewDecoder(config)
	if err != nil {
		return err
	}

	return decoder.Decode(input)
}
