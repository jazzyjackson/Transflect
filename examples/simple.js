Object.assign(global, {
    http: require('http'),
    fs: require('fs'),
    url: require('url'),
    path: require('path'),
    stream: require('stream'),
    transflect: require('../transflect')
})

class simpleread extends transflect {
    constructor(){super()}

    _open(source){
        return this.stream = fs.createReadStream(source.pathname)
    }

    _flush(done){
         this.stream.on('data', data => {
            this.push(data) || (this.stream.pause(), this.pipes.once('drain', () => this.stream.resume()))
        }).on('close', done).on('error',  done)
    }
}

/**
 * REQUIRES NODES ^10.10.0
 * Uses withFileTypes and dirEnt.isDirectory() to append a trailing slash
 */
class simplelist extends transflect {
    constructor(){super()}

    _flush(done){
        fs.readdir(this.source.pathname, {withFileTypes: true}, (error, files) => {
            done(error, files && files.map(dirent => {
                let isDirectory = dirent.isDirectory()
                let filename = dirent.name
                return `<div><a href="${this.source.pathname}${filename}${isDirectory ? '/' : ''}">${filename}</a></div>`
            }).join('\n'))
        })
    }
}

class simplewrite extends transflect {
    constructor(options){
        super(options)
    }

    /**
     * @param {ParsedMessage} source
     * Uses IncomingMessage.base only write files in local directory
     * .base is file basename, no directory prefix.
     * @return {WriteStream}
     * return newly created file writeStream so that it is closed on error or end
     * in the event the connection is aborted before writing is finished,
     * simplewrite does NOT delete the unfinished file, but it will close it to avoid fd leak
     * perhaps a more sophisticated transfect would write to a /tmp/ folder and only copy to overwrite
     * the destination once the connection is closes, to avoid destroying the original file
     */
    _open(source){
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

http.createServer({
    IncomingMessage: require('parsedmessage'),
    ServerResponse: require('serverfailsoft')
}, (req,res) => (route => {
    req.pipe(new route).pipe(res)
})(
    req.pathname.slice(-1) == '/' ? simplelist   :
    req.method == 'GET'           ? simpleread   :
    req.method == 'PUT'           ? simplewrite  :
    req.method == 'DELETE'        ? simpleunlink :
    /* if no route ... */           transflect
)).listen(3000)
