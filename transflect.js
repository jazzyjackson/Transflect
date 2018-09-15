/**
---
author: Colten Jackson
license: Continuity
...
**/
let stream = require('stream')

/**
 * @extends stream.Transform
 */
module.exports = class Transflect extends stream.Transform {
    /**
     * Attaches error handlers and keeps a reference to any open streams
     * such that if a request fails, requisite streams are closed and/or destroyed
     * hands the http.incomingStream that is being piped to
     * transflect to the _open functions, which can then read any props off the request
     */
    constructor(options){
        super(options)
        /* calling destroy without error closes and destroys any streams in the ._openStreams array */
        this.on('end', () => {
            // not 100% sure this is necessary, streams seem to close themselves so far, needs some tests.
            this.destroyed || this.destroy()
        }).on('error', error => {
            this.destroyed || this.destroy(error)
        }).once('pipe', source => {
            this._openStreams = [].concat(
                this._open(this.source = source)
            ).filter(each =>
                each instanceof stream // filter undefined return values and prevent calling destroy on invalid return values
            ).map(each =>
                each.once('error', error => this.destroy(error))
            )
        })
    }

    /**
     * @param {http.IncomingMessage} source
     * overwrite this function ! return any streams that need to be destroyed in event of failure on destination
     */
    _open(source){
        /* return a stream or array of streams */
    }

    /**
     * @callback done
     * transform is only invoked when request includes a body. If you don't intend to do anything with a body, don't overwrite this.
     */
    _transform(chunk, encoding, done){
        done(new Error(`${this.constructor.name} has no transform function and cannot accept a request body.`))
    }

    /**
     * @callback done
     * overwrite this function to conclude the response, perhaps with naught but a done(null)
     */
    _flush(done){
        if(this.constructor.name == 'Transflect'){
            done(new Error("You've reached Transflect. No other streams were able to respond to this call. This message is for debugging purposes."))
        } else {
            done(new Error(`${this.constructor.name} has no flush function to close the connection.`))
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
        error && this.emit('error', error)
        this._openStreams.forEach(openStream => {
            openStream.close && openStream.close()
            openStream.destroy && openStream.destroy()
        })
    }

    /**
     * @param {string} header
     * @param {string} value
     * Overwrites any existing header, creates object if it doesn't exist yet.
     */
    setHeader(header, value){
        if(this._headers){
            this._headers[header] = value
        } else {
            this._headers = {[header]: value}
        }
    }

    /**
     * @param { number } statuscode
     * @param { object } [headers={}] - default empty obj
     * @return { undefined }
     * these properties get read by ServerFailSoft
     * as soon as any bytes are written to destination
     * I could pass on to this.pipes.writeHead if I want to... but it won't exist synchronously
     * so instead these properties are set locally, and pulled from ServerFailSoft on 'data','end', or 'error'
     */
    writeHead(statusCode, headers = {}){
        if(this.pipes && this.pipes.headersSent){
            this.emit('error', new Error("Can't set headers after they're sent."))
        } else {
            this.statusCode = statusCode
            for(var header in headers){
                this.setHeader(header, headers[header])
            }
        }
    }

    /**
     * @return {object}
     */
    get headers(){
        return this._headers || {}
    }

    /**
     * @return {(stream|array)}
     * I only ever expect to have one destiantion stream
     * otherwise this would return an array of pipes which may surprise you
     */
    get pipes(){
        return this._readableState.pipes
    }
}
