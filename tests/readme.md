Tests will need to be written for when a stream...
- throws an error due to syntax error
- writes its statusCode and closes
- writes to a substream and closes when its done
- streams a substream to destination and closes when its done
- opens a (r/w) substream and then has to respond to aborted connection
- if this chain reaction looks any different via `stream.pipeline`

Have to run apache bench tests to guard against obvious memory leaks, poll /proc/*/fds to check for obvious file descriptor leaks.

There will be a test function `stream.prototype.attachAllListeners` to print out all events as they are fired, which should lead to some illuminating patterns. I hope to blog about the thorough chain reaction of each above circumstance. Pipes failing... pipes finishing empty, etc.

VerbosePipelineDebug:
A function which can be handed a stream to start listening to.
All possible stream/filesystemstream event listeners will be attached (if the event doesn't exist, it's not a problem, it will just never be emitted).
Every event handler will push an event object to a 'timeseries' :
which stream, which event, timestamp.

The result is a readable object stream: you could stream ldjson to disk for playing back/streaming to some visual interface, or you could pump it to the console:

a JSON transform...
a console transform...

The instance holds a reference to each stream its listening to, so it can say 'the stream is indexOf 3, so lets multiply the padding by 3' in order to print columns of events.

Hopefully this view will give some transparancy to how chain reactions occur.

???
Can I check if a given stream is readable, writeable, or duplex via instanceof?

Maybe it would be helpful, on stream close, to print out what events were not called?
thats an extra...
