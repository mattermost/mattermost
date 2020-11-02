package asynctask

import (
	"fmt"
	"sync/atomic"
	"time"

	"github.com/splitio/go-toolkit/v3/logging"
)

// AsyncTask is a struct that wraps tasks that should run periodically and can be remotely stopped & started,
// as well as making it's status (running/stopped) available.
type AsyncTask struct {
	task       func(l logging.LoggerInterface) error
	name       string
	running    atomic.Value
	incoming   chan int
	period     int
	onInit     func(l logging.LoggerInterface) error
	onStop     func(l logging.LoggerInterface)
	logger     logging.LoggerInterface
	finished   atomic.Value
	finishChan chan struct{}
}

const (
	taskMessageStop = iota
	taskMessageWakeup
)

func (t *AsyncTask) _running() bool {
	res, ok := t.running.Load().(bool)
	if !ok {
		t.logger.Error("Error parsing async task status flag")
		return false
	}
	return res
}

// Start initiates the task. It wraps the execution in a closure guarded by a call to recover() in order
// to prevent the main application from crashin if something goes wrong while the sdk interacts with the backend.
func (t *AsyncTask) Start() {

	if t._running() {
		if t.logger != nil {
			t.logger.Warning("Task %s is already running. Aborting new execution.", t.name)
		}
		return
	}
	t.running.Store(true)

	go func() {
		defer func() {
			t.finished.Store(true)
			t.finishChan <- struct{}{}
		}()
		defer func() {
			if r := recover(); r != nil {
				t.running.Store(false)
				if t.logger != nil {
					t.logger.Error(fmt.Sprintf(
						"AsyncTask %s is panicking! Delaying execution for %d seconds (1 period)",
						t.name,
						t.period,
					))
					t.logger.Error(r)
				}
				time.Sleep(time.Duration(t.period) * time.Second)
			}
		}()

		// If there's an initialization function, execute it
		if t.onInit != nil {
			err := t.onInit(t.logger)
			if err != nil {
				// If something goes wrong during initialization, abort.
				if t.logger != nil {
					t.logger.Error(err.Error())
				}
				return
			}
		}

		// Create timeout timer
		idleDuration := time.Second * time.Duration(t.period)
		taskTimer := time.NewTimer(idleDuration)
		defer taskTimer.Stop()

		// Task execution
		for t._running() {
			// Run the wrapped task and handle the returned error if any.
			err := t.task(t.logger)
			if err != nil && t.logger != nil {
				t.logger.Error(err.Error())
			}

			// Resetting timer
			taskTimer.Reset(idleDuration)

			// Wait for either a timeout or an interruption (can be a stop signal or a wake up)
			select {
			case msg := <-t.incoming:
				switch msg {
				case taskMessageStop:
					t.running.Store(false)
				case taskMessageWakeup:
				}
			case <-taskTimer.C: // Timedout
			}
		}

		// Post-execution cleanup
		if t.onStop != nil {
			t.onStop(t.logger)
		}
	}()
}

func (t *AsyncTask) sendSignal(signal int) error {
	select {
	case t.incoming <- signal:
		return nil
	default:
		return fmt.Errorf("Couldn't send message to task %s", t.name)
	}
}

// Stop executes onStop hook if any, blocks until its done (if blocking = true) and prevents future executions of the task.
func (t *AsyncTask) Stop(blocking bool) error {

	if !t._running() || t.finished.Load().(bool) {
		// Task already stopped
		return nil
	}
	if err := t.sendSignal(taskMessageStop); err != nil {
		// If the signal couldnt be sent, return error!
		return err
	}

	if blocking {
		// If blocking was set to true, wait until an empty strcut is pushed into the channel
		<-t.finishChan
	}
	return nil
}

// WakeUp interrupts the task's sleep period and resumes execution
func (t *AsyncTask) WakeUp() error {
	return t.sendSignal(taskMessageWakeup)
}

// IsRunning returns true if the task is currently running
func (t *AsyncTask) IsRunning() bool {
	return t._running()
}

// NewAsyncTask creates a new task and returns a pointer to it
func NewAsyncTask(
	name string,
	task func(l logging.LoggerInterface) error,
	period int,
	onInit func(l logging.LoggerInterface) error,
	onStop func(l logging.LoggerInterface),
	logger logging.LoggerInterface,
) *AsyncTask {
	t := AsyncTask{
		name:       name,
		task:       task,
		period:     period,
		onInit:     onInit,
		onStop:     onStop,
		logger:     logger,
		incoming:   make(chan int, 10),
		finishChan: make(chan struct{}, 1),
	}
	t.running.Store(false)
	t.finished.Store(false)
	return &t
}
