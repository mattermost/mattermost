// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "encoding/json"

// PatchPostProperties denotes Map of group ID -> map of field ID -> value
type PatchPostProperties map[string]map[string]json.RawMessage
