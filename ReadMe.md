# Transflect

Transflect is a base class meant to be extended into various kinds of Transform streams to enable a new category of webserver I'm calling a Ternary Transflect Switch.

MIXINT v0.1.0 uses a few extensions to implement this simple server:

```js
http.createServer(global, (req, res) => (route => {
    req.pipe(new route).pipe(res)
})(
    req.method == 'GET'    ? PathRead   :
    req.method == 'PUT'    ? PathWrite  :
    req.method == 'DELETE' ? PathUnlink :
                             Transflect
))
```

So Transflect is both a base class and a fallback: if your request callback was simple `req.pipe(new Transflect).pipe(res)` then Transflect would wait for the request to end, and then throw an error to the response.
