//+build appengine

package graceful

import "os"

func signalNotify(interrupt chan<- os.Signal) {
	// Does not notify in the case of AppEngine.
}

func sendSignalInt(interrupt chan<- os.Signal) {
	// Does not send in the case of AppEngine.
}
