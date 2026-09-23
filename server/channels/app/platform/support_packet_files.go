// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"

	"github.com/goccy/go-yaml"
	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// YAMLFile marshals a typed support-packet section into FileData. A non-nil v is written even
// when err is set, so a partially failed collector still produces its file.
func YAMLFile[T any](filename string, v *T, err error, opts ...yaml.EncodeOption) (*model.FileData, error) {
	if v == nil {
		return nil, err
	}

	body, marshalErr := yaml.MarshalWithOptions(v, opts...)
	if marshalErr != nil {
		return nil, multierror.Append(err, errors.Wrapf(marshalErr, "failed to marshal %s into yaml", filename))
	}

	return &model.FileData{
		Filename: filename,
		Body:     body,
	}, err
}

// JSONFile marshals a typed support-packet section into FileData using 4-space indentation.
func JSONFile[T any](filename string, v *T, err error) (*model.FileData, error) {
	if v == nil {
		return nil, err
	}

	body, marshalErr := json.MarshalIndent(v, "", "    ")
	if marshalErr != nil {
		return nil, multierror.Append(err, errors.Wrapf(marshalErr, "failed to marshal %s into json", filename))
	}

	return &model.FileData{
		Filename: filename,
		Body:     body,
	}, err
}
