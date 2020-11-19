package workerpool

import (
	"fmt"
	"github.com/splitio/go-toolkit/v3/logging"
	"sync"
	"time"
)

const (
	workerSignalStop = iota
)

// WorkerAdmin struct handles multiple worker execution, popping jobs from a single queue
type WorkerAdmin struct {
	queue        chan interface{}
	signalsMutex sync.RWMutex
	signals      map[string]chan int
	logger       logging.LoggerInterface
	wg           sync.WaitGroup
}

// Worker interface should be implemented by concrete workers that will perform the actual job
type Worker interface {
	// Name should return a unique identifier for a particular worker
	Name() string
	// DoWork should receive a message, and perform the actual work, only an error should be returned
	DoWork(message interface{}) error
	// OnError will be called if DoWork returns an error != nil
	OnError(e error)
	// Cleanup will be called when the worker is shutting down
	Cleanup() error
	// FailureTime should return the amount of time the worker should wait after resuming work if an error occurs
	FailureTime() int64
}

func (a *WorkerAdmin) workerWrapper(w Worker) {
	a.signalsMutex.Lock()
	a.signals[w.Name()] = make(chan int, 10)
	a.signalsMutex.Unlock()
	defer a.wg.Done()
	defer func() {
		if r := recover(); r != nil {
			a.logger.Error(fmt.Sprintf(
				"Worker %s is panicking with the following error \"%s\" and will be shutted down.",
				w.Name(),
				r,
			))
		}
		if a.signals != nil { // This should ALWAYS be the case, but just in case... we don't want to panic here.
			a.signalsMutex.Lock()
			delete(a.signals, w.Name())
			a.signalsMutex.Unlock()
		}
	}()
	defer w.Cleanup()
	for {
		a.signalsMutex.RLock()
		signal := a.signals[w.Name()]
		a.signalsMutex.RUnlock()
		select {
		case msg := <-signal:
			switch msg {
			case workerSignalStop:
				return
			}
		case msg := <-a.queue:
			if err := w.DoWork(msg); err != nil {
				w.OnError(err)
				time.Sleep(time.Duration(w.FailureTime()) * time.Millisecond)
			}
		}
	}
}

// AddWorker registers a new worker in the admin
func (a *WorkerAdmin) AddWorker(w Worker) {
	if w == nil {
		a.logger.Error("AddWorker called with nil")
		return
	}
	a.wg.Add(1)
	go a.workerWrapper(w)
}

// QueueMessage adds a new message that will be popped by a worker and processed
func (a *WorkerAdmin) QueueMessage(m interface{}) bool {
	if m == nil {
		a.logger.Warning("Nil message not added to queue")
		return false
	}
	select {
	case a.queue <- m:
		return true
	default:
		return false
	}
}

// StopWorker ends the worker's event loop, preventing it from picking further jobs
func (a *WorkerAdmin) StopWorker(name string) error {
	a.signalsMutex.RLock()
	c, ok := a.signals[name]
	a.signalsMutex.RUnlock()
	if !ok {
		return fmt.Errorf("Worker %s doesn't exist, hence it cannot be stopped", name)
	}
	select {
	case c <- workerSignalStop:
	default:
		return fmt.Errorf("Couldn't send stop signal to worker %s", name)
	}
	return nil
}

// StopAll ends all worker's event loops
func (a *WorkerAdmin) StopAll(blocking bool) error {
	failed := make([]string, 0)
	workerNames := make([]string, 0)

	// Get worker names safely
	a.signalsMutex.RLock()
	for workerName := range a.signals {
		workerNames = append(workerNames, workerName)
	}
	a.signalsMutex.RUnlock()

	for _, workerName := range workerNames {
		err := a.StopWorker(workerName)
		if err != nil {
			a.logger.Error(err)
			failed = append(failed, workerName)
		}
	}
	if len(failed) > 0 {
		return fmt.Errorf("Workers %v failed to shutdown", failed)
	}

	if blocking {
		a.wg.Wait()
	}

	return nil
}

// QueueSize returns the current queue size
func (a *WorkerAdmin) QueueSize() int {
	return len(a.queue)
}

// IsWorkerRunning returns true if the worker exists and is currently running
func (a *WorkerAdmin) IsWorkerRunning(name string) bool {
	a.signalsMutex.RLock()
	_, ok := a.signals[name]
	a.signalsMutex.RUnlock()
	return ok // We consider a worker to be running if it exists in the list of valid signal channels
}

// NewWorkerAdmin instantiates a new WorkerAdmin and returns a pointer to it.
func NewWorkerAdmin(queueSize int, logger logging.LoggerInterface) *WorkerAdmin {
	return &WorkerAdmin{
		signals: make(map[string]chan int, 0),
		logger:  logger,
		queue:   make(chan interface{}, queueSize),
	}
}
