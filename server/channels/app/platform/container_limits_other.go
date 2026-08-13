// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux

package platform

// ContainerLimits holds effective CPU and memory limits for the current container.
// Zero values indicate no limit is set (fields will be omitted from YAML output).
type ContainerLimits struct {
	CPULimit      float64
	MemoryLimitMB uint64
}

// getContainerLimits returns zero values on non-Linux platforms.
// Container limit detection via cgroups is only supported on Linux.
func getContainerLimits() (ContainerLimits, error) {
	return ContainerLimits{}, nil
}
