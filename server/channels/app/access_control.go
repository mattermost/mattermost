// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/google/cel-go/cel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type PolicyAdministrationPoint struct {
	env *cel.Env
}

func (s *PolicyAdministrationPoint) Init(rctx request.CTX) error {
	env, err := cel.NewEnv(
		cel.Types(&model.Subject{}),
		cel.Variable("user", cel.ObjectType("model.Subject")),
	)
	if err != nil {
		return model.NewAppError("Init", "app.pap.init.app_error", nil, err.Error(), 0)
	}
	s.env = env

	return nil
}

func (s *PolicyAdministrationPoint) GetBasicAutocomplete(rctx request.CTX, targetType string) (map[string]any, error) {
	return nil, nil
}

func (s *PolicyAdministrationPoint) CheckExpression(rctx request.CTX, expression string) ([]model.CELExpressionError, error) {
	if s.env == nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, "CEL environment is not initialized", http.StatusNotImplemented)
	}

	_, iss := s.env.Compile(expression)
	if iss != nil && iss.Err() != nil {
		errs := make([]model.CELExpressionError, len(iss.Errors()))
		for i, err := range iss.Errors() {
			errs[i] = model.CELExpressionError{
				Line:    err.Location.Line(),
				Column:  err.Location.Column(),
				Message: err.Message,
			}
		}
		return errs, nil

	}

	return []model.CELExpressionError{}, nil
}

func (s *PolicyAdministrationPoint) SavePolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, error) {
	return nil, nil
}

func (s *PolicyAdministrationPoint) GetPolicy(rctx request.CTX, id string) (*model.AccessControlPolicy, error) {
	return nil, nil
}

func (s *PolicyAdministrationPoint) ExtractAttributeFields(rctx request.CTX, targetType, expression string) ([]string, error) {
	if s.env == nil {
		return nil, model.NewAppError("ExtractAttributeFields", "app.pap.check_expression.app_error", nil, "CEL environment is not initialized", http.StatusNotImplemented)
	}

	ast, iss := s.env.Compile(expression)
	if iss != nil && iss.Err() != nil {
		return nil, model.NewAppError("ExtractAttributeFields", "app.pap.check_expression.app_error", nil, iss.Err().Error(), http.StatusBadRequest)
	}

	// Extract the attribute fields from the expression
	fields, err := ExtractAttributeFieldsFromAST(ast)
	if err != nil {
		return nil, model.NewAppError("ExtractAttributeFields", "app.pdp.test_expression.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return fields, nil
}

func (s *PolicyAdministrationPoint) DeletePolicy(rctx request.CTX, id string) error {
	return nil
}

func (a *App) CheckExpression(rctx request.CTX, expression string) ([]model.CELExpressionError, *model.AppError) {
	pap := a.Srv().ch.PAP
	if pap == nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	errs, appErr := pap.CheckExpression(rctx, expression)
	if appErr != nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return errs, nil
}

func (a *App) TestExpression(rctx request.CTX, expression string) ([]*model.User, []string, *model.AppError) {
	// pdp := a.Srv().ch.PDP
	// if pdp == nil {
	// 	return nil, nil, model.NewAppError("TestExpression", "app.pdp.test_expression.app_error", nil, "Policy Decision Point is not initialized", http.StatusNotImplemented)
	// }

	pap := a.Srv().ch.PAP
	if pap == nil {
		return nil, nil, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// extract all properties from the expression
	fields, err := a.Srv().ch.PAP.ExtractAttributeFields(rctx, "user", expression)
	if err != nil {
		return nil, nil, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	subjects, err2 := a.Srv().Store().AccessControlPolicy().GetAllSubjects(rctx)
	if err2 != nil {
		return nil, nil, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, err2.Error(), http.StatusInternalServerError)
	}

	userIDs := make([]string, 0)
	env := pap.(*PolicyAdministrationPoint).env

	ast, iss := env.Compile(expression)
	if iss != nil && iss.Err() != nil {
		return nil, nil, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, iss.Err().Error(), http.StatusBadRequest)
	}

	prg, err3 := env.Program(ast)
	if err3 != nil {
		return nil, nil, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, err3.Error(), http.StatusInternalServerError)
	}

	for _, subject := range subjects {
		// Create the evaluation map
		evalMap := map[string]interface{}{
			"user": subject,
		}
		out, _, err4 := prg.Eval(evalMap)
		if err4 != nil {
			return nil, nil, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, err4.Error(), http.StatusInternalServerError)
		}
		if out != nil && out.Type() == cel.BoolType && out.Value().(bool) {
			userIDs = append(userIDs, subject.ID)
		}
	}

	users, appErr := a.GetUsers(userIDs)
	if err != nil {
		return nil, nil, appErr
	}

	return users, fields, nil
}
