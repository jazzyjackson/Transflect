# Transflect

Transflect is a base class for a new kind of webserver called a Transflection Server which allows you to `request.pipe(transflect).pipe(response)`.

This class on its own does nothing but throw a kind of `NotImplemented` error which makes it useful as a fallback response. Transflection servers using (ServerFailSoft)[] will return an informative error response as JSON. 

## Methods available to child classes

Transflect provides a scaffold to write your own transform streams. Extensions of Transflect implement the following:

`_open(source) //optional`: This is called when the request is first piped to your class - source is a reference to the `IncomingRequest` object. If you return a stream or an array of streams from this function, Transflect will attach error handlers to each of them, plus create error callbacks on your class so if an error is emitted at any time, these streams will be closed or destroyed.

`_transform(chunk, encoding, done) //optional`: This is called only if the `IncomingRequest` has bytes in the body. It may be called multiple times as chunks of data become available. You may consume this data and call `done(null)` when ready for more, or pass transformed bytes to the `ServerResponse` stream by passing them to `done`. 

`_flush(done) //required`: You have to overwrite this function at least by simply calling `done(null)` if nothing more needs doing. This will be called nearly immediately if the `IncomingRequest` has no body. If you're not operating on a body your entire response will probably be constructed in the `_flush` method.

Besides these, Transflect and ServerFailSoft work in conjunction to give you `setHeader` and `writeHead` functions in this transform stream (without explicit reference to the `ServerResponse` these methods actually exist on). 

## Example

After running `npm i`, Check out the examples/simple.js source for a few basic examples for extending this class into your own behavior. You can implement a simple server that routes each request to an appropriate extension of transflect and pipes bytes in one end and out the other. In this example, if the incoming request's pathname ends in a trailing slash, it's presumed to be a request to list the directory. Otherwise, if it's a GET request, it will try to read the file. PUT requets can write files to disk, and DELETE requests can delete files (any file the server's euid has permission to delete). If your request doesn't match any of these conditions (like an OPTIONS request not ending in a trailing slash), your request is handled by the base class provided here in transflect.js.

Try it out with `node examples/simple.js` and open `localhost:3000` in your browser.

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
