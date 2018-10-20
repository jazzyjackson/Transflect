/**
---
author: Colten Jackson
license: Continuity
...
**/
const stream = require('stream')

/**
 * @extends stream.Transform
 * Attaches error handlers and keeps a reference to any open streams
 * such that if a request fails, requisite streams are closed and/or destroyed
 * hands the http.incomingStream that is being piped to
 * transflect to the _open functions, which can then read any props off the request
 */
module.exports = class Transflect extends stream.Transform {

    constructor(){
        super()
        this.openStreams = new Array
        /* calling destroy without error closes and destroys any streams in the .openStreams array */
        this.once('pipe', source => {
            this.open(source)
        }).on('error', error => {
            this.destroyed || this.destroy(error)
        }).on('end', () => {
            this.destroyed || this.destroy()
        })
    }

    /**
     * _open, _transflect, and _end 
     * @param {http.IncomingMessage} source
     * overwrite this function ! return any streams that need to be destroyed in event of failure on destination
     */
    _open(source){
        return [] /* return a stream or array of streams */
    }

    _transflect(data, done){
        done(new Error(`${this.constructor.name} has no transform function and cannot accept a request body.`))
    }

    _end(done){
        if(this.constructor.name == 'Transflect'){
            done(new Error("You've reached Transflect. No other streams were able to respond to this call. This message is for debugging purposes."))
        } else {
            done(new Error(`${this.constructor.name} has no flush function to close the connection.`))
        }
    }

    /**
     * Uses [].concat() because I get an array whether concat receives a single stream or an array of streams.
     */ 
    open(source){
        try {
            this.openStreams = this.openStreams.concat(
                this._open(this.source = source)
            ).filter(each =>
                each instanceof stream // filter undefined return values and prevent calling destroy on invalid return values
            ).map(each =>
                each.once('error', error => this.destroy(error))
            )
        } catch(error){
            this.destroyed || this.destroy(error)
        }
  
    }

    /**
     * transform is only invoked when request includes a body. If you don't intend to do anything with a body, don't overwrite this.
     */
    _transform(chunk, encoding, done){
        try {
            this._transflect(chunk, done)
        } catch(error){
            this.destroyed || this.destroy(error)
        }
    }

    /**
     * overwrite this function to conclude the response, perhaps with naught but a done(null)
     */
    _flush(done){
        try {
            this._end(done)
        } catch(error){
            this.destroyed || this.destroy(error)
        }
    }

    /**
     * DON'T overwrite _destroy unless you don't have any _openStreams to worry about! Just let me re-emit the error.
     * This gets called automatically when a value is passed to first parameter of the callback in _transform or _flush
     * But can also be called via this.destroy() anytime within the stream.
     * Since 1.0, call this.destroy without error and no error will be emitted, all _openStreams will be 'cleaned up'
     * OOOOhhhhh 'cleanup' is necessary because if event listeners are attached, stream can't be garbage collected, right?
     */
    _destroy(error){
        error && process.nextTick(()=>{
            this.emit('error', error)
        })
        this.openStreams.forEach(openStream => {
            openStream.close && openStream.close()
            openStream.destroy && openStream.destroy()
        })
    }

    /**
     * @return {(stream)}
     * I only ever expect to have one destiantion stream
     */
    get pipes(){
        return this._readableState.pipes
    }
}
