// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package graphql

import (
	"encoding/json"
)

// Define the scalar JSON type declared in the GraphQL schema
type JSON json.RawMessage
