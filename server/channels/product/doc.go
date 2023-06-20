// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package product defines the interfaces provided in the multi-product architecture
// framework. The service interfaces are designed to be a drop in replacement for services
// defined in the https://github.com/mattermost/mattermost-plugin-api project. Due to limitations
// such as the use of https://github.com/mattermost/mattermost-server/blob/master/plugin/api.go
// emerged this new API. Our hope is to use a single API definition or maybe even more interesting
// solutions like using the app.AppIFace instead.
package product
