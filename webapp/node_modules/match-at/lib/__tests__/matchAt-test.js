"use strict";

describe("matchAt", function () {

  var matchAt;

  beforeEach(function () {
    matchAt = require("../matchAt.js");
  });

  it("matches a simple regex", function () {
    expect(matchAt(/l/, "hello", 0)).toBe(null);
    expect(matchAt(/l/, "hello", 1)).toBe(null);
    expect(matchAt(/l/, "hello", 4)).toBe(null);
    expect(matchAt(/l/, "hello", 5)).toBe(null);

    var match = matchAt(/l/, "hello", 2);
    expect(Array.isArray(match)).toBe(true);
    expect(match.index).toBe(2);
    expect(match.input).toBe("hello");
    expect(match[0]).toBe("l");
    expect(match[1]).toBe(undefined);
    expect(match.length).toBe(1);

    var match = matchAt(/l/, "hello", 3);
    expect(Array.isArray(match)).toBe(true);
    expect(match.index).toBe(3);
    expect(match.input).toBe("hello");
    expect(match[0]).toBe("l");
    expect(match[1]).toBe(undefined);
    expect(match.length).toBe(1);
  });

  it("matches a zero-length regex", function () {
    expect(matchAt(/(?=l)/, "hello", 0)).toBe(null);
    expect(matchAt(/(?=l)/, "hello", 1)).toBe(null);
    expect(matchAt(/(?=l)/, "hello", 4)).toBe(null);
    expect(matchAt(/(?=l)/, "hello", 5)).toBe(null);

    var match = matchAt(/(?=l)/, "hello", 2);
    expect(Array.isArray(match)).toBe(true);
    expect(match.index).toBe(2);
    expect(match.input).toBe("hello");
    expect(match[0]).toBe("");
    expect(match[1]).toBe(undefined);
    expect(match.length).toBe(1);

    var match = matchAt(/(?=l)/, "hello", 3);
    expect(Array.isArray(match)).toBe(true);
    expect(match.index).toBe(3);
    expect(match.input).toBe("hello");
    expect(match[0]).toBe("");
    expect(match[1]).toBe(undefined);
    expect(match.length).toBe(1);
  });

  it("matches a regex with capturing groups", function () {
    expect(matchAt(/(l)(l)?/, "hello", 0)).toBe(null);
    expect(matchAt(/(l)(l)?/, "hello", 1)).toBe(null);
    expect(matchAt(/(l)(l)?/, "hello", 4)).toBe(null);
    expect(matchAt(/(l)(l)?/, "hello", 5)).toBe(null);

    var match = matchAt(/(l)(l)?/, "hello", 2);
    expect(Array.isArray(match)).toBe(true);
    expect(match.index).toBe(2);
    expect(match.input).toBe("hello");
    expect(match[0]).toBe("ll");
    expect(match[1]).toBe("l");
    expect(match[2]).toBe("l");
    expect(match.length).toBe(3);

    var match = matchAt(/(l)(l)?/, "hello", 3);
    expect(Array.isArray(match)).toBe(true);
    expect(match.index).toBe(3);
    expect(match.input).toBe("hello");
    expect(match[0]).toBe("l");
    expect(match[1]).toBe("l");
    expect(match[2]).toBe(undefined);
    expect(match.length).toBe(3);
  });

  it("copies flags over", function () {
    expect(matchAt(/L/i, "hello", 0)).toBe(null);
    expect(matchAt(/L/i, "hello", 1)).toBe(null);
    expect(matchAt(/L/i, "hello", 2)).not.toBe(null);
    expect(matchAt(/L/i, "hello", 3)).not.toBe(null);
    expect(matchAt(/L/i, "hello", 4)).toBe(null);
    expect(matchAt(/L/i, "hello", 5)).toBe(null);
  });
});