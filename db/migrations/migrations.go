// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate go-bindata -prefix db/migrations --nometadata -pkg migrations ./mysql/... ./postgres/...

package migrations
