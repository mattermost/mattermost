import expect from 'expect';
window.expect = expect;
window.createSpy = expect.createSpy;
window.spyOn = expect.spyOn;
window.isSpy = expect.isSpy;

const context = require.context('./test', true, /\.spec\.js$/);
context.keys().forEach(context);
