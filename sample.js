Object.assign(global, {
    http: require('http'),
    fs: require('fs'),
    path: require('path'),
    stream: require('stream'),
    transflect: require('./transflect')
})

class pipefile extends transflect {
    constructor(ctx){
        super(ctx)
    }

    _flush(callback){
        // get mimetype, set headers... this.headers = {}
        this.headers = {'content-type': 'text/plain'}
        fs.createReadStream(path.join(process.cwd(), this.url.pathname))
        .on('data', data => this.push(data))
        .on('close', callback)
        .on('error',  callback)
    }
}

http.createServer((req,res) => {
    req.pipe(new pipefile({req,res})).pipe(res)
}).listen(3000)