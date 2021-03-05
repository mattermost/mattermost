package asynctask

import (
	"fmt"
	"time"

	"github.com/splitio/go-toolkit/v4/logging"
	"github.com/splitio/go-toolkit/v4/struct/traits/lifecycle"
)

// AsyncTask is a struct that wraps tasks that should run periodically and can be remotely stopped & started,
// as well as making it's status (running/stopped) available.
type AsyncTask struct {
	lifecycle lifecycle.Manager
	task      func(l logging.LoggerInterface) error
	name      string
	incoming  chan int
	period    int
	onInit    func(l logging.LoggerInterface) error
	onStop    func(l logging.LoggerInterface)
	logger    logging.LoggerInterface
}

const (
	taskMessageWakeup = iota
)

// Start initiates the task. It wraps the execution in a closure guarded by a call to recover() in order
// to prevent the main application from crashin if something goes wrong while the sdk interacts with the backend.
func (t *AsyncTask) Start() {

	if !t.lifecycle.BeginInitialization() {
		if t.logger != nil {
			t.logger.Warning(fmt.Sprintf("Task %s is not idle. Aborting new execution.", t.name))
		}
		return
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				if t.logger != nil {
					t.logger.Error(fmt.Sprintf(
						"AsyncTask %s is panicking! shutting down. Consider restarting this instance and raising an issue",
						t.name,
					))
					t.logger.Error(r)
				}
			}
		}()

		defer t.lifecycle.ShutdownComplete()
		if !t.lifecycle.InitializationComplete() {
			return
		}

		// If there's an initialization function, execute it
		if t.onInit != nil {
			err := t.onInit(t.logger)
			if err != nil { // If something goes wrong during initialization, abort.
				if t.logger != nil {
					t.logger.Error(err.Error())
				}
				t.lifecycle.AbnormalShutdown()
				return
			}
		}

		// Create timeout timer
		idleDuration := time.Second * time.Duration(t.period)
		taskTimer := time.NewTimer(idleDuration)
		defer taskTimer.Stop()

		if t.onStop != nil {
			defer t.onStop(t.logger)
		}

		// Task execution
		for {
			select {
			case <-t.lifecycle.ShutdownRequested():
				return
			case <-t.incoming: // wake up signal
			case <-taskTimer.C: // Timedout
			}

			// Run the wrapped task and handle the returned error if any.
			err := t.task(t.logger)
			if err != nil && t.logger != nil {
				t.logger.Error(err.Error())
			}

			// Resetting timer
			taskTimer.Reset(idleDuration)
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
	if !t.lifecycle.BeginShutdown() {
		return fmt.Errorf("task '%s' not running", t.name)
	}

	if blocking {
		t.lifecycle.AwaitShutdownComplete()
	}
	return nil
}

// WakeUp interrupts the task's sleep period and resumes execution
func (t *AsyncTask) WakeUp() error {
	return t.sendSignal(taskMessageWakeup)
}

// IsRunning returns true if the task is currently running
func (t *AsyncTask) IsRunning() bool {
	return t.lifecycle.IsRunning()
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
		name:     name,
		task:     task,
		period:   period,
		onInit:   onInit,
		onStop:   onStop,
		logger:   logger,
		incoming: make(chan int, 10),
	}
	t.lifecycle.Setup()
	return &t
}
