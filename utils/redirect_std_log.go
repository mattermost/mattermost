// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bufio"
	"log"
	"os"
	"strings"

	l4g "github.com/alecthomas/log4go"
)

type RedirectStdLog struct {
	reader      *os.File
	writer      *os.File
	system      string
	ignoreDebug bool
}

func NewRedirectStdLog(system string, ignoreDebug bool) *log.Logger {
	r, w, _ := os.Pipe()
	logger := &RedirectStdLog{
		reader:      r,
		writer:      w,
		system:      system,
		ignoreDebug: ignoreDebug,
	}

	go func(l *RedirectStdLog) {
		scanner := bufio.NewScanner(l.reader)
		for scanner.Scan() {
			line := scanner.Text()

			if strings.Index(line, "[DEBUG]") == 0 {
				if !ignoreDebug {
					l4g.Debug("%v%v", system, line[7:])
				}
			} else if strings.Index(line, "[DEBG]") == 0 {
				if !ignoreDebug {
					l4g.Debug("%v%v", system, line[6:])
				}
			} else if strings.Index(line, "[WARN]") == 0 {
				l4g.Info("%v%v", system, line[6:])
			} else if strings.Index(line, "[ERROR]") == 0 {
				l4g.Error("%v%v", system, line[7:])
			} else if strings.Index(line, "[EROR]") == 0 {
				l4g.Error("%v%v", system, line[6:])
			} else if strings.Index(line, "[ERR]") == 0 {
				l4g.Error("%v%v", system, line[5:])
			} else if strings.Index(line, "[INFO]") == 0 {
				l4g.Info("%v%v", system, line[6:])
			} else {
				l4g.Info("%v %v", system, line)
			}
		}
	}(logger)

	return log.New(logger.writer, "", 0)
}

func (l *RedirectStdLog) Write(p []byte) (n int, err error) {
	return l.writer.Write(p)
}
