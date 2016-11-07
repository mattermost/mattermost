var http = require('http');
var ecstatic = require('ecstatic')(__dirname);
var server = http.createServer(function (req, res) {
    if (req.method === 'POST' && req.url === '/plusone') {
        res.setHeader('content-type', 'text/plain');
        
        var s = '';
        req.on('data', function (buf) { s += buf.toString() });
        
        req.on('end', function () {
            var n = parseInt(s) + 1;
            res.end(n.toString());
        });
    }
    else ecstatic(req, res);
});

console.log('Listening on :8082');
server.listen(8082);
