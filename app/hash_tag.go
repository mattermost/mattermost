// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

func (a *App) QueryHashTag(hash_tag_query *string, count uint64) ([]*string, error) {
	// Return a list of hashtags that match the query
	return a.Srv().GetStore().Post().QueryHashTag(hash_tag_query, count)
}
