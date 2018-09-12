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
        let {pathname} = url.parse(source.url)
        let filepath = path.join(process.cwd(), pathname)
        return this.stream = fs.createReadStream(filepath)
    }

    _flush(done){
        // get mimetype, set headers... this.headers = {}
        this.stream.on('data', data => {
            this.push(data) || (this.stream.pause(), this.pipes.once('drain', () => this.stream.resume()))
        }).on('close', done).on('error',  done)
    }
}

// class simplewrite extends transflect {
//     constructor(options){
//         super(options)
//         this.statusCode = 201 // 201 Created (overwritten by error...)
//         console.log("writing")
//     }
//
//     _open(source){
//         let {pathname} = url.parse(source.url)
//         let filepath = path.join(process.cwd(), pathname)
//         return this.dest = fs.createWriteStream(filepath)
//     }
//
//     _transform(chunk, encoding, done){
//         console.log("writing", chunk.toString())
//         this.dest.write(chunk) && done('') || this.dest.once('drain', done)
//     }
//
//     _flush(done){
//         console.log("done")
//         this.dest.close() // very important to close the writestream !
//         done()
//     }
//
// }

let options = {
    IncomingMessage: require('parsedmessage'),
    ServerResponse: require('serverfailsoft')
}

http.createServer(options, (req,res) => (route => {
    req.pipe(new route).pipe(res)
})(
    req.method == 'GET' ? simpleread  :
    // req.method == 'PUT' ? simplewrite :
    /* if no route ... */ transflect
)).listen(3000)
