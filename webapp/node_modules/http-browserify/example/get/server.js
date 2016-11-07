var http = require('http');
var ecstatic = require('ecstatic')(__dirname);
var server = http.createServer(function (req, res) {
    if (req.url === '/beep') {
        res.setHeader('content-type', 'text/plain');
        res.end('boop');
    }
    else ecstatic(req, res);
});

console.log('Listening on :8082');
server.listen(8082);
