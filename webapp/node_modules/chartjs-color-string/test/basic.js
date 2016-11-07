var string = require("../color-string"),
    assert = require("assert");


assert.deepEqual(string.getRgba("#fef"), [255, 238, 255, 1]);
assert.deepEqual(string.getRgba("#fffFEF"), [255, 255, 239,1]);
assert.deepEqual(string.getRgba("rgb(244, 233, 100)"), [244, 233, 100, 1]);
assert.deepEqual(string.getRgba("rgb(100%, 30%, 90%)"), [255, 77, 229, 1]);
assert.deepEqual(string.getRgba("transparent"), [0, 0, 0, 0]);
assert.deepEqual(string.getHsla("hsl(240, 100%, 50.5%)"), [240, 100, 50.5, 1]);
assert.deepEqual(string.getHsla("hsl(240deg, 100%, 50.5%)"), [240, 100, 50.5, 1]);
assert.deepEqual(string.getHwb("hwb(240, 100%, 50.5%)"), [240, 100, 50.5, 1]);
assert.deepEqual(string.getHwb("hwb(240deg, 100%, 50.5%)"), [240, 100, 50.5, 1]);

// with sign
assert.deepEqual(string.getRgba("rgb(-244, +233, -100)"), [0, 233, 0, 1]);
assert.deepEqual(string.getHsla("hsl(+240, 100%, 50.5%)"), [240, 100, 50.5, 1]);
assert.deepEqual(string.getRgba("rgba(200, +20, -233, -0.0)"), [200, 20, 0, 0]);
assert.deepEqual(string.getRgba("rgba(200, +20, -233, -0.0)"), [200, 20, 0, 0]);
assert.deepEqual(string.getHsla("hsla(+200, 100%, 50%, -0.2)"), [200, 100, 50, 0]);
assert.deepEqual(string.getHwb("hwb(+240, 100%, 50.5%)"), [240, 100, 50.5, 1]);
assert.deepEqual(string.getHwb("hwb(-240deg, 100%, 50.5%)"), [0, 100, 50.5, 1]);
assert.deepEqual(string.getHwb("hwb(-240deg, 100%, 50.5%, +0.6)"), [0, 100, 50.5, 0.6]);

//subsequent return values should not change array
assert.deepEqual(string.getRgba("blue"), [0, 0, 255, 1]);
assert.deepEqual(string.getRgba("blue"), [0, 0, 255, 1]);

assert.equal(string.getAlpha("rgb(244, 233, 100)"), 1);
assert.equal(string.getAlpha("rgba(244, 233, 100, 0.5)"), 0.5);
assert.equal(string.getAlpha("hsla(244, 100%, 100%, 0.6)"), 0.6);
assert.equal(string.getAlpha("hwb(244, 100%, 100%, 0.6)"), 0.6);
assert.equal(string.getAlpha("hwb(244, 100%, 100%)"), 1);

// alpha
assert.deepEqual(string.getRgba("rgba(200, 20, 233, 0.2)"), [200, 20, 233, 0.2]);
assert.deepEqual(string.getRgba("rgba(200, 20, 233, 0)"), [200, 20, 233, 0]);
assert.deepEqual(string.getRgba("rgba(100%, 30%, 90%, 0.2)"), [255, 77, 229, 0.2]);
assert.deepEqual(string.getHsla("hsla(200, 20%, 33%, 0.2)"), [200, 20, 33, 0.2]);
assert.deepEqual(string.getHwb("hwb(200, 20%, 33%, 0.2)"), [200, 20, 33, 0.2]);

// no alpha
assert.deepEqual(string.getRgb("#fef"), [255, 238, 255]);
assert.deepEqual(string.getRgb("rgba(200, 20, 233, 0.2)"), [200, 20, 233]);
assert.deepEqual(string.getHsl("hsl(240, 100%, 50.5%)"), [240, 100, 50.5]);
assert.deepEqual(string.getRgba('rgba(0,0,0,0)'), [0, 0, 0, 0]);
assert.deepEqual(string.getHsla('hsla(0,0%,0%,0)'), [0, 0, 0, 0]);
assert.deepEqual(string.getHwb("hwb(400, 10%, 200%, 0)"), [360, 10, 100, 0]);

