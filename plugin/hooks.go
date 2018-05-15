// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

// Methods from the Hooks interface can be used by a plugin to respond to events. Methods are likely
// to be added over time, and plugins are not expected to implement all of them. Instead, plugins
// are expected to implement a subset of them and pass an instance to plugin/rpcplugin.Main, which
// will take over execution of the process and add default behaviors for missing hooks.
type Hooks interface {
	// OnActivate is invoked when the plugin is activated. Implementations will usually want to save
	// the api argument for later use. Loading configuration for the first time is also a commonly
	// done here.
	OnActivate(API) error

	// OnDeactivate is invoked when the plugin is deactivated. This is the plugin's last chance to
	// use the API, and the plugin will be terminated shortly after this invocation.
	OnDeactivate() error

	// OnConfigurationChange is invoked when configuration changes may have been made.
	OnConfigurationChange() error

	// ServeHTTP allows the plugin to implement the http.Handler interface. Requests destined for
	// the /plugins/{id} path will be routed to the plugin.
	//
	// The Mattermost-User-Id header will be present if (and only if) the request is by an
	// authenticated user.
	ServeHTTP(http.ResponseWriter, *http.Request)

	// ExecuteCommand executes a command that has been previously registered via the RegisterCommand
	// API.
	ExecuteCommand(args *model.CommandArgs) (*model.CommandResponse, *model.AppError)

	// MessageWillBePosted is invoked when a message is posted by a user before it is commited
	// to the database. If you also want to act on edited posts, see MessageWillBeUpdated.
	// Return values should be the modified post or nil if rejected and an explanation for the user.
	//
	// If you don't need to modify or reject posts, use MessageHasBeenPosted instead.
	//
	// Note that this method will be called for posts created by plugins, including the plugin that
	// created the post.
	MessageWillBePosted(post *model.Post) (*model.Post, string)

	// MessageWillBeUpdated is invoked when a message is updated by a user before it is commited
	// to the database. If you also want to act on new posts, see MessageWillBePosted.
	// Return values should be the modified post or nil if rejected and an explanation for the user.
	// On rejection, the post will be kept in its previous state.
	//
	// If you don't need to modify or rejected updated posts, use MessageHasBeenUpdated instead.
	//
	// Note that this method will be called for posts updated by plugins, including the plugin that
	// updated the post.
	MessageWillBeUpdated(newPost, oldPost *model.Post) (*model.Post, string)

	// MessageHasBeenPosted is invoked after the message has been commited to the databse.
	// If you need to modify or reject the post, see MessageWillBePosted
	// Note that this method will be called for posts created by plugins, including the plugin that
	// created the post.
	MessageHasBeenPosted(post *model.Post)

	// MessageHasBeenUpdated is invoked after a message is updated and has been updated in the databse.
	// If you need to modify or reject the post, see MessageWillBeUpdated
	// Note that this method will be called for posts created by plugins, including the plugin that
	// created the post.
	MessageHasBeenUpdated(newPost, oldPost *model.Post)
}
