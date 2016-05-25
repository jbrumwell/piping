'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _colors = require('colors');

var _colors2 = _interopRequireDefault(_colors);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var defaults = {
  hook: false,
  includeModules: false,
  main: require.main.filename,
  ignore: /(\/\.|~$)/,
  respawnOnExit: true,
  paths: false
};

function getInitial(options) {
  var dir = _path2['default'].dirname(options.main);
  var initial = dir;

  if (options.hook) {
    initial = fixChokidar(options.main);
  } else if (Array.isArray(options.paths)) {
    intitial = options.paths.map(function (file) {
      return _lodash2['default'].isString(file) ? _path2['default'].join(dir, file) : file;
    });
  }

  return initial;
}

function getOptions(ops) {
  var options = undefined;

  if (typeof ops === 'string' || ops instanceof String) {
    options = _lodash2['default'].defaults({
      main: _path2['default'].resolve(ops)
    }, defaults);
  } else {
    options = _lodash2['default'].defaults(ops, defaults);
  }

  return options;
}

function fixChokidar(file) {
  return file.slice(0, -1) + '[' + file.slice(-1) + ']';
}

exports['default'] = function (ops) {
  var lastErr = '';
  var respawnPending = false;

  var options = getOptions(ops);

  if (_cluster2['default'].isMaster) {
    (function () {
      _cluster2['default'].setupMaster({
        exec: _path2['default'].join(_path2['default'].dirname(module.filename), 'launcher.js')
      });

      var chokidar = require('chokidar');
      var initial = getInitial(options);

      var watcher = chokidar.watch(initial, {
        ignored: options.ignore,
        ignoreInitial: true,
        usePolling: options.usePolling,
        interval: options.interval || 100,
        binaryInterval: options.binaryInterval || 300
      });

      _cluster2['default'].fork();

      _cluster2['default'].on('exit', function (dead, code, signal) {
        var hasWorkers = undefined,
            id = undefined,
            ref = undefined,
            worker = undefined;
        hasWorkers = false;
        ref = _cluster2['default'].workers;
        for (id in ref) {
          worker = ref[id];
          hasWorkers = true;
        }
        if (!hasWorkers && (respawnPending || options.respawnOnExit)) {
          _cluster2['default'].fork();
          return respawnPending = false;
        }
      });

      _cluster2['default'].on('online', function (worker) {
        worker.send(options);

        return worker.on('message', function (message) {
          if (message.err && (!options.respawnOnExit || message.err !== lastErr)) {
            console.log('[piping]'.bold.red, 'can not execute file:', options.main);
            console.log('[piping]'.bold.red, 'error given was:', message.err);
            if (options.respawnOnExit) {
              lastErr = message.err;
              return console.log('[piping]'.bold.red, 'further repeats of this error will be suppressed...');
            }
          } else if (message.file) {
            if (options.usePolling) {
              return watcher.add(message.file);
            } else {
              return watcher.add(fixChokidar(message.file));
            }
          }
        });
      });

      watcher.on('change', function (file) {
        var id = undefined,
            ref = undefined,
            worker = undefined;
        console.log('[piping]'.bold.red, 'File', _path2['default'].relative(process.cwd(), file), 'has changed, reloading.');
        ref = _cluster2['default'].workers;
        for (id in ref) {
          worker = ref[id];
          respawnPending = true;
          process.kill(worker.process.pid, 'SIGTERM');
        }
        if (!respawnPending) {
          return _cluster2['default'].fork();
        }
      });

      watcher.on('add', function (file) {
        var id = undefined,
            ref = undefined,
            worker = undefined;
        console.log('[piping]'.bold.red, 'File', _path2['default'].relative(process.cwd(), file), 'has been added, reloading.');
        ref = _cluster2['default'].workers;
        for (id in ref) {
          worker = ref[id];
          respawnPending = true;
          process.kill(worker.process.pid, 'SIGTERM');
        }
        if (!respawnPending) {
          return _cluster2['default'].fork();
        }
      });
    })();
  }

  return !_cluster2['default'].isMaster;
};

module.exports = exports['default'];