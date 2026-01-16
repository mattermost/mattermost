// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// KV Store Conversions
// =============================================================================

// pluginKVSetOptionsFromProto converts a pb.PluginKVSetOptions to model.PluginKVSetOptions.
func pluginKVSetOptionsFromProto(opts *pb.PluginKVSetOptions) model.PluginKVSetOptions {
	if opts == nil {
		return model.PluginKVSetOptions{}
	}

	return model.PluginKVSetOptions{
		Atomic:          opts.Atomic,
		OldValue:        opts.OldValue,
		ExpireInSeconds: opts.ExpireInSeconds,
	}
}
