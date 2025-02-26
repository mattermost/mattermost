// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
)

func TestFetchAndComplete(t *testing.T) {
	type user struct {
		name     string
		position string
	}

	createUsers := func(page, perPage int) []user {
		ret := []user{}
		for i := perPage * page; i < perPage*(page+1); i++ {
			ret = append(ret, user{
				name:     fmt.Sprintf("name_%d", i),
				position: fmt.Sprintf("position_%d", i),
			})
		}
		return ret
	}

	listNames := func(n int) []string {
		ret := []string{}
		for i := 0; i < n; i++ {
			ret = append(ret, fmt.Sprintf("name_%d", i))
		}
		return ret
	}

	for name, tc := range map[string]struct {
		fetcher            func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error)
		matcher            func(t user) []string
		toComplete         string
		ExpectedCompletion []string
		ExpectedDirective  cobra.ShellCompDirective // Defaults to cobra.ShellCompDirectiveNoFileComp
	}{
		"empty query leads to empty result": {
			fetcher: func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error) {
				return []user{{name: "bob"}, {name: "alice"}}, nil, nil
			},
			matcher: func(t user) []string {
				return []string{t.name}
			},
			toComplete:         "",
			ExpectedCompletion: []string{},
		},
		"no matches": {
			fetcher: func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error) {
				return []user{{name: "bob"}, {name: "alice"}}, nil, nil
			},
			matcher: func(t user) []string {
				return []string{t.name}
			},
			toComplete:         "x",
			ExpectedCompletion: []string{},
		},
		"one element matches": {
			fetcher: func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error) {
				return []user{{name: "bob"}, {name: "alice"}}, nil, nil
			},
			matcher: func(t user) []string {
				return []string{t.name}
			},
			toComplete:         "b",
			ExpectedCompletion: []string{"bob"},
		},
		"two element matches": {
			fetcher: func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error) {
				return []user{{name: "anne"}, {name: "alice"}}, nil, nil
			},
			matcher: func(t user) []string {
				return []string{t.name}
			},
			toComplete:         "a",
			ExpectedCompletion: []string{"anne", "alice"},
		},
		"only match one fields per element": {
			fetcher: func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error) {
				return []user{{name: "bob", position: "backend"}, {name: "alice"}}, nil, nil
			},
			matcher: func(t user) []string {
				return []string{t.name, t.position}
			},
			toComplete:         "b",
			ExpectedCompletion: []string{"bob"},
		},
		"error ignored returns": {
			fetcher: func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error) {
				return []user{{name: "bob", position: "backend"}, {name: "alice"}}, nil, errors.New("some error")
			},
			matcher: func(t user) []string {
				return []string{t.name, t.position}
			},
			toComplete:         "b",
			ExpectedCompletion: []string{},
		},
		"limit to 50": {
			fetcher: func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error) {
				return createUsers(0, 200), nil, nil
			},
			matcher: func(t user) []string {
				return []string{t.name}
			},
			toComplete:         "name",
			ExpectedCompletion: listNames(50),
		},
		"request multipile pages": {
			fetcher: func(ctx context.Context, c client.Client, page int, perPage int) ([]user, *model.Response, error) {
				return createUsers(page, perPage), nil, nil
			},
			matcher: func(t user) []string {
				return []string{t.name}
			},
			toComplete: "name_4",
			ExpectedCompletion: []string{
				"name_4", "name_40", "name_41", "name_42", "name_43", "name_44", "name_45", "name_46", "name_47", "name_48", "name_49",
				"name_400", "name_401", "name_402", "name_403", "name_404", "name_405", "name_406", "name_407", "name_408", "name_409", "name_410", "name_411", "name_412",
				"name_413", "name_414", "name_415", "name_416", "name_417", "name_418", "name_419", "name_420", "name_421", "name_422", "name_423", "name_424", "name_425",
				"name_426", "name_427", "name_428", "name_429", "name_430", "name_431", "name_432", "name_433", "name_434", "name_435", "name_436", "name_437", "name_438",
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			comp, directive := fetchAndComplete[user](tc.fetcher, tc.matcher)(context.Background(), nil, nil, nil, tc.toComplete)
			assert.Equal(t, tc.ExpectedCompletion, comp, name)

			expectedDirective := cobra.ShellCompDirectiveNoFileComp
			if tc.ExpectedDirective != 0 {
				expectedDirective = tc.ExpectedDirective
			}

			assert.Equal(t, expectedDirective, directive, name)
		})
	}
}

func TestNoCompletion(t *testing.T) {
	comp, directive := noCompletion(nil, nil, "any")
	assert.Nil(t, comp)
	assert.Equal(t, cobra.ShellCompDirectiveNoFileComp, directive)
}
