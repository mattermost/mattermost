// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"slices"
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

// pluginIDCompletionF completes plugin ID arguments, skipping the IDs already given.
func pluginIDCompletionF(ctx context.Context, c client.Client, _ *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	return completePluginIDs(ctx, c, args, "", toComplete)
}

// pluginIDFlagCompletionF completes the comma-separated plugin IDs of a --plugin flag: the value
// after the last comma, skipping the IDs given before in the value or in earlier uses of the flag.
func pluginIDFlagCompletionF(ctx context.Context, c client.Client, cmd *cobra.Command, _ []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	given, _ := cmd.Flags().GetStringSlice("plugin")
	prefix := ""
	if i := strings.LastIndex(toComplete, ","); i >= 0 {
		prefix = toComplete[:i+1]
		for _, id := range strings.Split(toComplete[:i], ",") {
			given = append(given, strings.TrimSpace(id))
		}
		toComplete = toComplete[i+1:]
	}
	return completePluginIDs(ctx, c, given, prefix, toComplete)
}

// completePluginIDs completes plugin IDs, active and inactive, with the plugin's name as the
// description, skipping the IDs given. Each completion starts with prefix.
func completePluginIDs(ctx context.Context, c client.Client, given []string, prefix, toComplete string) ([]string, cobra.ShellCompDirective) {
	plugins, _, err := c.GetPlugins(ctx)
	if err != nil || plugins == nil {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}

	res := []string{}
	for _, info := range slices.Concat(plugins.Active, plugins.Inactive) {
		if info == nil || !strings.HasPrefix(info.Id, toComplete) || slices.Contains(given, info.Id) {
			continue
		}
		completion := prefix + info.Id
		// Shells split the description off at the tab, and show it on one line
		if name := strings.Join(strings.Fields(info.Name), " "); name != "" {
			completion += "\t" + name
		}
		res = append(res, completion)
		if len(res) == shellCompletionMaxItems {
			break
		}
	}

	return res, cobra.ShellCompDirectiveNoFileComp
}
