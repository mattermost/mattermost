package impressionlabels

// SplitNotFound label will be returned when the split requested is not present in storage
const SplitNotFound = "definition not found"

// Killed label will be returned when the split requested has been killed
const Killed = "killed"

// NoConditionMatched label will be returned when no condition of the split has matched
const NoConditionMatched = "default rule"

// MatcherNotFound label will be returned when matchertype is unknown
const MatcherNotFound = "matcher not found"

// NotInSplit label will be returned when traffic allocation fails
const NotInSplit = "not in split"

// Exception label will be returned if something goes wrong during the split evaluation
const Exception = "exception"

// ClientNotReady label will be returned when the client is not ready
const ClientNotReady = "not ready"
