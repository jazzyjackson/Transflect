Object.assign(global, {
    http: require('http'),
    fs: require('fs'),
    url: require('url'),
    path: require('path'),
    stream: require('stream'),
    transflect: require('../transflect'),
})

class heartbeat extends transflect {
    constructor(){ super() }

    // you should give _open a single promise or array of promises
    // transflect and end will only be called once all of these promises resolve
    // nothing returned here is given a name - basically its internally anonymous
    // if you want to reference values later, name them as you return them
    _open(source){
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`<div>${new Date().toTimeString()}</div>`)
            }, 1000)
        })
    }

    // the content that transflects passing to resolve DOES get pushed as second parameter to done()
    // an error passed to reject DOES get passed as first paramter to done()
    _transflect(data){
        return Promise.reject('what')
        // return new Promise(resolve => {
        //     setTimeout(() => {
        //         resolve(`<h3> ❤ </h3><div>${new Date().toTimeString()}</div>`)
        //     }, 1000)
        // })
    }

    _end(){
        return Promise.resolve() // return resolved promise or use _end(done){done()} parameter
    }
}

http.createServer({
    IncomingMessage: require('parsedmessage'),
    ServerResponse: require('serverfailsoft')
}, (req,res) => {
    req.pipe(new heartbeat).pipe(res)
}).listen(3000)
