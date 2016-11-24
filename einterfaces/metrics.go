// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

type MetricsInterface interface {
	StartServer()
	StopServer()

	IncrementPostCreate()
	IncrementPostSentEmail()
	IncrementPostSentPush()
	IncrementPostBroadcast()
	IncrementPostFileAttachment(count int)

	IncrementHttpRequest()
	IncrementHttpError()
	ObserveHttpRequestDuration(elapsed float64)

	IncrementLogin()
	IncrementLoginFail()
}

var theMetricsInterface MetricsInterface

func RegisterMetricsInterface(newInterface MetricsInterface) {
	theMetricsInterface = newInterface
}

func GetMetricsInterface() MetricsInterface {
	return theMetricsInterface
}
