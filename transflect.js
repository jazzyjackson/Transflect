module.exports = class Transflect extends require('stream').PassThrough {
    constructor(options){
        super(options)
        this.readable = false // response only writes head AFTER receiving first chunk
        this.on('pipe', source => {
            this._openStreams = [].concat(
                this._open(this.source = source)
            ).filter(each =>
                each instanceof stream // filter undefined return values and prevent calling destroy on invalid return values
            ).map(stream =>
                stream.once('error', err => this.destroy(err))
            )
        }).on('error', err => this.destroyed || this.destory(err))
    }


    _open(source){
        // overwrite this function ! return any streams that need to be destroyed in event of failure on destination
    }

    _destroy(err){
        this.emit('error', err)
        while(this._openStreams.length){
            this._openStreams.pop().destroy()
        }
    }

    writeHead(statusCode, headers){
        // these properties get read by ServerFailSoft as soon as any bytes are written to destination
        // maybe it would be useful to throw an error if writeHead is called after bytes are sent?
        // otherwise you might wonder why nothing happens when this is called.
        if(this.pipes.headersSent) return this.emit('err', "Can't set headers after they're sent.")
        this.statusCode = statusCode
        for(var header in headers){
            this.setHeader(header, headers[header])
        }
    }

    setHeader(header, value){
        if(this._headers){
            this._headers[header] = value
        } else {
            this._headers = {[header]: value}
        }
    }

    get headers(){
        return this._headers || {}
    }

    get pipes(){
        return this._readableState.pipes
    }
}
