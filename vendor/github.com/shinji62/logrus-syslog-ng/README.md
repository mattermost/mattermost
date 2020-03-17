# Syslog Hooks for Logrus supporting TLS <img src="http://i.imgur.com/hTeVwmJ.png" width="40" height="40" alt=":walrus:" class="emoji" title=":walrus:"/>

## Description

Simple drop-in replacement for the default hook for syslog.

Adding support for TLS and using https://github.com/RackSec/srslog instead of go default `log/syslog` lib.


## Usage for tls

Only tcp+tls protocol is supported in this case

```go
import (
  syslog "github.com/RackSec/srslog"
  "github.com/Sirupsen/logrus"
  logrus_syslog "github.com/shinji62/logrus-syslog-ng"
)

func main() {
  log       := logrus.New()
  hook, err := logrus_syslog.NewSyslogHookTLS("localhost:514", syslog.LOG_INFO, "tag","./mycert.pem")

  if err == nil {
    log.Hooks.Add(hook)
  }
}
```


## Usage without TLS

Tcp, udp are supported

```go
import (
  syslog "github.com/RackSec/srslog"
  "github.com/Sirupsen/logrus"
  logrus_syslog "github.com/shinji62/logrus-syslog-ng"
)

func main() {
  log       := logrus.New()
  hook, err := logrus_syslog.NewSyslogHook("udp", "localhost:514", syslog.LOG_INFO, "")

  if err == nil {
    log.Hooks.Add(hook)
  }
}
```

If you want to connect to local syslog (Ex. "/dev/log" or "/var/run/syslog" or "/var/run/log"). Just assign empty string to the first two parameters of `NewSyslogHook`. It should look like the following.

```go
import (
  syslog "github.com/RackSec/srslog"
  "github.com/Sirupsen/logrus"
  logrus_syslog "github.com/shinji62/logrus-syslog-ng"
)

func main() {
  log       := logrus.New()
  hook, err := logrus_syslog.NewSyslogHook("", "", syslog.LOG_INFO, "")

  if err == nil {
    log.Hooks.Add(hook)
  }
}
```
