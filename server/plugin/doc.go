// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The plugin package is used by Mattermost server plugins written in go. It also enables the
// Mattermost server to manage and interact with the running plugin environment.
//
// Note that this package exports a large number of types prefixed with Z_. These are public only
// to allow their use with Hashicorp's go-plugin (and net/rpc). Do not use these directly.
package plugin
