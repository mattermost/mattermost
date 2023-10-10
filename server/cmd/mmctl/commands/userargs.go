// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"net/url"
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
)

func getUsersFromUserArgs(c client.Client, userArgs []string) []*model.User {
	users := make([]*model.User, 0, len(userArgs))
	for _, userArg := range userArgs {
		user := getUserFromUserArg(c, userArg)
		users = append(users, user)
	}
	return users
}

func getUserFromUserArg(c client.Client, userArg string) *model.User {
	var user *model.User
	if !checkDots(userArg) {
		user, _, _ = c.GetUserByEmail(context.TODO(), userArg, "")
	}

	if !checkSlash(userArg) {
		if user == nil {
			user, _, _ = c.GetUserByUsername(context.TODO(), userArg, "")
		}

		if user == nil {
			user, _, _ = c.GetUser(context.TODO(), userArg, "")
		}
	}

	return user
}

// returns true if slash is found in the arg
func checkSlash(arg string) bool {
	unescapedArg, _ := url.PathUnescape(arg)
	return strings.Contains(unescapedArg, "/")
}

// returns true if double dot is found in the arg
func checkDots(arg string) bool {
	unescapedArg, _ := url.PathUnescape(arg)
	return strings.Contains(unescapedArg, "..")
}

// getUsersFromArgs obtains all the users passed by `userArgs` parameter.
// It can return users and errors at the same time
func getUsersFromArgs(c client.Client, userArgs []string) ([]*model.User, error) {
	users := make([]*model.User, 0, len(userArgs))
	var result *multierror.Error
	for _, userArg := range userArgs {
		user, err := getUserFromArg(c, userArg)
		if err != nil {
			result = multierror.Append(result, err)
			continue
		}
		users = append(users, user)
	}
	return users, result.ErrorOrNil()
}

func getUserFromArg(c client.Client, userArg string) (*model.User, error) {
	var user *model.User
	var response *model.Response
	var err error
	if !checkDots(userArg) {
		user, response, err = c.GetUserByEmail(context.TODO(), userArg, "")
		if err != nil {
			nErr := ExtractErrorFromResponse(response, err)
			var nfErr *NotFoundError
			var badRequestErr *BadRequestError
			if !errors.As(nErr, &nfErr) && !errors.As(nErr, &badRequestErr) {
				return nil, nErr
			}
		}
	}

	if !checkSlash(userArg) {
		if user == nil {
			user, response, err = c.GetUserByUsername(context.TODO(), userArg, "")
			if err != nil {
				nErr := ExtractErrorFromResponse(response, err)
				var nfErr *NotFoundError
				var badRequestErr *BadRequestError
				if !errors.As(nErr, &nfErr) && !errors.As(nErr, &badRequestErr) {
					return nil, nErr
				}
			}
		}

		if user == nil {
			user, response, err = c.GetUser(context.TODO(), userArg, "")
			if err != nil {
				nErr := ExtractErrorFromResponse(response, err)
				var nfErr *NotFoundError
				var badRequestErr *BadRequestError
				if !errors.As(nErr, &nfErr) && !errors.As(nErr, &badRequestErr) {
					return nil, nErr
				}
			}
		}
	}

	if user == nil {
		return nil, ErrEntityNotFound{Type: "user", ID: userArg}
	}

	return user, nil
}
