Object.assign(global, {
    http: require('http'),
    fs: require('fs'),
    url: require('url'),
    path: require('path'),
    stream: require('stream'),
    transflect: require('../transflect')
})

class simpleread extends transflect {
    constructor(options){
        super(options)
    }

    _open(source){
        // only serves files in local directory, .base is file basename, no directory prefix
        return this.stream = fs.createReadStream(source.base) // readstream closes itself on end
    }

    _flush(done){
        this.stream.on('data', data => {
            this.push(data) || (this.stream.pause(), this.pipes.once('drain', () => this.stream.resume()))
        }).on('close', done).on('error',  done)
    }
}

class simplewrite extends transflect {
    constructor(options){
        super(options)
    }

    _open(source){
        // only write files in local directory, .base is file basename, no directory prefix.
        return this.dest = fs.createWriteStream(source.base) // return stream to auto-close on destroy
    }

    _transform(chunk, encoding, done){
        this.dest.write(chunk) && done() || this.dest.once('drain', done)
    }

    _flush(done){
        this.statusCode = 201 // 201 created
        done()
    }
}

class simpleunlink extends transflect {
    constructor(options){
        super(options)
    }

    // no need to _open(source) a stream here, source is available as this.source

    _flush(done){
        // if unlink throws an error, it is passed to done,
        // thrown by _flush and caught by ServerFailSoft
        this.statusCode = 204
        // 204 finished delete, no content to return
        // will be overrided if unlink throws an error
        fs.unlink(this.source.base, done)
    }
}

let options = {
    IncomingMessage: require('parsedmessage'),
    ServerResponse: require('serverfailsoft')
}

http.createServer(options, (req,res) => (route => {
    req.pipe(new route).pipe(res)
})(
    req.method == 'GET'    ? simpleread   :
    req.method == 'PUT'    ? simplewrite  :
    req.method == 'DELETE' ? simpleunlink :
    /* if no route ... */    transflect
)).listen(3000)
