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
const events = require('events')

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
     * Attaches once('error', error => this.destroy(error)) in case an error is thrown after this.open() resolves.
     *
     * If you wanted to add a stream-kill timeout of a few seconds this would be a great place. Could possibly
     * make an informative error of what element(s) the stream was waiting on when it his the time out.
     * You could probably also attach a timer that watches my own streams for ' last data sent ... ' and kill idle streams
     */ 
    open(source){
        if(this.openPromise){
            debug(`existing openPromise:`, this.openPromise)
            return this.openPromise
        } else try {
            this.openStreams = [].concat(this._open(source))
        } catch(error){
            debug(`caught synchronous error on _open`)
            this.destroyed || this.destroy(error)
        } finally {
            if(this.openStreams.length == 0) {
                debug(`no streams returned by _open, resolving`)
                return this.openPromise = Promise.resolve()
            } else {
                debug(`${this.openStreams.length} promises & eventemitters returned by _open...`)
                return this.openPromise = Promise.all(
                    this.openStreams
                        .filter(each => each instanceof events || each instanceof Promise)
                        .map(each => new Promise((resolve) => {
                            if(each instanceof Promise){
                                debug(`${this.constructor.name} is waiting for a promise to resolve`)
                                each.then(data => {this.push(data); resolve(data)})
                                    .catch(error => this.destroy(error))
                            } else if(each instanceof fs.WriteStream){
                                debug(`${this.constructor.name} is waiting for a writestream to open`)
                                each.once('ready', () => resolve(each))
                                    .once('error', error => this.destroy(error))
                            } else if(each instanceof fs.ReadStream){
                                debug(`${this.constructor.name} is waiting for a readstream to open`)
                                each.once('readable', () => resolve(each))
                                    .once('error', error => this.destroy(error))
                            } else {
                                resolve(each.once('error', error => this.destroy(error)))
                            }
                        })
                    )
                )
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
                let transflection = this._transflect(chunk, done)
                if(transflection instanceof Promise){
                    transflection.then(data => done(null, data))
                    transflection.catch(err => done(err))
                }
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
                let flushing = this._end(done)
                if(flushing instanceof Promise){
                    flushing.then(data => done(null, data))
                    flushing.catch(err => done(err))
                }
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
        debug(
            `destroy called, re-emitting error`
        )
        this.openStreams
            .filter(each => each instanceof events)
            .forEach(openStream => {
                openStream.destroy && openStream.destroy()
            })
        error && this.emit('error', error)
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
