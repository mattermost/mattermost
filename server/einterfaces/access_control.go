// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

// AccessControlServiceInterface is the interface that provides access control
// services. It combines the PolicyAdministrationPointInterface and
// PolicyDecisionPointInterface interfaces to provide a complete access control solution.
type AccessControlServiceInterface interface {
	PolicyAdministrationPointInterface
	PolicyDecisionPointInterface
}