// range
assert.deepEqual(string.getRgba("rgba(300, 600, 100, 3)"), [255, 255, 100, 1]);
assert.deepEqual(string.getRgba("rgba(8000%, 100%, 333%, 88)"), [255, 255, 255, 1]);
assert.deepEqual(string.getHsla("hsla(400, 10%, 200%, 10)"), [360, 10, 100, 1]);
assert.deepEqual(string.getHwb("hwb(400, 10%, 200%, 10)"), [360, 10, 100, 1]);

// invalid
assert.strictEqual(string.getRgba("yellowblue"), undefined);
assert.strictEqual(string.getRgba("hsl(100, 10%, 10%)"), undefined);
assert.strictEqual(string.getRgba("hwb(100, 10%, 10%)"), undefined);

// generators
assert.equal(string.hexString([255, 10, 35]), "#FF0A23");

assert.equal(string.rgbString([255, 10, 35]), "rgb(255, 10, 35)");
assert.equal(string.rgbString([255, 10, 35, 0.3]), "rgba(255, 10, 35, 0.3)");
assert.equal(string.rgbString([255, 10, 35], 0.3), "rgba(255, 10, 35, 0.3)");
assert.equal(string.rgbaString([255, 10, 35, 0.3]), "rgba(255, 10, 35, 0.3)");
assert.equal(string.rgbaString([255, 10, 35], 0.3), "rgba(255, 10, 35, 0.3)");
assert.equal(string.rgbaString([255, 10, 35]), "rgba(255, 10, 35, 1)");
assert.equal(string.rgbaString([255, 10, 35, 0]), "rgba(255, 10, 35, 0)");

assert.equal(string.percentString([255, 10, 35]), "rgb(100%, 4%, 14%)");
assert.equal(string.percentString([255, 10, 35, 0.3]), "rgba(100%, 4%, 14%, 0.3)");
assert.equal(string.percentString([255, 10, 35], 0.3), "rgba(100%, 4%, 14%, 0.3)");
assert.equal(string.percentaString([255, 10, 35, 0.3]), "rgba(100%, 4%, 14%, 0.3)");
assert.equal(string.percentaString([255, 10, 35], 0.3), "rgba(100%, 4%, 14%, 0.3)");
assert.equal(string.percentaString([255, 10, 35]), "rgba(100%, 4%, 14%, 1)");

assert.equal(string.hslString([280, 40, 60]), "hsl(280, 40%, 60%)");
assert.equal(string.hslString([280, 40, 60, 0.3]), "hsla(280, 40%, 60%, 0.3)");
assert.equal(string.hslString([280, 40, 60], 0.3), "hsla(280, 40%, 60%, 0.3)");
assert.equal(string.hslaString([280, 40, 60, 0.3]), "hsla(280, 40%, 60%, 0.3)");
assert.equal(string.hslaString([280, 40, 60], 0.3), "hsla(280, 40%, 60%, 0.3)");
assert.equal(string.hslaString([280, 40, 60], 0), "hsla(280, 40%, 60%, 0)");
assert.equal(string.hslaString([280, 40, 60]), "hsla(280, 40%, 60%, 1)");

assert.equal(string.hwbString([280, 40, 60]), "hwb(280, 40%, 60%)");
assert.equal(string.hwbString([280, 40, 60, 0.3]), "hwb(280, 40%, 60%, 0.3)");
assert.equal(string.hwbString([280, 40, 60], 0.3), "hwb(280, 40%, 60%, 0.3)");
assert.equal(string.hwbString([280, 40, 60], 0), "hwb(280, 40%, 60%, 0)");

assert.equal(string.keyword([255, 255, 0]), "yellow");
assert.equal(string.keyword([100, 255, 0]), undefined);
