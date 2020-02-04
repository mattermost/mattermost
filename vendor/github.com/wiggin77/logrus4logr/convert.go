package logrus4logr

import (
	"github.com/wiggin77/logr"

	"github.com/sirupsen/logrus"
)

func convertLogRec(rec *logr.LogRec, rus *logrus.Logger) *logrus.Entry {
	entry := &logrus.Entry{
		Logger: rus,
		Data:   convertFields(rec.Fields()),
		Time:   rec.Time(),
		Level:  convertLevel(rec.Level()),
		//Caller: *runtime.Frame
		Message: rec.Msg(),
		//Buffer *bytes.Buffer
		//Context context.Context
		//err string
	}
	return entry
}

func convertLevel(lvl logr.Level) logrus.Level {
	switch lvl {
	case logr.Panic:
		return logrus.PanicLevel
	case logr.Fatal:
		return logrus.FatalLevel
	case logr.Error:
		return logrus.ErrorLevel
	case logr.Warn:
		return logrus.WarnLevel
	case logr.Info:
		return logrus.InfoLevel
	case logr.Debug:
		return logrus.DebugLevel
	case logr.Trace:
		return logrus.TraceLevel
	default:
		return logrus.InfoLevel
	}
}

func convertFields(flds logr.Fields) logrus.Fields {
	f := make(logrus.Fields, len(flds))
	for k, v := range flds {
		f[k] = v
	}
	return f
}
