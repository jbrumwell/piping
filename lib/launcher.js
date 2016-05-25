'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var natives = ['assert', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'freelist', 'fs', 'http', 'https', 'module', 'net', 'os', 'path', 'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'tty', 'url', 'util', 'vm', 'zlib'];

var languages = {
  '.coffee': 'coffee-script'
};

_cluster2['default'].worker.on('message', function (options) {
  var main = _path2['default'].resolve(process.cwd(), options.main);
  var ext = _path2['default'].extname(options.main);

  if (options.hook) {
    (function () {
      var module = require('module');
      var _load_orig = module._load;

      module._load = function (name, parent, isMain) {
        var file = undefined;
        file = module._resolveFilename(name, parent);
        if (options.includeModules || file.indexOf('node_modules') === -1) {
          if (!(natives.indexOf(file) >= 0 || file === main)) {
            _cluster2['default'].worker.send({
              file: file
            });
          }
        }
        return _load_orig(name, parent, isMain);
      };
    })();
  }

  if (languages[ext]) {
    require(languages[ext]);
  }
  if (options.language) {
    require(options.language);
  }
  return require(main);
});

process.on('uncaughtException', function (err) {
  _cluster2['default'].worker.send({
    err: (err != null ? err.stack : void 0) || err
  });
  return _cluster2['default'].worker.kill();
});