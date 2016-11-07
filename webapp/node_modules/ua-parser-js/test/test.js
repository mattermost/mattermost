var assert      = require('assert');
var UAParser    = require('./../src/ua-parser');
var browsers    = require('./browser-test.json');
var cpus        = require('./cpu-test.json');
var devices     = require('./device-test.json');
var engines     = require('./engine-test.json');
var os          = require('./os-test.json');
var parser      = new UAParser();
var methods     = [
    {
        title       : 'getBrowser',
        label       : 'browser',
        list        : browsers,
        properties  : ['name', 'major', 'version']
    },
    {
        title       : 'getCPU',
        label       : 'cpu',
        list        : cpus,
        properties  : ['architecture']
    },
    {
        title       : 'getDevice',
        label       : 'device',
        list        : devices,
        properties  : ['model', 'type', 'vendor']
    },
    {
        title       : 'getEngine',
        label       : 'engine',
        list        : engines,
        properties  : ['name', 'version']
    },
    {
        title       : 'getOS',
        label       : 'os',
        list        : os,
        properties  : ['name', 'version']
}];

describe('UAParser()', function () {
    var ua = 'Mozilla/5.0 (Windows NT 6.2) AppleWebKit/536.6 (KHTML, like Gecko) Chrome/20.0.1090.0 Safari/536.6';
    assert.deepEqual(UAParser(ua), new UAParser().setUA(ua).getResult());
});

describe('Injected Browser', function () {
    var uaString = 'ownbrowser/1.3';
    var ownBrowser = [[/(ownbrowser)\/((\d+)?[\w\.]+)/i], [UAParser.BROWSER.NAME, UAParser.BROWSER.VERSION, UAParser.BROWSER.MAJOR]];
    var parser = new UAParser(uaString, {browser: ownBrowser});
    assert.equal(parser.getBrowser().name, 'ownbrowser');
    assert.equal(parser.getBrowser().major, '1');
    assert.equal(parser.getBrowser().version, '1.3');
});

for (var i in methods) {
    describe(methods[i]['title'], function () {
        for (var j in methods[i]['list']) {
            if (!!methods[i]['list'][j].ua) {
                describe('[' + methods[i]['list'][j].desc + ']', function () {
                    describe('"' + methods[i]['list'][j].ua + '"', function () {
                        var expect = methods[i]['list'][j].expect;
                        var result = parser.setUA(methods[i]['list'][j].ua).getResult()[methods[i]['label']];

                        methods[i]['properties'].forEach(function(m) {
                            it('should return ' + methods[i]['label'] + ' ' + m + ': ' + expect[m], function () {
                                assert.equal(result[m], expect[m] != 'undefined' ? expect[m] : undefined);
                            });
                        });
                    });
                });
            }
        }
    });
}
