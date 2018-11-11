/**
---
author: Colten Jackson
license: Continuity
...
**/
const fs = require('fs')
const util = require('util')
const debug = util.debuglog('transflect')
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
            debug(
                `${this.constructor.name} has a source:\n` +
                `Method: ${source.method}\n` +
                `Path: ${source.pathname}\n` +
                `Query: \n${util.inspect(source.query)}\n` +
                `Headers: \n${util.inspect(source.headers)}\n`
            )
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
            debug(`existing openPromise:`, this.openPromise)
            return this.openPromise
        } else try {
            this.openStreams = []
                .concat(this._open(source))
                .filter(each => each instanceof stream)
                .map(each =>
                    each.once('error', error => {
                        debug(`A stream returned to _open emitted an error.`)
                        this.destroy(error)
                    })
                )
        } catch(error){
            debug(`caught synchronous error on _open`)
            this.destroyed || this.destroy(error)
        } finally {
            if(this.openStreams.length == 0) {
                debug(`no streams returned by _open, resolving`)
                return this.openPromise = Promise.resolve()
            } else {
                debug(`${this.openStreams.length} streams returned by _open...`)
                return this.openPromise = Promise.all(this.openStreams.map(each => 
                    new Promise((resolve, reject) => {
                        if(each instanceof fs.WriteStream){
                            debug(`a fs.WriteStream from _open`)
                            each.once('ready', () => {
                                debug(`a fs.WriteStream returned to _open emitted ready.`)
                                resolve(each)
                            })
                        } else if(each instanceof fs.ReadStream){
                            debug(`a fs.ReadStream from _open`)
                            each.once('readable', () => {
                                debug(`a fs.ReadStream returned to _open emitted readable.`)
                                resolve(each)
                            })
                        } else {
                            debug(` an unrecognized stream from _open, resolving`)
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
            debug(
                `_transform called, reached body, calling this._transflect`
            )
            try {
                this._transflect(chunk, done)
            } catch(error){
                done(error)
            }
        })
    }

    _flush(done){
        this.open(this.source).then(() => {
            debug(
                `_flush called, reached body, calling this._end`
            )
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
