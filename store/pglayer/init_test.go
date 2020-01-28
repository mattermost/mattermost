// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

func InitTest() {
	initStores()
}

func TearDownTest() {
	tearDownStores()
}
