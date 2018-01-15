// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// +build linux,!amd64

package sandbox

const NATIVE_AUDIT_ARCH = 0

var AllowedSyscalls []SeccompSyscall
