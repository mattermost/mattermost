/*
 * $Id: base64.js,v 1.7 2012/08/23 10:30:18 dankogai Exp dankogai $
 *
 *  Licensed under the MIT license.
 *  http://www.opensource.org/licenses/mit-license.php
 *
 *  References:
 *    http://en.wikipedia.org/wiki/Base64
 */

(function(global){

var b64chars
    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

var b64charcodes = function(){
    var a = [];
    var codeA = 'A'.charCodeAt(0);
    var codea = 'a'.charCodeAt(0);
    var code0 = '0'.charCodeAt(0);
    for (var i = 0; i < 26; i ++) a.push(codeA + i);
    for (var i = 0; i < 26; i ++) a.push(codea + i);
    for (var i = 0; i < 10; i ++) a.push(code0 + i);
    a.push('+'.charCodeAt(0));
    a.push('/'.charCodeAt(0));
    return a;
}();

var b64tab = function(bin){
    var t = {};
    for (var i = 0, l = bin.length; i < l; i++) t[bin.charAt(i)] = i;
    return t;
}(b64chars);

var stringToArray = function(s){
    var a = [];
    for (var i = 0, l = s.length; i < l; i ++) a[i] = s.charCodeAt(i);
    return a;
};

var convertUTF8ArrayToBase64 = function(bin){
    var padlen = 0;
    while (bin.length % 3){
        bin.push(0);
        padlen++;
    };
    var b64 = [];
    for (var i = 0, l = bin.length; i < l; i += 3){
        var c0 = bin[i], c1 = bin[i+1], c2 = bin[i+2];
        if (c0 >= 256 || c1 >= 256 || c2 >= 256)
            throw 'unsupported character found';
        var n = (c0 << 16) | (c1 << 8) | c2;
        b64.push(
            b64charcodes[ n >>> 18],
            b64charcodes[(n >>> 12) & 63],
            b64charcodes[(n >>>  6) & 63],
            b64charcodes[ n         & 63]
        );
    }
    while (padlen--) b64[b64.length - padlen - 1] = '='.charCodeAt(0);
    return chunkStringFromCharCodeApply(b64);
};

var convertBase64ToUTF8Array = function(b64){
    b64 = b64.replace(/[^A-Za-z0-9+\/]+/g, '');
    var bin = [];
    var padlen = b64.length % 4;
    for (var i = 0, l = b64.length; i < l; i += 4){
        var n = ((b64tab[b64.charAt(i  )] || 0) << 18)
            |   ((b64tab[b64.charAt(i+1)] || 0) << 12)
            |   ((b64tab[b64.charAt(i+2)] || 0) <<  6)
            |   ((b64tab[b64.charAt(i+3)] || 0));
        bin.push(
            (  n >> 16 ),
            ( (n >>  8) & 0xff ),
            (  n        & 0xff )
        );
    }
    bin.length -= [0,0,2,1][padlen];
    return bin;
};

var convertUTF16ArrayToUTF8Array = function(uni){
    var bin = [];
    for (var i = 0, l = uni.length; i < l; i++){
        var n = uni[i];
        if (n < 0x80)
            bin.push(n);
        else if (n < 0x800)
            bin.push(
                0xc0 | (n >>>  6),
                0x80 | (n & 0x3f));
        else
            bin.push(
                0xe0 | ((n >>> 12) & 0x0f),
                0x80 | ((n >>>  6) & 0x3f),
                0x80 |  (n         & 0x3f));
    }
    return bin;
};

var convertUTF8ArrayToUTF16Array = function(bin){
    var uni = [];
    for (var i = 0, l = bin.length; i < l; i++){
        var c0 = bin[i];
        if    (c0 < 0x80){
            uni.push(c0);
        }else{
            var c1 = bin[++i];
            if (c0 < 0xe0){
                uni.push(((c0 & 0x1f) << 6) | (c1 & 0x3f));
            }else{
                var c2 = bin[++i];
                uni.push(
                       ((c0 & 0x0f) << 12) | ((c1 & 0x3f) << 6) | (c2 & 0x3f)
                );
            }
        }
    }
    return uni;
};

var convertUTF8StringToBase64 = function(bin){
    return convertUTF8ArrayToBase64(stringToArray(bin));
};

var convertBase64ToUTF8String = function(b64){
    return chunkStringFromCharCodeApply(convertBase64ToUTF8Array(b64));
};

var convertUTF8StringToUTF16Array = function(bin){
    return convertUTF8ArrayToUTF16Array(stringToArray(bin));
};

var convertUTF8ArrayToUTF16String = function(bin){
    return chunkStringFromCharCodeApply(convertUTF8ArrayToUTF16Array(bin));
};

var convertUTF8StringToUTF16String = function(bin){
    return chunkStringFromCharCodeApply(
        convertUTF8ArrayToUTF16Array(stringToArray(bin))
    );
};

var convertUTF16StringToUTF8Array = function(uni){
    return convertUTF16ArrayToUTF8Array(stringToArray(uni));
};

var convertUTF16ArrayToUTF8String = function(uni){
    return chunkStringFromCharCodeApply(convertUTF16ArrayToUTF8Array(uni));
};

var convertUTF16StringToUTF8String = function(uni){
    return chunkStringFromCharCodeApply(
        convertUTF16ArrayToUTF8Array(stringToArray(uni))
    );
};

/*
 * String.fromCharCode.apply will only handle arrays as big as 65536, 
 * after that it'll return a truncated string with no warning.
 */
var chunkStringFromCharCodeApply = function(arr){
    var strs = [], i;
    for (i = 0; i < arr.length; i += 65536){
        strs.push(String.fromCharCode.apply(String, arr.slice(i, i+65536)));
    }
    return strs.join('');
};

if (global.btoa){
    var btoa = global.btoa;
    var convertUTF16StringToBase64 = function (uni){
        return btoa(convertUTF16StringToUTF8String(uni));
    };
}
else {
    var btoa = convertUTF8StringToBase64;
    var convertUTF16StringToBase64 = function (uni){
        return convertUTF8ArrayToBase64(convertUTF16StringToUTF8Array(uni));
    };
}

if (global.atob){
    var atob = global.atob;
    var convertBase64ToUTF16String = function (b64){
        return convertUTF8StringToUTF16String(atob(b64));
    };
}
else {
    var atob = convertBase64ToUTF8String;
    var convertBase64ToUTF16String = function (b64){
        return convertUTF8ArrayToUTF16String(convertBase64ToUTF8Array(b64));
    };
}

global.Base64 = {
    convertUTF8ArrayToBase64:convertUTF8ArrayToBase64,
    convertByteArrayToBase64:convertUTF8ArrayToBase64,
    convertBase64ToUTF8Array:convertBase64ToUTF8Array,
    convertBase64ToByteArray:convertBase64ToUTF8Array,
    convertUTF16ArrayToUTF8Array:convertUTF16ArrayToUTF8Array,
    convertUTF16ArrayToByteArray:convertUTF16ArrayToUTF8Array,
    convertUTF8ArrayToUTF16Array:convertUTF8ArrayToUTF16Array,
    convertByteArrayToUTF16Array:convertUTF8ArrayToUTF16Array,
    convertUTF8StringToBase64:convertUTF8StringToBase64,
    convertBase64ToUTF8String:convertBase64ToUTF8String,
    convertUTF8StringToUTF16Array:convertUTF8StringToUTF16Array,
    convertUTF8ArrayToUTF16String:convertUTF8ArrayToUTF16String,
    convertByteArrayToUTF16String:convertUTF8ArrayToUTF16String,
    convertUTF8StringToUTF16String:convertUTF8StringToUTF16String,
    convertUTF16StringToUTF8Array:convertUTF16StringToUTF8Array,
    convertUTF16StringToByteArray:convertUTF16StringToUTF8Array,
    convertUTF16ArrayToUTF8String:convertUTF16ArrayToUTF8String,
    convertUTF16StringToUTF8String:convertUTF16StringToUTF8String,
    convertUTF16StringToBase64:convertUTF16StringToBase64,
    convertBase64ToUTF16String:convertBase64ToUTF16String,
    fromBase64:convertBase64ToUTF8String,
    toBase64:convertUTF8StringToBase64,
    atob:atob,
    btoa:btoa,
    utob:convertUTF16StringToUTF8String,
    btou:convertUTF8StringToUTF16String,
    encode:convertUTF16StringToBase64,
    encodeURI:function(u){
        return convertUTF16StringToBase64(u).replace(/[+\/]/g, function(m0){
            return m0 == '+' ? '-' : '_';
        }).replace(/=+$/, '');
    },
    decode:function(a){
        return convertBase64ToUTF16String(a.replace(/[-_]/g, function(m0){
            return m0 == '-' ? '+' : '/';
        }));
    }
};

})(this);
