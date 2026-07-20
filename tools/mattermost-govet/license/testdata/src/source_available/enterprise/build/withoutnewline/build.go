//go:build !blah
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package withoutnewline // want "Must be an empty line between the build directive and the license"

func Build() {}
