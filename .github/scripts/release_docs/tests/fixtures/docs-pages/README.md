The docs pages the release docs PR edits, as they were before the v12.1 release (the server
releases table's newest row is v12.0), and the ESR support snippets the ESR docs PR edits
(test_esr.py). The tests read these instead of the checkout's docs, so a release published on
master doesn't change what they compute.
