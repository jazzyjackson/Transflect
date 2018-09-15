Tests will need to be written for when a stream...
- throws an error due to syntax error
- writes its statusCode and closes
- writes to a substream and closes when its done
- streams a substream to destination and closes when its done
- opens a (r/w) substream and then has to respond to aborted connection
- if this chain reaction looks any different via `stream.pipeline`

Have to run apache bench tests to guard against obvious memory leaks, poll /proc/*/fds to check for obvious file descriptor leaks.

There will be a test function `stream.prototype.attachAllListeners` to print out all events as they are fired, which should lead to some illuminating patterns. I hope to blog about the thorough chain reaction of each above circumstance. Pipes failing... pipes finishing empty, etc.
