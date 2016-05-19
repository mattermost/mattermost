// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

type ClusterInterface interface {
	StartInterNodeCommunication()
	StopInterNodeCommunication()
}

var theClusterInterface ClusterInterface

func RegisterClusterInterface(newInterface ClusterInterface) {
	theClusterInterface = newInterface
}

func GetClusterInterface() ClusterInterface {
	return theClusterInterface
}
