// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import "github.com/stretchr/testify/mock"

var Anything = mock.MatchedBy(func(interface{}) bool { return true })
