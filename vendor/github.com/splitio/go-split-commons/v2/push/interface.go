package push

// Manager interface for Push Manager
type Manager interface {
	Start()
	Stop()
	StartWorkers()
	StopWorkers()
	IsRunning() bool
}
