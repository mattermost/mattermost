// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package log

import (
	"fmt"
	"os"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/nicksnyder/go-i18n/i18n"
)

const (
	DEBUG   = "[debug]"
	INFO    = "[info]"
	WARNING = "[warn]"
	ERROR   = "[error]"
)

var Level = DEBUG
var EnableConsole = true
var LogFile *os.File
var T i18n.TranslateFunc

func Open(fileLocation string) {
	file, err := os.Create(fileLocation)

	if err != nil {
		fmt.Println("Log file failed to initialize")
		panic(err)
	}

	if LogFile != nil {
		fmt.Println("Log file not nil")
		return
	}

	LogFile = file
}

func Close() {
	err := LogFile.Close()

	if err != nil {
		fmt.Println("Log file failed to close")
		panic(err)
	}

	LogFile = nil
}

func SetLocale(locale string) {
	t, _ := i18n.Tfunc(locale)
	T = func(translationID string, args ...interface{}) string {
		if translated := t(translationID, args...); translated != translationID {
			return translated
		}

		t, _ := i18n.Tfunc(model.DEFAULT_LOCALE)
		return t(translationID, args...)
	}
}

func Debug(debugId string, args ...interface{}) {
	message := fmt.Sprintf(T(debugId), args)

	log(DEBUG, message)
}

func Info(infoId string, args ...interface{}) {
	message := fmt.Sprintf(T(infoId), args)

	log(INFO, message)
}

func Warn(warnId string, args ...interface{}) {
	message := fmt.Sprintf(T(warnId), args)

	log(WARNING, message)
}

func Error(err *model.AppError) {
	err.Translate(T)

	log(ERROR, err.Error())
}

func Errorf(errString string, args ...interface{}) {
	message := fmt.Sprintf(errString, args)

	log(ERROR, message)
}

func log(logType string, message string) {
	if message == "" {
		return
	}

	fullMessage := fmt.Sprintf("%s %s \"%s\"", getTimeStamp(), logType, message)

	if shouldPrint(logType) {
		if EnableConsole {
			fmt.Println(fullMessage)
		}

		if LogFile != nil {
			LogFile.WriteString(fullMessage + "\n")
		}
	}
}

func getTimeStamp() string {
	time := time.Now()
	month, day, year := time.Month(), time.Day(), time.Year()
	hour, minute, second := time.Hour(), time.Minute(), time.Second()
	_, offset := time.Zone() // offset given in seconds

	offsetSign := '+'
	if offset < 0 {
		offsetSign = '-'
	}
	offsetHour := offset / 3600
	offsetMinute := offset % 3600

	return fmt.Sprintf("[%02d/%02d/%04d:%02d:%02d:%02d %c%02d%02d]", day, month, year, hour, minute, second, offsetSign, offsetHour, offsetMinute)
}

func shouldPrint(logType string) bool {
	if Level == INFO && logType == DEBUG {
		return false
	}

	if Level == WARNING && (logType == DEBUG || logType == INFO) {
		return false
	}

	if Level == ERROR && (logType == DEBUG || logType == INFO || logType == WARNING) {
		return false
	}

	return true
}
