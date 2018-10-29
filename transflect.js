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

        this.once('pipe', source => {
            this.source = source // source is ParsedMessage / http.IncomingMessage
        }).on('error', error => {
            this.destroyed || this.destroy(error)
        }).on('end', () => {
            this.destroyed || this.destroy()
        })
    }

    /**
     * @param {http.IncomingMessage} source
     * @return {(stream|Array|undefined)}
     * optional: overwrite _open(): return any streams that need to be destroyed in event of failure on destination
     */
    _open(source){
        return [] /* return a stream or array of streams */
    }

    /**
     * @param {(String|Buffer)} data
     * @param {Function} done
     * optional: overwrite _transflect(): return any streams that need to be destroyed in event of failure on destination
     * _transflect() is called on the HTTP request's body. No body, nothing to transflect.
     * If a body is included and you haven't overwritten this function, the client gets a 500 error with the error message:
     */
    _transflect(data, done){
        done(new Error(`${this.constructor.name} has no _transflect function and cannot accept a request body.`))
    }

    /**
     * @param {Function} done
     */
    _end(done){
        if(this.constructor.name == 'Transflect'){
            done(new Error("You've reached Transflect. No other streams were able to respond to this call. This message is for debugging purposes."))
        } else {
            done(new Error(`${this.constructor.name} has no _end function to close the connection.`))
        }
    }

    /**
     * Uses [].concat() because it retuns an array whether concat receives a single stream or an array of streams.
     */ 
    open(source){
        if(this.openPromise){
            return this.openPromise
        } else try {
            this.openStreams = []
                .concat(this._open(source))
                .filter(each => each instanceof stream)
                .map(each =>
                    each.once('error', error => this.destroy(error))
                )
        } catch(error){
            this.destroyed || this.destroy(error)
        } finally {
            if(this.openStreams.length == 0) {
                return this.openPromise = Promise.resolve()
            } else {
                return this.openPromise = Promise.all(this.openStreams.map(each => 
                    new Promise(resolve => {
                        if(each instanceof fs.WriteStream){
                            each.once('ready', () => resolve(each))
                        } else if(each instanceof fs.ReadStream){
                            each.once('ready', () => resolve(each))
                        } else {
                            resolve(each)
                        }
                    })
                ))
            }
        }
    }
    /**
     * _transform and _flush are overwritten here in order to extend stream.Transform
     * In each case, I check if this.open was called (an array of any length will return true)
     * and if not, call this.open, which calls your own implementation of ._open(source)
     *
     * This is wrapped in setTimeout(()=>try{}catch(){}) in order to pass any 
     * sync or async error back to client. 
     * try{}catch{} will pass a synchronous error to be emitted by this stream
     * setTimeout will make sure any async errors emitted are handled by destination stream
     * before trying to move on to the next byte.
     */
    _transform(chunk, encoding, done){
        this.open(this.source).then(() => {
            try {
                this._transflect(chunk, done)
            } catch(error){
                done(error)
            }
        })
    }

    _flush(done){
        this.open(this.source).then(() => {
            try {
                this._end(done)
            } catch(error){
                done(error)
            }
        })
    }

    /**
     * Whether an error originates from this.destroy being called explitictly or 
     * from passing a first parameter to 'done' in _transflect or _end.
     *
     * I don't know how to test that the openStreams are garbage-collectable, do I have to implement a cleanup() ?
     */
    _destroy(error){
        error && this.emit('error', error)

        this.openStreams.forEach(openStream => {
            openStream.close && openStream.close()
            openStream.destroy && openStream.destroy()
        })
    }

    /**
     * @return {http.ServerResponse}
     * I only ever expect to have one destiantion stream, throw if there's an array.
     */
    get pipes(){
        if(Array.isArray(this._readableState.pipes))
            throw new Error("Cannot be piped to multiple destinations")
        else
            return this._readableState.pipes
    }
}
