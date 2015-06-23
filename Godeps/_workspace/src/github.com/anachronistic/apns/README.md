# apns

Utilities for Apple Push Notification and Feedback Services.

[![GoDoc](https://godoc.org/github.com/anachronistic/apns?status.png)](https://godoc.org/github.com/anachronistic/apns)

## Installation

`go get github.com/anachronistic/apns`

## Documentation

- [APNS package documentation](http://godoc.org/github.com/anachronistic/apns)
- [Information on the APN JSON payloads](http://developer.apple.com/library/mac/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html)
- [Information on the APN binary protocols](http://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html)
- [Information on APN troubleshooting](http://developer.apple.com/library/ios/#technotes/tn2265/_index.html)

## Usage

### Creating pns and payloads manually
```go
package main

import (
  "fmt"
  apns "github.com/anachronistic/apns"
)

func main() {
  payload := apns.NewPayload()
  payload.Alert = "Hello, world!"
  payload.Badge = 42
  payload.Sound = "bingbong.aiff"

  pn := apns.NewPushNotification()
  pn.AddPayload(payload)

  alert, _ := pn.PayloadString()
  fmt.Println(alert)
}
```

#### Returns
```json
{
  "aps": {
    "alert": "Hello, world!",
    "badge": 42,
    "sound": "bingbong.aiff"
  }
}
```

### Using an alert dictionary for complex payloads
```go
package main

import (
  "fmt"
  apns "github.com/anachronistic/apns"
)

func main() {
  args := make([]string, 1)
  args[0] = "localized args"

  dict := apns.NewAlertDictionary()
  dict.Body = "Alice wants Bob to join in the fun!"
  dict.ActionLocKey = "Play a Game!"
  dict.LocKey = "localized key"
  dict.LocArgs = args
  dict.LaunchImage = "image.jpg"

  payload := apns.NewPayload()
  payload.Alert = dict
  payload.Badge = 42
  payload.Sound = "bingbong.aiff"

  pn := apns.NewPushNotification()
  pn.AddPayload(payload)

  alert, _ := pn.PayloadString()
  fmt.Println(alert)
}
```

#### Returns
```json
{
  "aps": {
    "alert": {
      "body": "Alice wants Bob to join in the fun!",
      "action-loc-key": "Play a Game!",
      "loc-key": "localized key",
      "loc-args": [
        "localized args"
      ],
      "launch-image": "image.jpg"
    },
    "badge": 42,
    "sound": "bingbong.aiff"
  }
}
```

### Setting custom properties
```go
package main

import (
  "fmt"
  apns "github.com/anachronistic/apns"
)

func main() {
  payload := apns.NewPayload()
  payload.Alert = "Hello, world!"
  payload.Badge = 42
  payload.Sound = "bingbong.aiff"

  pn := apns.NewPushNotification()
  pn.AddPayload(payload)

  pn.Set("foo", "bar")
  pn.Set("doctor", "who?")
  pn.Set("the_ultimate_answer", 42)

  alert, _ := pn.PayloadString()
  fmt.Println(alert)
}
```

#### Returns
```json
{
  "aps": {
    "alert": "Hello, world!",
    "badge": 42,
    "sound": "bingbong.aiff"
  },
  "doctor": "who?",
  "foo": "bar",
  "the_ultimate_answer": 42
}
```

### Sending a notification
```go
package main

import (
  "fmt"
  apns "github.com/anachronistic/apns"
)

func main() {
  payload := apns.NewPayload()
  payload.Alert = "Hello, world!"
  payload.Badge = 42
  payload.Sound = "bingbong.aiff"

  pn := apns.NewPushNotification()
  pn.DeviceToken = "YOUR_DEVICE_TOKEN_HERE"
  pn.AddPayload(payload)

  client := apns.NewClient("gateway.sandbox.push.apple.com:2195", "YOUR_CERT_PEM", "YOUR_KEY_NOENC_PEM")
  resp := client.Send(pn)

  alert, _ := pn.PayloadString()
  fmt.Println("  Alert:", alert)
  fmt.Println("Success:", resp.Success)
  fmt.Println("  Error:", resp.Error)
}
```

#### Returns
```shell
  Alert: {"aps":{"alert":"Hello, world!","badge":42,"sound":"bingbong.aiff"}}
Success: true
  Error: <nil>
```

### Checking the feedback service
```go
package main

import (
  "fmt"
  apns "github.com/anachronistic/apns"
  "os"
)

func main() {
  fmt.Println("- connecting to check for deactivated tokens (maximum read timeout =", apns.FeedbackTimeoutSeconds, "seconds)")

  client := apns.NewClient("feedback.sandbox.push.apple.com:2196", "YOUR_CERT_PEM", "YOUR_KEY_NOENC_PEM")
  go client.ListenForFeedback()

  for {
    select {
    case resp := <-apns.FeedbackChannel:
      fmt.Println("- recv'd:", resp.DeviceToken)
    case <-apns.ShutdownChannel:
      fmt.Println("- nothing returned from the feedback service")
      os.Exit(1)
    }
  }
}
```

#### Returns
```shell
- connecting to check for deactivated tokens (maximum read timeout = 5 seconds)
- nothing returned from the feedback service
exit status 1
```

Your output will differ if the service returns device tokens.

```shell
- recv'd: DEVICE_TOKEN_HERE
...etc.
```
