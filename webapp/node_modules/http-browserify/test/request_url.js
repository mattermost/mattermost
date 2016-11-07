global.window = global;
global.location = {
    host: 'localhost:8081',
    port: 8081,
    protocol: 'http:'
};

var noop = function() {};
global.XMLHttpRequest = function() {
  this.open = noop;
  this.send = noop;
};

global.FormData = function () {};
global.Blob = function () {};
global.ArrayBuffer = function () {};

var test = require('tape').test;
var http = require('../index.js');


test('Test simple url string', function(t) {
  var url = { path: '/api/foo' };
  var request = http.get(url, noop);

  t.equal( request.uri, 'http://localhost:8081/api/foo', 'Url should be correct');
  t.end();

});


test('Test full url object', function(t) {
  var url = {
    host: "localhost:8081",
    hostname: "localhost",
    href: "http://localhost:8081/api/foo?bar=baz",
    method: "GET",
    path: "/api/foo?bar=baz",
    pathname: "/api/foo",
    port: "8081",
    protocol: "http:",
    query: "bar=baz",
    search: "?bar=baz",
    slashes: true
  };

  var request = http.get(url, noop);

  t.equal( request.uri, 'http://localhost:8081/api/foo?bar=baz', 'Url should be correct');
  t.end();

});

test('Test alt protocol', function(t) {
  var params = {
    protocol: "foo:",
    hostname: "localhost",
    port: "3000",
    path: "/bar"
  };

  var request = http.get(params, noop);

  t.equal( request.uri, 'foo://localhost:3000/bar', 'Url should be correct');
  t.end();

});

test('Test string as parameters', function(t) {
  var url = '/api/foo';
  var request = http.get(url, noop);

  t.equal( request.uri, 'http://localhost:8081/api/foo', 'Url should be correct');
  t.end();

});

test('Test withCredentials param', function(t) {
  var url = '/api/foo';

  var request = http.request({ url: url, withCredentials: false }, noop);
  t.equal( request.xhr.withCredentials, false, 'xhr.withCredentials should be false');

  var request = http.request({ url: url, withCredentials: true }, noop);
  t.equal( request.xhr.withCredentials, true, 'xhr.withCredentials should be true');

  var request = http.request({ url: url }, noop);
  t.equal( request.xhr.withCredentials, true, 'xhr.withCredentials should be true');

  t.end();
});

test('Test POST XHR2 types', function(t) {
  t.plan(3);
  var url = '/api/foo';

  var request = http.request({ url: url, method: 'POST' }, noop);
  request.xhr.send = function (data) {
    t.ok(data instanceof global.ArrayBuffer, 'data should be instanceof ArrayBuffer');
  };
  request.end(new global.ArrayBuffer());

  request = http.request({ url: url, method: 'POST' }, noop);
  request.xhr.send = function (data) {
    t.ok(data instanceof global.Blob, 'data should be instanceof Blob');
  };
  request.end(new global.Blob());

  request = http.request({ url: url, method: 'POST' }, noop);
  request.xhr.send = function (data) {
    t.ok(data instanceof global.FormData, 'data should be instanceof FormData');
  };
  request.end(new global.FormData());
});
