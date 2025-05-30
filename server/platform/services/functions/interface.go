// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package functions

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// FunctionServiceInterface provides an interface for Function service functionality
// allowing plugins to register functions for AI integration
type FunctionServiceInterface interface {
	// Function management
	RegisterFunction(pluginID string, function *model.Function) *model.AppError
	UnregisterFunction(pluginID string, functionName string) *model.AppError
	UnregisterAllFunctionsForPlugin(pluginID string) *model.AppError
	GetFunction(pluginID string, functionName string) (*model.Function, *model.AppError)
	ListFunctions(ctx request.CTX, userContext *model.FunctionUserContext) ([]*model.Function, *model.AppError)
	ExecuteFunction(ctx request.CTX, pluginID string, functionName string, arguments map[string]any, userContext *model.FunctionUserContext) (*model.FunctionResult, *model.AppError)

	// Service management
	IsEnabled() bool
	GetPluginFunctions(pluginID string) ([]*model.Function, *model.AppError)
	GetStats() *model.FunctionStats

	// Lifecycle management
	Start() *model.AppError
	Stop() *model.AppError
}