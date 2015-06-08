!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Router=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Expose `pathtoRegexp`.
 */

module.exports = pathtoRegexp;

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Object} options
 * @return {RegExp}
 * @api private
 */

function pathtoRegexp(path, keys, options) {
  options = options || {};
  var strict = options.strict;
  var end = options.end !== false;
  var flags = options.sensitive ? '' : 'i';
  keys = keys || [];

  if (path instanceof RegExp) {
    return path;
  }

  if (Array.isArray(path)) {
    // Map array parts into regexps and return their source. We also pass
    // the same keys and options instance into every generation to get
    // consistent matching groups before we join the sources together.
    path = path.map(function (value) {
      return pathtoRegexp(value, keys, options).source;
    });

    return new RegExp('(?:' + path.join('|') + ')', flags);
  }

  path = ('^' + path + (strict ? '' : path[path.length - 1] === '/' ? '?' : '/?'))
    .replace(/\/\(/g, '/(?:')
    .replace(/([\/\.])/g, '\\$1')
    .replace(/(\\\/)?(\\\.)?:(\w+)(\(.*?\))?(\*)?(\?)?/g, function (match, slash, format, key, capture, star, optional) {
      slash = slash || '';
      format = format || '';
      capture = capture || '([^\\/' + format + ']+?)';
      optional = optional || '';

      keys.push({ name: key, optional: !!optional });

      return ''
        + (optional ? '' : slash)
        + '(?:'
        + format + (optional ? slash : '') + capture
        + (star ? '((?:[\\/' + format + '].+?)?)' : '')
        + ')'
        + optional;
    })
    .replace(/\*/g, '(.*)');

  // If the path is non-ending, match until the end or a slash.
  path += (end ? '$' : (path[path.length - 1] === '/' ? '' : '(?=\\/|$)'));

  return new RegExp(path, flags);
};

},{}],2:[function(require,module,exports){
var pathRegexp = require('path-to-regexp');

/**
 * 通用于前后台的 router
 * @constructor
 */
function Router () {
  this.routes = [];
}


Router.prototype = {
  constructor: Router,
  /**
   * 监听 url 变化
   * @param {String|RegExp} path
   * @param {Function} handler
   */
  on: function (path, handler) {
    var keys = [];

    this.routes.push({
      path: path,
      handler: handler,
      reg: pathRegexp(path, keys),
      keys: keys
    });
  },

  off: function (path, handler) {
    for(var i = this.routes.length - 1, route; route = this.routes[i]; i--) {
      if(path === route.path) {
        if(handler && handler === route.handler || !handler) {
          this.routes.splice(i, 1);
        }
      }
    }
  },
  /**
   * express adaptor
   * @return {Function} express middleware
   */
  express: function () {
    var that = this;
    return function (req, res, next) {
      if(res.writable) {
        listener.call(that, req.url).then(function (ctx) {
          res.ctx = ctx;
          next();
        }, function (error, ctx) {
          res.ctx = ctx;
          next(error);
        });
      }
    }
  },
  /**
   * browser adaptor
   * @param {Window} root 浏览器 window 对象
   * @param {Number} [opts.routeType=0] 0: 使用 pushState, 不支持的浏览器将刷新页面; 1: 使用 hashchange
   * @param {String} [opts.pushStateEventName] 自定义的 pushstate 事件名
   */
  browser: function (root, opts) {
    root = root || window;
    opts = opts || {};
    var that = this;
    var eventType;
    var pushStateEventName = opts.pushStateEventName || 'pushstate';

    switch (opts.routeType) {
      case 1:
        eventType = 'hashchange';
        break;
      default:
        eventType = 'popstate';
        break;
    }

    var callback = function () {
      var url = eventType === 'popstate' ? (root.location.pathname + root.location.search) : root.location.hash.slice(1);
      listener.call(that, url).then(function (ctx) {

      }, function (error, ctx) {

      });
    };

    root.addEventListener(eventType, callback, false);

    if(root.history.pushState) {
      //history.pushState 方法不产生事件, 所以使用自定义事件
      if(eventType === 'popstate') {
        root.addEventListener(pushStateEventName, callback, false);
      }
      root.document.body.addEventListener('click', function (e) {
        if (e.target.getAttribute('data-pushstate')) {
          if (e.target.href) {
            root.history.pushState({}, document.title, e.target.href);
            fireEvent(e.target, pushStateEventName);
            e.preventDefault();
          }
        }
      }, false);
    }
    callback()
  }
};

//匹配 URL 变化函数. 当 url 发生变化, 各监听函数应调用该方法.
var listener = function (url) {
  var that = this;
  var path = url.split('?');

  var search = path.slice(1).join('?');
  path = path[0]

  var ctx = {end: false, param: null, path: path, url: url, search: search && ('?' + search)};

  return new Promise(function (resolve, reject) {

    (function next(index) {
      var route = that.routes[index];
      var param = null;
      var match;
      var result;

      if(route && !ctx.end) {
        match = route.reg.exec(path);
        if(match) {
          param = match.length - 1 === route.keys.length ? {} : [];

          for(var i = 1, l = match.length, key, val; i < l; i++) {
            key = route.keys[i - 1];

            try{
              val = match[i] && decodeURIComponent(match[i]);
            }catch(e) {
              val = match[i];
            }

            if(key) {
              param[key.name] = val;
            }else{
              param.push(val);
            }
          }

          ctx.param = param;

          try{
            result = route.handler.call(ctx, ctx);
            if(result && typeof result.then === 'function') {
              result.then(function() {
                next(++index);
              }, function(e) {
                error(e);
                next(++index);
              });
            }else{
              next(++index);
            }
          }catch(e){
            error(e);
            reject(e, ctx);
            return;
          }

        }else{
          next(++index);
        }

      }else{
        ctx.end = true;
        resolve(ctx);
      }

    })(0);

  })
};

function error(e) {
  console.error(e);
  e.stack && console.error(e.stack);
}

function fireEvent(element, ev) {
  var e = null;
  if (document.createEventObject) {
    //ie
    e = document.createEventObject();
    element.fireEvent('on' + ev, e);
  }else {
    //others
    e = document.createEvent('HTMLEvents');
    e.initEvent(ev, true, true);
    element.dispatchEvent(e);
  }
}

module.exports = Router;

},{"path-to-regexp":1}]},{},[2])(2)
});