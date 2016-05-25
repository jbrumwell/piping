import cluster from 'cluster';
import path from 'path';

const natives = [
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'freelist',
  'fs',
  'http',
  'https',
  'module',
  'net',
  'os',
  'path',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'vm',
  'zlib'
];

const languages = {
  '.coffee': 'coffee-script'
};

cluster.worker.on('message', options => {
  const main = path.resolve(process.cwd(), options.main);
  const ext = path.extname(options.main);

  if (options.hook) {
    const module = require('module');
    const _load_orig = module._load;
    
    module._load = (name, parent, isMain) => {
      let file;
      file = module._resolveFilename(name, parent);
      if (options.includeModules || file.indexOf('node_modules') === -1) {
        if (!(natives.indexOf(file) >= 0 || file === main)) {
          cluster.worker.send({
            file
          });
        }
      }
      return _load_orig(name, parent, isMain);
    };
  }

  if (languages[ext]) {
    require(languages[ext]);
  }
  if (options.language) {
    require(options.language);
  }
  return require(main);
});

process.on('uncaughtException', err => {
  cluster.worker.send({
    err: (err != null ? err.stack : void 0) || err
  });
  return cluster.worker.kill();
});
