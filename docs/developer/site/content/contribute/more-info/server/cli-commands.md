---
title: "CLI commands"
heading: "CLI commands and mmctl"
description: "Mattermost provides a CLI tool (mmctl) to to enable access to Mattermost Server from the command line."
date: 2022-03-15T18:40:32-04:00
weight: 5
aliases:
  - /contribute/server/cli-commands
---

As of 6.0, Mattermost CLI has been replaced by {{< newtabref href="https://github.com/mattermost/mmctl" title="mmctl" >}}. `mmctl` is built to enable access to Mattermost server from the command line. The tool leverages the public API so that administrator and user tasks can be performed.

Since `mmctl` uses the public API, an authorization mechanism is required. Which means the access rights are managed on the server side. There is a pre-run check to read credentials and use it in the client. In addition to authentication via credentials, `mmctl` can communicate to a local server without any authentication. This must be enabled via server configuration and both `mmctl` and `mattermost/server` needs to be running in the same machine.

In addition to provide more functionality towards testing and development, `db` subcommand has been added Mattermost server binary.

The CLI interface is written using {{< newtabref href="https://github.com/spf13/cobra" title="Cobra" >}}, a
powerful and modern CLI creation library. If you have never used Cobra before, it is
well documented in its {{< newtabref href="https://github.com/spf13/cobra" title="GitHub Repository" >}}.

The source code used to build our CLI interface is written in the `commands` directory of the {{< newtabref href="https://github.com/mattermost/mmctl" title="mmctl" >}} repository.

Each "command" of the CLI is stored in a different file of the
`commands` directory. Within each file, you can find
multiple "subcommands".

## Add a new subcommand

If you want to add a new subcommand in an existing mattermost command, first find the relevant file. For example, if you want to add a `show` command to
the `channel` command, go to `commands/channel.go` and add your subcommand there.

To add the subcommand, start by creating a new `Command` instance, for example:

```go
var ChannelShowCmd = &cobra.Command{
    Use:   "show",
    Short: "Show channel info",
    Long:  "Show channel information, including the name, header, purpose and the number of members.",
    Example: "  channel show --team myteam --channel mychannel"
    RunE: showChannelCmdF,
}
```

Then implement the subcommand function, in this example `showChannelCmdF`.

```go
func showChannelCmdF(c client.Client, cmd *cobra.Command, args []string) error {
    // Your code implementing the command itself
    newChannel, _, err := c.ShowChannel(channel)
	if err != nil {
		return err
	}

    return nil
}
```

Now, you set the flags of your subcommand and register it in the command. In our case we register our new `ChannelShowCmd` flag in `ChannelCmd`.

```go
func init() {
    ...

    ChannelShowCmd.Flags().String("team", "", "Team name or ID")
    ChannelShowCmd.Flags().String("channel", "", "Channel name or ID")
    ...
    ChannelCmd.AddCommand(
        ...
        ChannelShowCmd,
    )
    ...
}
```

Finally, implement unit tests in `commands/channel_test.go` and end-to-end tests to commands/channel_e2e_test.go`.

## Add a new command

If you want to add a new command to `mmctl`, first create a file for the command.
For example, if you want to add a new `emoji` command to manage emojis in
Mattermost from the CLI, create `commands/emoji.go`
and add your command and your subcommands there.

A command is exactly the same as a subcommand, so you can follow the same
steps of the previous section. However, you must also register the new command in the
"Root" command as follows:

```go
var EmojiCmd = &cobra.Command{
    Use:   "emoji",
    Short: "Emoji management",
    Long:  "Lists, creates and deletes custom emoji",
}
func init() {
    ...
    RootCmd.AddCommand(EmojiCmd)
    ...
}
```

Usually, you would then add several subcommands to perform various tasks.

## Submit your pull request

Please submit a pull request against the {{< newtabref href="https://github.com/mattermost/mmctl" title="mattermost/mmctl" >}} repository by [following these instructions]({{< ref "/contribute/more-info/server/developer-workflow" >}}).
