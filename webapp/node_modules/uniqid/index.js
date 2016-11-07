/* 
(The MIT License)
Copyright (c) 2014 Halász Ádám <mail@adamhalasz.com>
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

//  Unique Hexatridecimal ID Generator
// ================================================

//  Dependencies
// ================================================
var pid = process && process.pid ? process.pid.toString(36) : '' ;
var mac = typeof __webpack_require__ !== 'function' ? require('macaddress').one(macHandler) : null ;
var address = mac ? parseInt(mac.replace(/\:|\D+/gi, '')).toString(36) : '' ;

//  Exports
// ================================================
module.exports         = function(prefix){ return (prefix || '') + address + pid + now().toString(36); }
module.exports.process = function(prefix){ return (prefix || '')           + pid + now().toString(36); }
module.exports.time    = function(prefix){ return (prefix || '')                 + now().toString(36); }

//  Helpers
// ================================================
function now(){
    var time = new Date().getTime();
    var last = now.last || time;
    return now.last = time > last ? time : last + 1;
}

function macHandler(error){
    if(module.parent.uniqid_debug){
        if(error) console.error('Info: No mac address - uniqid() falls back to uniqid.process().', error)
        if(pid == '') console.error('Info: No process.pid - uniqid.process() falls back to uniqid.time().')
    }
}