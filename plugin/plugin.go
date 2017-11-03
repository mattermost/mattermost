// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// The plugin package defines the primary interfaces for interacting with a Mattermost server: the
// API and the hook interfaces.
//
// The API interface is used to perform actions. The Hook interface is used to respond to actions.
//
// Plugins should define a type that implements some of the methods from the Hook interface, then
// pass an instance of that object into the rpcplugin package's Main function (See the HelloWorld
// example.).
package plugin
