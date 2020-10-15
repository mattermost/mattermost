package cfg

// ChangedListener interface is for receiving notifications
// when one or more properties within monitored config sources
// (SourceMonitored) have changed values.
type ChangedListener interface {

	// Changed is called when one or more properties in a `SourceMonitored` has a
	// changed value.
	ConfigChanged(cfg *Config, src SourceMonitored)
}
