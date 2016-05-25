import cluster from 'cluster';
import path from 'path';
import colors from 'colors';
import _ from 'lodash';

const defaults = {
  hook: false,
  includeModules: false,
  main: require.main.filename,
  ignore: /(\/\.|~$)/,
  respawnOnExit: true,
  paths : false,
};

function getInitial(options) {
  const dir = path.dirname(options.main);

  if (options.hook) {
    initial = fixChokidar(options.main);
  } else if (Array.isArray(options.paths)){
    intitial = options.paths.map((file) => {
      return _.isString(file) ? path.join(dir, file) : file;
    });
  } else {
    initial = dir;
  }

  return initial;
}

function getOptions(ops) {
  if (typeof ops === 'string' || ops instanceof String) {
    options = _.defaults({
      main : path.resolve(ops),
    }, defaults);
  } else {
    options = _.defaults(ops, defaults);
  }

  return options;
}

function fixChokidar(file) {
  return `${file.slice(0, -1)}[${file.slice(-1)}]`;
}

export default ops => {
  let lastErr = '';
  let respawnPending = false;

  const options = getOptions(ops);

  if (cluster.isMaster) {
    cluster.setupMaster({
      exec: path.join(path.dirname(module.filename), 'launcher.js')
    });

    const chokidar = require('chokidar');
    const initial = getInitial(options);

    const watcher = chokidar.watch(initial, {
      ignored: options.ignore,
      ignoreInitial: true,
      usePolling: options.usePolling,
      interval: options.interval || 100,
      binaryInterval: options.binaryInterval || 300
    });

    cluster.fork();

    cluster.on('exit', (dead, code, signal) => {
      let hasWorkers, id, ref, worker;
      hasWorkers = false;
      ref = cluster.workers;
      for (id in ref) {
        worker = ref[id];
        hasWorkers = true;
      }
      if (!hasWorkers && (respawnPending || options.respawnOnExit)) {
        cluster.fork();
        return respawnPending = false;
      }
    });

    cluster.on('online', worker => {
      worker.send(options);

      return worker.on('message', message => {
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

    watcher.on('change', file => {
      let id, ref, worker;
      console.log('[piping]'.bold.red, 'File', path.relative(process.cwd(), file), 'has changed, reloading.');
      ref = cluster.workers;
      for (id in ref) {
        worker = ref[id];
        respawnPending = true;
        process.kill(worker.process.pid, 'SIGTERM');
      }
      if (!respawnPending) {
        return cluster.fork();
      }
    });

    watcher.on('add', file => {
      let id, ref, worker;
      console.log('[piping]'.bold.red, 'File', path.relative(process.cwd(), file), 'has been added, reloading.');
      ref = cluster.workers;
      for (id in ref) {
        worker = ref[id];
        respawnPending = true;
        process.kill(worker.process.pid, 'SIGTERM');
      }
      if (!respawnPending) {
        return cluster.fork();
      }
    });
  }

  return ! cluster.isMaster;
};
