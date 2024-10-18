package main

import (
	"context"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"golang.org/x/exp/rand"
)

var platforms []string = []string{"android_rn-v2", "apple_rnbeta-v2", ""}
var notificationDisabled []string = []string{"true", "false", ""}
var versions []string = []string{"2.20.0", "2.21.0", "2.21.1", "2.22.0", ""}

func main() {
	client := model.NewAPIv4Client("http://192.168.1.71:8065")

	rand.Seed(uint64(time.Now().UnixNano()))

	for idx := 1; idx < 60; idx++ {
		user := fmt.Sprintf("user-%d@sample.mattermost.com", idx)
		password := fmt.Sprintf("SampleUs@r-%d", idx)
		for i := 0; i < 500; i++ {
			pickPlatform := platforms[rand.Intn(len(platforms))]
			pickVersion := versions[rand.Intn(len(versions))]
			pickNotifications := ""

			if pickPlatform != "" {
				pickPlatform = fmt.Sprintf("%s:%v", pickPlatform, rand.Int())
			}

			if pickVersion != "" {
				pickNotifications = notificationDisabled[rand.Intn(len(notificationDisabled))]
			}
			client.Login(context.Background(), user, password)
			client.AttachDeviceProps(context.Background(), map[string]string{
				model.SessionPropDeviceNotificationDisabled: pickNotifications,
				model.SessionPropMobileVersion:              pickVersion,
				"device_id":                                 pickPlatform,
			})
		}
	}
}
