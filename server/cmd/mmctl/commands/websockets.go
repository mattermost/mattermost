// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var WebsocketCmd = &cobra.Command{
	Use:   "websocket",
	Short: "Display websocket in a human-readable format",
	RunE:  websocketCmdF,
}

func init() {
	RootCmd.AddCommand(WebsocketCmd)
}

func websocketCmdF(cmd *cobra.Command, args []string) error {
	c, err := InitWebSocketClient()
	if err != nil {
		return err
	}
	appErr := c.Connect()
	if appErr != nil {
		return errors.New(appErr.Error())
	}

	c.Listen()
	fmt.Println("Press CTRL+C to exit")
	for {
		event := <-c.EventChannel
		data, err := event.ToJSON()
		if err != nil {
			fmt.Println(err.Error())
		} else {
			fmt.Println(string(data))
		}
	}
}
