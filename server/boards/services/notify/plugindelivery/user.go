// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugindelivery

import (
	"strings"

	"github.com/mattermost/mattermost/server/v8/boards/model"

	mm_model "github.com/mattermost/mattermost/server/public/model"
)

const (
	usernameSpecialChars = ".-_ "
)

func (pd *PluginDelivery) UserByUsername(username string) (*mm_model.User, error) {
	// check for usernames that might have trailing punctuation
	var user *mm_model.User
	var err error
	ok := true
	trimmed := username
	for ok {
		user, err = pd.api.GetUserByUsername(trimmed)
		if err != nil && !model.IsErrNotFound(err) {
			return nil, err
		}

		if err == nil {
			break
		}

		trimmed, ok = trimUsernameSpecialChar(trimmed)
	}

	if user == nil {
		return nil, err
	}

	return user, nil
}

// trimUsernameSpecialChar tries to remove the last character from word if it
// is a special character for usernames (dot, dash or underscore). If not, it
// returns the same string.
func trimUsernameSpecialChar(word string) (string, bool) {
	len := len(word)

	if len > 0 && strings.LastIndexAny(word, usernameSpecialChars) == (len-1) {
		return word[:len-1], true
	}

	return word, false
}
