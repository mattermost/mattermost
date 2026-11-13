// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package i18n embeds the server's English translations for tools that run without a server.
package i18n

import _ "embed"

// English is the contents of en.json.
//
//go:embed en.json
var English []byte
