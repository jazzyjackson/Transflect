# Transflect

Transflect is a base class for a new kind of webserver called a Transflection Server which allows you to `request.pipe(transflect).pipe(response)`.

This class on its own does nothing but throw a kind of `NotImplemented` error which makes it useful as a fallback response. Transflection servers using [ServerFailSoft](http://github.com/jazzyjackson/serverfailsoft/) will return an informative error response as JSON. 

## Methods available to child classes

Transflect provides a scaffold to write your own transform streams. Extensions of Transflect implement the following:

`_open(source) //optional`: This is called when the request is first piped to your class - source is a reference to the `IncomingRequest` object. If you return a stream or an array of streams from this function, Transflect will attach error handlers to each of them, plus create error callbacks on your class so if an error is emitted at any time, these streams will be closed or destroyed.

`_transflect(data, done) //optional`: This is called only if the `IncomingRequest` has bytes in the body. It may be called multiple times as chunks of data become available. You may consume this data and call `done(null)` when ready for more, or pass transformed bytes to the `ServerResponse` stream by passing the String or Buffer to `done`. 

`_end(done) //required`: You have to overwrite this function at least by simply calling `done(null)` if nothing more needs doing. This will be called nearly immediately if the `IncomingRequest` has no body. If you're not operating on a body your entire response will probably be constructed in the `_end` method.

To set headers, use `this.pipes.writeHead` to call the method on the response object.

## Example

After running `npm i`, you can run `node examples/simple.js` and point your browser to `localhost:3000` to browse your filesystem in a traditional sort of sitemap. A request ending with a trailing slash is directed to a transflect stream provided here to create a directory listing and render some html that is returned once readdir is finished. (Requires NodeJS 10.10 for that sweet `withFileTypes` option). No incoming bytes are expected, and no underlying streams are opened, so the optional `_open()` and `_transform()` are left out.

```js
class simplelist extends transflect {
    constructor(){ super() }

    _end(done){
        fs.readdir(this.source.pathname, {withFileTypes: true}, (error, files) => {
            done(error, files && files.map(dirent => {
                let isDirectory = dirent.isDirectory()
                let filename = dirent.name
                return `<div><a href="${this.source.pathname}${filename}${isDirectory ? '/' : ''}">${filename}</a></div>`
            }).join('\n'))
        })
    }
}
```

How about an example of opening a writestream to pipe incoming bodies to? 

In this case we implement `_open` to create a `this.dest` property as soon as a request is piped and **return** a reference to this stream so it may be closed if an error is thrown during the response, avoiding file descriptor leaks.

Incoming bytes must be consumed by the `_transflect` implementation, and we write them to the stream created in the call to `_open`. We must be careful to respect backpressure here, so we only call done when write returns true.

Once all bytes are consumed, we can set a statusCode and finish. Note we can set statusCode during the flush here because no bytes have been sent this whole time - transform consumed them without passing anything to done().

```js
class simplewrite extends transflect {
    constructor(){ super() }

    _open(source){
        return this.dest = fs.createWriteStream(source.pathname)
    }

    _transflect(data, done){
        this.dest.write(data) && done() || this.dest.once('drain', done)
    }

    _end(done){
        this.pipes.writeHead(201) // 201 created
        done()
    }
}
```

Look into `examples/simple.js` for more comments and implementation of simpleread and simpleunlink. 

More sophisticated versions of these example streams are provided as separate modules:

- ContextFeed: provides realtime updates of file changes
- PathRead
- PathWrite
- PathUnlink

More Transflect modules include:
- PathFork: get output or error of child process as JSON response
- TeleFork: launch child processes and get realtime progress
- BytePipette: read byte ranges from files, stream media, tail logs
- WritePipette: write byte ranges, append bytes to files
- FigjamFeed: bundle customElement scripts with HTML views

```js
http.createServer(options, (req,res) => (route => {
    req.pipe(new route).pipe(res)
})(
    req.pathname.slice(-1) == '/' ? simplelist   :
    req.method == 'GET'           ? simpleread   :
    req.method == 'PUT'           ? simplewrite  :
    req.method == 'DELETE'        ? simpleunlink :
    /* if no route ... */           transflect
)).listen(3000)
```

Any errors encountered (whether opening a file you don't have permission to, returning an EACCESS error, or trying to open a file that doesn't exist, resulting in a ENOENT error) will be handled by [ServerFailSoft](http://github.com/jazzyjackson/serverfailsoft/). [ParsedMessage](http://github.com/jazzyjackson/parsedmessage/) is also depended on for some convenient shortcuts to decoded pathnames.

Check out examples/simple.js for details on importing the prerequisites.
