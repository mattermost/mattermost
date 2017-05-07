//+build !appengine

package graceful

import (
	"os"
	"os/signal"
	"syscall"
)

func signalNotify(interrupt chan<- os.Signal) {
	signal.Notify(interrupt, syscall.SIGINT, syscall.SIGTERM)
}

func sendSignalInt(interrupt chan<- os.Signal) {
	interrupt <- syscall.SIGINT
}
