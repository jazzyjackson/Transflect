# Transflect

Transflect is a base class meant to be extended into various kinds of Transform streams to enable a new category of webserver I'm calling a Ternary Transflect Switch.

Check out the examples/simple.js source for a few basic examples for extending this class into your own behavior. You can implement a simple server that routes each request to an appropriate extension of transflect and pipes bytes in one end and out the other. In this example, if the incoming request's pathname ends in a trailing slash, it's presumed to be a request to list the directory. Otherwise, if it's a GET request, it will try to read the file. PUT requets can write files to disk, and DELETE requests can delete files (any file the server's euid has permission to delete). If your request doesn't match any of these conditions (like an OPTIONS request not ending in a trailing slash), your request is handled by the base class provided here in transflect.js.

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

So Transflect is both a base class and a fallback: if your request callback was simple `req.pipe(new Transflect).pipe(res)` then Transflect would wait for the request to end, and then throw an error to the response.

Any errors encountered (whether opening a file you don't have permission to, returning an EACCESS error, or trying to open a file that doesn't exist, resulting in a ENOENT error) will be handled by [ServerFailSoft](http://github.com/jazzyjackson/serverfailsoft/). [ParsedMessage](http://github.com/jazzyjackson/parsedmessage/) is also depended on for some convenient shortcuts to decoded pathnames.

Check out examples/simple.js for details on importing the prerequisites.
