// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"
	"time"
)

func TestRedirectStdLog(t *testing.T) {
	log := NewRedirectStdLog("test", false)

	log.Println("[DEBUG] this is a message")
	log.Println("[DEBG] this is a message")
	log.Println("[WARN] this is a message")
	log.Println("[ERROR] this is a message")
	log.Println("[EROR] this is a message")
	log.Println("[ERR] this is a message")
	log.Println("[INFO] this is a message")
	log.Println("this is a message")

	time.Sleep(time.Second * 1)
}
