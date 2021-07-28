package workerpool

import (
	"fmt"
	"sync"
	"time"

	"github.com/splitio/go-toolkit/v4/logging"
	"github.com/splitio/go-toolkit/v4/struct/traits/lifecycle"
)

const (
	workerSignalStop = iota
)

// WorkerAdmin struct handles multiple worker execution, popping jobs from a single queue
type WorkerAdmin struct {
	queue chan interface{}
	mutex sync.RWMutex
	//signals      map[string]chan int
	workers map[string]*workerWrapper
	logger  logging.LoggerInterface
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

type workerWrapper struct {
	w         Worker
	lifecycle lifecycle.Manager
	queue     <-chan interface{}
	logger    logging.LoggerInterface
}

func (w *workerWrapper) Start() {
	if !w.lifecycle.BeginInitialization() {
		w.logger.Error(fmt.Sprintf("initialization of worker '%s' aborted. Worker not idle.", w.w.Name()))
		return
	}
	go w.do()
}

func (w *workerWrapper) Stop(blocking bool) {
	if !w.lifecycle.BeginShutdown() {
		w.logger.Error(fmt.Sprintf("shutodwn of worker '%s' aborted. Worker not running.", w.w.Name()))
		return
	}

	if blocking {
		w.lifecycle.AwaitShutdownComplete()
	}
}

func (w *workerWrapper) do() {
	defer func() {
		if r := recover(); r != nil {
			w.logger.Error(fmt.Sprintf(
				"Worker %s is panicking with the following error \"%s\" and will be shutted down.",
				w.w.Name(),
				r,
			))
			w.lifecycle.AbnormalShutdown()
		}
	}()
	defer w.lifecycle.ShutdownComplete()
	defer w.w.Cleanup()
	if !w.lifecycle.InitializationComplete() {
		return
	}
	for {
		select {
		case <-w.lifecycle.ShutdownRequested():
			return
		case msg := <-w.queue:
			if err := w.w.DoWork(msg); err != nil {
				w.w.OnError(err)
				time.Sleep(time.Duration(w.w.FailureTime()) * time.Millisecond)
			}
		}
	}
}

func newWorkerWraper(w Worker, logger logging.LoggerInterface, queue <-chan interface{}) *workerWrapper {
	worker := &workerWrapper{w: w, queue: queue, logger: logger}
	worker.lifecycle.Setup()
	worker.Start()
	return worker
}

// AddWorker registers a new worker in the admin
func (a *WorkerAdmin) AddWorker(w Worker) {
	if w == nil {
		a.logger.Error("AddWorker called with nil")
		return
	}
	a.mutex.Lock()
	defer a.mutex.Unlock()
	a.workers[w.Name()] = newWorkerWraper(w, a.logger, a.queue)
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
func (a *WorkerAdmin) StopWorker(name string, blocking bool) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()
	w, ok := a.workers[name]
	if !ok {
		return fmt.Errorf("Worker %s doesn't exist, hence it cannot be stopped", name)
	}

	w.Stop(blocking)

	return nil
}

// StopAll ends all worker's event loops
func (a *WorkerAdmin) StopAll(blocking bool) error {
	wg := sync.WaitGroup{}
	a.mutex.Lock()
	defer a.mutex.Unlock()
	for _, w := range a.workers {
		if w != nil {
			wg.Add(1)
			go func(current *workerWrapper) {
				current.Stop(true)
				wg.Done()
			}(w)
		}
	}

	if blocking {
		wg.Wait()
	}
	return nil
}

// QueueSize returns the current queue size
func (a *WorkerAdmin) QueueSize() int {
	return len(a.queue)
}

// IsWorkerRunning returns true if the worker exists and is currently running
func (a *WorkerAdmin) IsWorkerRunning(name string) bool {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	x, ok := a.workers[name]
	return ok && x.lifecycle.IsRunning()
}

// NewWorkerAdmin instantiates a new WorkerAdmin and returns a pointer to it.
func NewWorkerAdmin(queueSize int, logger logging.LoggerInterface) *WorkerAdmin {
	return &WorkerAdmin{
		workers: make(map[string]*workerWrapper, 0),
		logger:  logger,
		queue:   make(chan interface{}, queueSize),
	}
}
