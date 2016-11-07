var http = require('http');
var ecstatic = require('ecstatic')(__dirname);
var server = http.createServer(function (req, res) {
    if (req.url === '/doom') {
        res.setHeader('content-type', 'multipart/octet-stream');
        
        res.write('d');
        var i = 0;
        var iv = setInterval(function () {
            res.write('o');
            if (i++ >= 10) {
                clearInterval(iv);
                res.end('m');
            }
        }, 500);
    }
    else ecstatic(req, res);
});

console.log('Listening on :8082');
server.listen(8082);
