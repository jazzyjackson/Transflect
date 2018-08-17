const {Transform} = require('stream')
const url = require('url')
const querystring = require('querystring')
let i = 0

module.exports = class Transflect extends Transform {
    constructor({req, res}){
        super()
        this.on('error', this.failVerbose)
        this.on('close', res.end.bind(res))
        Object.assign(this, {req, res})
        //error is thrown when transform or destroy's callback has err in first argument
    }

    failVerbose(err){
        this.res.headersSent || this.res.setHeader('Content-Type', 'application/json')
        this.res.headersSent || this.res.writeHead(
            err && err.code == 'ENOENT' ? 404 : // error no entity
            err && err.code == 'ERANGE' ? 416 : // range not satisfiable
            err && err.code == 'EACCES' ? 423 : // error no access
        /* if error reason not provided*/ 500 )
        this.res.end(JSON.stringify({
          error: err,
          request: this.headers,
          url: this.url,
          versions: process.versions,
          platform: process.platform,
        }))
    }
    // _flush & _transform should be overwritten by subclasses!
    _flush(done){
        done(new Error('Transflection'))
    }

    _transform(chunk, encoding, done){
        done(null)
    }

    get started(){
        return this.res.headersSent
    }

    // ideally subclasses can live without knowing about underlying req and res objects...
    set headers(newHeaderObject){
        for(var key in newHeaderObject){
            this.res.setHeader(key, newHeaderObject[key])
        }
    }
    get headers(){
        return this.req.headers
    }

    get url(){
        return url.parse(this.req.url)
    }

    get query(){
        return querystring.parse(this.url.query)
    }
}