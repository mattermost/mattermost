// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package functions

import (
	"fmt"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Service implements the FunctionServiceInterface
type Service struct {
	// Configuration
	enabled bool
	logger  mlog.LoggerIFace

	// Storage for functions
	functionsMutex     sync.RWMutex
	functions          map[string]*model.Function     // key: pluginID.functionName
	functionsByPlugin  map[string][]*model.Function   // key: pluginID

	// Statistics
	statsMutex       sync.RWMutex
	functionExecutions   int64
}

// NewService creates a new Function service instance
func NewService(logger mlog.LoggerIFace) *Service {
	return &Service{
		enabled:           true,
		logger:            logger,
		functions:         make(map[string]*model.Function),
		functionsByPlugin: make(map[string][]*model.Function),
	}
}

// Start initializes the Function service
func (s *Service) Start() *model.AppError {
	if !s.enabled {
		return model.NewAppError("FunctionService.Start", "functions.service.disabled", nil, "", 500)
	}

	s.logger.Info("Starting Function service")
	return nil
}

// Stop shuts down the Function service
func (s *Service) Stop() *model.AppError {
	s.logger.Info("Stopping Function service")
	
	s.functionsMutex.Lock()
	s.functions = make(map[string]*model.Function)
	s.functionsByPlugin = make(map[string][]*model.Function)
	s.functionsMutex.Unlock()

	return nil
}

// IsEnabled returns whether the Function service is enabled
func (s *Service) IsEnabled() bool {
	return s.enabled
}

// Function Management

// RegisterFunction registers a new function for the specified plugin
func (s *Service) RegisterFunction(pluginID string, function *model.Function) *model.AppError {
	if !s.enabled {
		return model.NewAppError("FunctionService.RegisterFunction", "functions.service.disabled", nil, "", 500)
	}

	if pluginID == "" {
		return model.NewAppError("FunctionService.RegisterFunction", "functions.register_function.plugin_id.app_error", nil, "", 400)
	}

	if err := function.IsValid(); err != nil {
		return err
	}

	// Set the plugin ID
	function.PluginID = pluginID
	
	s.functionsMutex.Lock()
	defer s.functionsMutex.Unlock()

	functionKey := s.getFunctionKey(pluginID, function.Name)
	
	// Check if function already exists
	if _, exists := s.functions[functionKey]; exists {
		return model.NewAppError("FunctionService.RegisterFunction", "functions.register_function.exists.app_error", 
			map[string]any{"PluginID": pluginID, "FunctionName": function.Name}, "", 400)
	}

	// Register the function
	s.functions[functionKey] = function

	// Add to plugin functions list
	s.functionsByPlugin[pluginID] = append(s.functionsByPlugin[pluginID], function)

	s.logger.Debug("Registered function", 
		mlog.String("plugin_id", pluginID), 
		mlog.String("function_name", function.Name))

	return nil
}

// UnregisterFunction removes a function for the specified plugin
func (s *Service) UnregisterFunction(pluginID string, functionName string) *model.AppError {
	if !s.enabled {
		return model.NewAppError("FunctionService.UnregisterFunction", "functions.service.disabled", nil, "", 500)
	}

	s.functionsMutex.Lock()
	defer s.functionsMutex.Unlock()

	functionKey := s.getFunctionKey(pluginID, functionName)
	
	if _, exists := s.functions[functionKey]; !exists {
		return model.NewAppError("FunctionService.UnregisterFunction", "functions.unregister_function.not_found.app_error", 
			map[string]any{"PluginID": pluginID, "FunctionName": functionName}, "", 404)
	}

	// Remove from functions map
	delete(s.functions, functionKey)

	// Remove from plugin functions list
	if pluginFunctions, exists := s.functionsByPlugin[pluginID]; exists {
		for i, function := range pluginFunctions {
			if function.Name == functionName {
				s.functionsByPlugin[pluginID] = append(pluginFunctions[:i], pluginFunctions[i+1:]...)
				break
			}
		}
		
		// Clean up empty plugin entry
		if len(s.functionsByPlugin[pluginID]) == 0 {
			delete(s.functionsByPlugin, pluginID)
		}
	}

	s.logger.Debug("Unregistered function", 
		mlog.String("plugin_id", pluginID), 
		mlog.String("function_name", functionName))

	return nil
}

// UnregisterAllFunctionsForPlugin removes all functions for the specified plugin
func (s *Service) UnregisterAllFunctionsForPlugin(pluginID string) *model.AppError {
	if !s.enabled {
		return model.NewAppError("FunctionService.UnregisterAllFunctionsForPlugin", "functions.service.disabled", nil, "", 500)
	}

	s.functionsMutex.Lock()
	defer s.functionsMutex.Unlock()

	pluginFunctions, exists := s.functionsByPlugin[pluginID]
	if !exists {
		return nil // No functions to unregister
	}

	// Remove all functions for this plugin
	for _, function := range pluginFunctions {
		functionKey := s.getFunctionKey(pluginID, function.Name)
		delete(s.functions, functionKey)
	}

	// Remove plugin entry
	delete(s.functionsByPlugin, pluginID)

	s.logger.Debug("Unregistered all functions for plugin", 
		mlog.String("plugin_id", pluginID), 
		mlog.Int("count", len(pluginFunctions)))

	return nil
}

// GetFunction retrieves a specific function
func (s *Service) GetFunction(pluginID string, functionName string) (*model.Function, *model.AppError) {
	if !s.enabled {
		return nil, model.NewAppError("FunctionService.GetFunction", "functions.service.disabled", nil, "", 500)
	}

	s.functionsMutex.RLock()
	defer s.functionsMutex.RUnlock()

	functionKey := s.getFunctionKey(pluginID, functionName)
	function, exists := s.functions[functionKey]
	if !exists {
		return nil, model.NewAppError("FunctionService.GetFunction", "functions.get_function.not_found.app_error", 
			map[string]any{"PluginID": pluginID, "FunctionName": functionName}, "", 404)
	}

	return function, nil
}

// ListFunctions returns all functions available to the user based on their context
func (s *Service) ListFunctions(ctx request.CTX, userContext *model.FunctionUserContext) ([]*model.Function, *model.AppError) {
	if !s.enabled {
		return nil, model.NewAppError("FunctionService.ListFunctions", "functions.service.disabled", nil, "", 500)
	}

	if err := userContext.IsValid(); err != nil {
		return nil, err
	}

	s.functionsMutex.RLock()
	defer s.functionsMutex.RUnlock()

	var availableFunctions []*model.Function
	for _, function := range s.functions {
		if s.hasRequiredPermissions(userContext, function.Permissions) {
			availableFunctions = append(availableFunctions, function)
		}
	}

	return availableFunctions, nil
}

// ExecuteFunction executes a function with the given arguments
func (s *Service) ExecuteFunction(ctx request.CTX, pluginID string, functionName string, arguments map[string]any, userContext *model.FunctionUserContext) (*model.FunctionResult, *model.AppError) {
	if !s.enabled {
		return nil, model.NewAppError("FunctionService.ExecuteFunction", "functions.service.disabled", nil, "", 500)
	}

	if err := userContext.IsValid(); err != nil {
		return nil, err
	}

	// Get the function
	function, err := s.GetFunction(pluginID, functionName)
	if err != nil {
		return nil, err
	}

	// Check permissions
	if !s.hasRequiredPermissions(userContext, function.Permissions) {
		return nil, model.NewAppError("FunctionService.ExecuteFunction", "functions.execute_function.permissions.app_error", 
			map[string]any{"PluginID": pluginID, "FunctionName": functionName}, "", 403)
	}

	// Execute the function
	result, appErr := function.Handler(arguments, userContext)
	if appErr != nil {
		s.logger.Error("Failed to execute function", 
			mlog.String("plugin_id", pluginID), 
			mlog.String("function_name", functionName),
			mlog.Err(appErr))
		return nil, appErr
	}

	// Update statistics
	s.statsMutex.Lock()
	s.functionExecutions++
	s.statsMutex.Unlock()

	s.logger.Debug("Executed function", 
		mlog.String("plugin_id", pluginID), 
		mlog.String("function_name", functionName),
		mlog.String("user_id", userContext.UserID))

	return result, nil
}

// Service Information

// GetPluginFunctions returns all functions for a specific plugin
func (s *Service) GetPluginFunctions(pluginID string) ([]*model.Function, *model.AppError) {
	s.functionsMutex.RLock()
	defer s.functionsMutex.RUnlock()

	functions, exists := s.functionsByPlugin[pluginID]
	if !exists {
		return []*model.Function{}, nil
	}

	// Return a copy to prevent modification
	result := make([]*model.Function, len(functions))
	copy(result, functions)
	return result, nil
}

// GetStats returns service statistics
func (s *Service) GetStats() *model.FunctionStats {
	s.functionsMutex.RLock()
	s.statsMutex.RLock()
	defer s.statsMutex.RUnlock()
	defer s.functionsMutex.RUnlock()

	functionsByPlugin := make(map[string]int)
	for pluginID, functions := range s.functionsByPlugin {
		functionsByPlugin[pluginID] = len(functions)
	}

	return &model.FunctionStats{
		TotalFunctions:        len(s.functions),
		FunctionsByPlugin:     functionsByPlugin,
		FunctionExecutions:    s.functionExecutions,
	}
}

// Helper methods

func (s *Service) getFunctionKey(pluginID, functionName string) string {
	return fmt.Sprintf("%s.%s", pluginID, functionName)
}

func (s *Service) hasRequiredPermissions(userContext *model.FunctionUserContext, requiredPermissions []string) bool {
	if len(requiredPermissions) == 0 {
		return true // No permissions required
	}

	// System admin has all permissions
	if userContext.IsSystemAdmin {
		return true
	}

	// Check if user has all required permissions
	userPermissionSet := make(map[string]bool)
	for _, perm := range userContext.Permissions {
		userPermissionSet[perm] = true
	}

	for _, requiredPerm := range requiredPermissions {
		if !userPermissionSet[requiredPerm] {
			return false
		}
	}

	return true
}