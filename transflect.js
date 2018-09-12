/**
---
author: Colten Jackson
license: Continuity
version: 1.0.0
...
**/

module.exports = class Transflect extends require('stream').Transform {
    constructor(options){
        super(options)
        this.readable = false
        this.on('pipe', source => {
            this._openStreams = [].concat(
                this._open(this.source = source)
            ).filter(each =>
                each instanceof stream // filter undefined return values and prevent calling destroy on invalid return values
            ).map(each =>
                each.once('error', error => this.destroy(error))
            )
        })
        this.on('error', error => this.destroyed || this.destroy(error))
    }

    _open(source){
        // overwrite this function ! return any streams that need to be destroyed in event of failure on destination
    }

    _transform(chunk, encoding, done){
        // transform is only invoked when request includes a body. If you don't intend to do anything with a body, don't overwrite this.
        done(new Error(`${this.constructor.name} has no transform function and cannot accept a request body.`))
    }

    _flush(done){
        // overwrite this function to conclude the response, perhaps with naught but a done(null)
        done(new Error("You've reached Transflect. No other streams were able to respond to this call. This message is for debugging purposes."))
    }

    _destroy(error){
        // DON'T overwrite _destroy unless you don't have any _openStreams to worry about! Just let me re-emit the error.
        this.emit('error', error)
        while(this._openStreams.length){
            this._openStreams.pop().destroy()
        }
    }

    setHeader(header, value){
        if(this._headers){
            this._headers[header] = value
        } else {
            this._headers = {[header]: value}
        }
    }

    writeHead(statusCode, headers){
        // these properties get read by ServerFailSoft as soon as any bytes are written to destination
        // maybe it would be useful to throw an error if writeHead is called after bytes are sent?
        // otherwise you might wonder why nothing happens when this is called.
        this.statusCode = statusCode

        if(this.pipes.headersSent){
            return this.emit('error', new Error("Can't set headers after they're sent."))
        }
        for(var header in headers){
            this.setHeader(header, headers[header])
        }
    }

    get headers(){
        return this._headers || {}
    }

    get pipes(){
        return this._readableState.pipes
    }
}
