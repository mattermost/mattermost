// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This package provides aliases for the contents of "github.com/stretchr/testify/mock". Because
// external packages can't import our vendored dependencies, this is necessary for them to be able
// to fully utilize the plugintest package.
package mock

import (
	"github.com/stretchr/testify/mock"
)

const (
	Anything = mock.Anything
)

type Arguments = mock.Arguments
type AnythingOfTypeArgument = mock.AnythingOfTypeArgument
type Call = mock.Call
type Mock = mock.Mock
type TestingT = mock.TestingT

func AnythingOfType(t string) AnythingOfTypeArgument {
	return mock.AnythingOfType(t)
}

func AssertExpectationsForObjects(t TestingT, testObjects ...any) bool {
	return mock.AssertExpectationsForObjects(t, testObjects...)
}

func MatchedBy(fn any) any {
	return mock.MatchedBy(fn)
}
