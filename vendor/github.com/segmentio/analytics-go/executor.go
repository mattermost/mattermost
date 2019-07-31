package analytics

import "sync"

type executor struct {
	queue chan func()
	mutex sync.Mutex
	size  int
	cap   int
}

func newExecutor(cap int) *executor {
	e := &executor{
		queue: make(chan func(), 1),
		cap:   cap,
	}
	go e.loop()
	return e
}

func (e *executor) do(task func()) (ok bool) {
	e.mutex.Lock()

	if e.size != e.cap {
		e.queue <- task
		e.size++
		ok = true
	}

	e.mutex.Unlock()
	return
}

func (e *executor) close() {
	close(e.queue)
}

func (e *executor) loop() {
	for task := range e.queue {
		go e.run(task)
	}
}

func (e *executor) run(task func()) {
	defer e.done()
	task()
}

func (e *executor) done() {
	e.mutex.Lock()
	e.size--
	e.mutex.Unlock()
}
