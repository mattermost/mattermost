// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PluginKVListOptions contains options for listing plugin KV store keys.
type PluginKVListOptions struct {
	Prefix string // Only return keys that start with this prefix
}
