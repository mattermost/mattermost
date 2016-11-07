'use strict';

function Sorter() {
}

Sorter.prototype.sort = function(tokens, fromIndex) {
  fromIndex = fromIndex || 0;
  for (var i = 0, len = this.tokens.length; i < len; i++) {
    var token = this.tokens[i];
    var index = tokens.indexOf(token, fromIndex);
    if (index !== -1) {
      do {
        if (index !== fromIndex) {
          tokens.splice(index, 1);
          tokens.splice(fromIndex, 0, token);
        }
        fromIndex++;
      } while ((index = tokens.indexOf(token, fromIndex)) !== -1);
      return this[token].sort(tokens, fromIndex);
    }
  }
  return tokens;
};

function TokenChain() {
}

TokenChain.prototype = {
  add: function(tokens) {
    var self = this;
    tokens.forEach(function(token) {
      if (!self[token]) {
        self[token] = [];
        self[token].processed = 0;
      }
      self[token].push(tokens);
    });
  },
  createSorter: function() {
    var self = this;
    var sorter = new Sorter();
    sorter.tokens = Object.keys(this).sort(function(j, k) {
      var m = self[j].length;
      var n = self[k].length;
      return m < n ? 1 : m > n ? -1 : j < k ? -1 : j > k ? 1 : 0;
    }).filter(function(token) {
      if (self[token].processed < self[token].length) {
        var chain = new TokenChain();
        self[token].forEach(function(tokens) {
          var index;
          while ((index = tokens.indexOf(token)) !== -1) {
            tokens.splice(index, 1);
          }
          tokens.forEach(function(token) {
            self[token].processed++;
          });
          chain.add(tokens.slice(0));
        });
        sorter[token] = chain.createSorter();
        return true;
      }
      return false;
    });
    return sorter;
  }
};

module.exports = TokenChain;
