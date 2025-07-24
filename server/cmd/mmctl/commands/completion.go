// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/spf13/cobra"
)

func noCompletion(_ *cobra.Command, _ []string, _ string) ([]string, cobra.ShellCompDirective) {
	return nil, cobra.ShellCompDirectiveNoFileComp
}

type validateArgsFn func(ctx context.Context, c client.Client, cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective)

func validateArgsWithClient(fn validateArgsFn) func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	return func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		ctx, cancel := context.WithTimeout(context.Background(), shellCompleteTimeout)
		defer cancel()

		c, _, _, err := getClient(ctx, cmd)
		if err != nil {
			return nil, cobra.ShellCompDirectiveError
		}

		return fn(ctx, c, cmd, args, toComplete)
	}
}

type fetcher[T any] func(ctx context.Context, c client.Client, page int, perPage int) ([]T, *model.Response, error) // fetcher calls the Mattermost API to fetch a list of entities T.
type matcher[T any] func(t T) []string                                                                              // matcher returns list of field that are T uses for shell completion.

func fetchAndComplete[T any](f fetcher[T], m matcher[T]) validateArgsFn {
	return func(ctx context.Context, c client.Client, cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		res := []string{}

		if toComplete == "" {
			return res, cobra.ShellCompDirectiveNoFileComp
		}

		var page int
		for {
			entities, _, err := f(ctx, c, page, DefaultPageSize)
			if err != nil {
				// Return what we got so far
				return res, cobra.ShellCompDirectiveNoFileComp
			}

			for _, e := range entities {
				for _, field := range m(e) {
					if strings.HasPrefix(field, toComplete) {
						res = append(res, field)

						// Only complete one field per entity.
						break
					}
				}
			}

			if len(res) > shellCompletionMaxItems {
				res = res[:shellCompletionMaxItems]
				break
			}

			if len(entities) < DefaultPageSize {
				break
			}

			page++
		}

		return res, cobra.ShellCompDirectiveNoFileComp
	}
}
