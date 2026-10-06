/* eslint-disable */
/**
 * Compatibility shims for the APIs PDF.js 6 assumes are present.
 *
 * PDF.js calls Promise.withResolvers, Object.hasOwn, String.replaceAll,
 * Array.prototype.at, Array.prototype.flatMap and structuredClone directly. A
 * browser older than any one of those throws as soon as the reader loads and the
 * document never appears — which is why some students could open a PDF and
 * others could not, with no error shown.
 *
 * PDF.js ships a "legacy" build, but it only polyfills Promise.withResolvers;
 * everything else is still called bare, so the legacy build alone still fails on
 * an older Android browser.
 *
 * This is written in ES5 and kept import-free on purpose: the same file is
 * inlined into the PDF.js worker (scripts/build-pdf-worker.mjs), and the worker
 * must not contain an import statement or it stops loading as a module worker.
 * Every shim is guarded, so on a current browser this does nothing.
 */
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : self;

  function define(target, name, value) {
    try {
      Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: value,
      });
    } catch (e) {
      target[name] = value;
    }
  }

  if (typeof Promise !== "undefined" && typeof Promise.withResolvers !== "function") {
    define(Promise, "withResolvers", function withResolvers() {
      var resolve, reject;
      var promise = new Promise(function (res, rej) {
        resolve = res;
        reject = rej;
      });
      return { promise: promise, resolve: resolve, reject: reject };
    });
  }

  if (typeof Object.hasOwn !== "function") {
    define(Object, "hasOwn", function hasOwn(object, key) {
      return Object.prototype.hasOwnProperty.call(object, key);
    });
  }

  function at(index) {
    var length = this.length >>> 0;
    var i = index < 0 ? length + index : index;
    if (i < 0 || i >= length) return undefined;
    return typeof this === "string" ? this.charAt(i) : this[i];
  }
  if (typeof Array.prototype.at !== "function") define(Array.prototype, "at", at);
  if (typeof String.prototype.at !== "function") define(String.prototype, "at", at);

  if (typeof String.prototype.replaceAll !== "function") {
    define(String.prototype, "replaceAll", function replaceAll(find, replacement) {
      if (find instanceof RegExp) {
        if (!find.global) throw new TypeError("replaceAll requires a global RegExp");
        return this.replace(find, replacement);
      }
      var escaped = String(find).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return this.replace(new RegExp(escaped, "g"), replacement);
    });
  }

  if (typeof Array.prototype.flatMap !== "function") {
    define(Array.prototype, "flatMap", function flatMap(callback, thisArg) {
      var out = [];
      for (var i = 0; i < this.length; i++) {
        var mapped = callback.call(thisArg, this[i], i, this);
        if (Array.isArray(mapped)) {
          for (var j = 0; j < mapped.length; j++) out.push(mapped[j]);
        } else {
          out.push(mapped);
        }
      }
      return out;
    });
  }

  if (typeof Array.prototype.findLast !== "function") {
    define(Array.prototype, "findLast", function findLast(predicate, thisArg) {
      for (var i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    });
  }

  if (typeof Array.prototype.findLastIndex !== "function") {
    define(Array.prototype, "findLastIndex", function findLastIndex(predicate, thisArg) {
      for (var i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    });
  }

  if (typeof Array.prototype.includes !== "function") {
    define(Array.prototype, "includes", function includes(value, from) {
      for (var i = from || 0; i < this.length; i++) {
        var item = this[i];
        if (item === value || (item !== item && value !== value)) return true;
      }
      return false;
    });
  }

  if (typeof g.structuredClone !== "function") {
    // Transferables cannot be honoured, so buffers are copied rather than moved.
    // PDF.js only uses this to hand typed arrays to its worker, so a copy is
    // correct — just not zero-cost.
    var cloneValue = function (input, seen) {
      if (input === null || typeof input !== "object") return input;
      if (seen.has(input)) return seen.get(input);
      if (input instanceof Date) return new Date(input.getTime());
      if (input instanceof ArrayBuffer) return input.slice(0);
      if (ArrayBuffer.isView(input)) {
        return new input.constructor(input.buffer.slice(0));
      }
      if (Array.isArray(input)) {
        var arr = [];
        seen.set(input, arr);
        for (var i = 0; i < input.length; i++) arr.push(cloneValue(input[i], seen));
        return arr;
      }
      if (typeof Map !== "undefined" && input instanceof Map) {
        var map = new Map();
        seen.set(input, map);
        input.forEach(function (v, k) {
          map.set(cloneValue(k, seen), cloneValue(v, seen));
        });
        return map;
      }
      if (typeof Set !== "undefined" && input instanceof Set) {
        var set = new Set();
        seen.set(input, set);
        input.forEach(function (v) {
          set.add(cloneValue(v, seen));
        });
        return set;
      }
      var out = {};
      seen.set(input, out);
      for (var key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = cloneValue(input[key], seen);
      }
      return out;
    };
    define(g, "structuredClone", function structuredClone(value) {
      return cloneValue(value, new Map());
    });
  }

  if (typeof g.requestIdleCallback !== "function") {
    define(g, "requestIdleCallback", function requestIdleCallback(callback) {
      var start = Date.now();
      return setTimeout(function () {
        callback({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1);
    });
    define(g, "cancelIdleCallback", function cancelIdleCallback(id) {
      clearTimeout(id);
    });
  }
})();
