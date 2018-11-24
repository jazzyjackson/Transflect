Object.assign(global, {
    http: require('http'),
    fs: require('fs'),
    url: require('url'),
    path: require('path'),
    stream: require('stream'),
    transflect: require('../transflect'),
    EventSeries: require('streamverbose').EventSeries,
    es2column: require('streamverbose').es2column,
})

process.on('warning', e => console.warn(e.stack));

class simpleread extends transflect {
    constructor(){ super() }

    // if read is a directory it would be nice to redirect to pathname + '/'

    _open(source){
        return this.stream = fs.createReadStream(source.pathname)
    }

    _end(done){        
        this.stream.pipe(this.pipes)
    }
}

/**
 * REQUIRES NODES ^10.10.0
 * Uses withFileTypes and dirEnt.isDirectory() to append a trailing slash
 */
class simplelist extends transflect {
    constructor(){ super() }

    _end(done){
        fs.readdir(this.source.pathname, {withFileTypes: true}, (error, files) => {
            // if(this.source.headers.accept.includes('application/json')) -> concatenate to JSON response
            done(error, files && files.map(dirent => {
                let isDirectory = dirent.isDirectory()
                let filename = dirent.name
                return `<div><a href="${this.source.pathname}${filename}${isDirectory ? '/' : ''}">${filename}</a></div>`
            }).join('\n'))
        })
    }
}

class simplewrite extends transflect {
    constructor(){ super() }

    /**
     * @param {ParsedMessage} source
     * @return {WriteStream}
     * return newly created file writeStream so that it is closed on error or end
     * in the event the connection is aborted before writing is finished,
     * simplewrite does NOT delete the unfinished file, but it will close it to avoid fd leak
     * perhaps a more sophisticated transfect would write to a /tmp/ folder and only copy to overwrite
     * the destination once the connection is closes, to avoid destroying the original file
     */
    _open(source){
        return this.dest = fs.createWriteStream(source.pathname) // return stream to auto-close on destroy
    }

    _transflect(data, done){
        this.dest.write(data, done)
    }
    
    /* if we've got this far without throwing an error we're home free */
    // TODO this returns a Content-Length 0, well the response body is empty.
    // I've been thinking that content-length and hash could be returned.
    // This would be useful to copy the File API used in npm formidable
    _end(done){
        this.pipes.statusCode = 201 // 201 created
        done()
    }
}

class simpleunlink extends transflect {
    constructor(){ super() }

    /**
     * no need to _open(source) a stream here, 
     * source is available as this.source
     *
     * if unlink throws an error, it is passed to done,
     * thrown by _flush and caught by ServerFailSoft
     * 204 finished delete, no content to return
     * will be overrided if unlink throws an error
     */
    _end(done){
        this.pipes.statusCode = 204
        fs.unlink(this.source.pathname, done)
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
