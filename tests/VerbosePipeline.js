const stream = require('stream')

const possibleEvents = [
    'close',
    'data',
    'end',
    'error',
    'drain',
    'finish',
    'pipe',
    'unpipe',
    'readable'
]

const possibleSpies = [
    '_read',
    '_write',
    '_transform',
    '_destroy',
    '_flush',
    '_finish'
]

/**
 * Attach event listeners and replace all the functions with spies.
 */

module.exports = class EventSeries extends stream.Readable {
    constructor(){
        super({objectMode: true})
        this.streamSeries = []
        this.eventSeries = [] // will act as a buffer to read from
    }

    add(newStream){
        this.streamSeries.push(newStream) // store reference to new stream

        possibleSpies.forEach(spyName => {
            let spyee = newStream[spyName] // <- store old function
            newStream[spyName] = function(arg1, arg2, arg3){
                this.registerEvent(newStream, spyName)
            }

        })
        possibleEvents.forEach(eventName => {
            newStream.addEventListener(eventName, event => {
                this.registerEvent(newStream, eventName, event)
            })
        })
    }

    registerEvent(eventSource, eventName, event){
        this.eventSeries.push({
            source: eventSource.constructor.name,
            name: eventName
        })
        this.resume() // ????
    }

    _read(){
        this.eventSeries.length ? this.push(this.eventSeries.pop()) : this.pause()
    }
}
