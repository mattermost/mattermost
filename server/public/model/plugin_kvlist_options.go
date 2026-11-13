// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PluginKVListOptions contains the options for the KVListWithOptions plugin API method.
type PluginKVListOptions struct {
	// Prefix returns only the keys that start with this string. All characters match
	// literally. An empty prefix returns all keys.
	Prefix string
}
