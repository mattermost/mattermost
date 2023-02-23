// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"context"
)

// GraphQLLogger is used to log panics that occur during query execution.
type GraphQLLogger struct {
	logger *Logger
}

func NewGraphQLLogger(logger *Logger) *GraphQLLogger {
	return &GraphQLLogger{logger: logger}
}

// LogPanic satisfies the graphql/log.Logger interface.
// It converts the panic into an error.
func (l *GraphQLLogger) LogPanic(_ context.Context, value any) {
	l.logger.Error("Error while executing GraphQL query", Any("error", value))
}
