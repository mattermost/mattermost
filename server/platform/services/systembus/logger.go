package systembus

import (
	"github.com/ThreeDotsLabs/watermill"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type watermillLoggerAdapter struct {
	logger *mlog.Logger
}

func newWatermillLoggerAdapter(logger *mlog.Logger) watermill.LoggerAdapter {
	return &watermillLoggerAdapter{
		logger: logger,
	}
}

func (w *watermillLoggerAdapter) Error(msg string, err error, fields watermill.LogFields) {
	w.logger.Error(msg, mlog.Err(err), mlog.Any("fields", fields))
}

func (w *watermillLoggerAdapter) Info(msg string, fields watermill.LogFields) {
	w.logger.Info(msg, mlog.Any("fields", fields))
}

func (w *watermillLoggerAdapter) Debug(msg string, fields watermill.LogFields) {
	w.logger.Debug(msg, mlog.Any("fields", fields))
}

func (w *watermillLoggerAdapter) Trace(msg string, fields watermill.LogFields) {
	w.logger.Debug(msg, mlog.Any("fields", fields)) // Using debug since mlog doesn't have trace
}

func (w *watermillLoggerAdapter) With(fields watermill.LogFields) watermill.LoggerAdapter {
	return w
}
