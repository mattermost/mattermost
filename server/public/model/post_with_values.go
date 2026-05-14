// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PostWithValues is a transient server-side wrapper that pairs a Post with
// its resolved channel-post property values, keyed by field name. It is
// passed to the Post Policy evaluator so the CEL engine can bind a `post`
// variable with an attribute map alongside the existing `user` subject.
//
// PostWithValues is never serialized to clients: the Post itself is the
// wire shape and Values is internal.
type PostWithValues struct {
	*Post
	Values map[string]any
}
