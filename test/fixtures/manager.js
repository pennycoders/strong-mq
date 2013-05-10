//
// # Manager
//
// A very simple manager for setting up and running distributed test cases.
//
var cluster = require('cluster');
var fs = require('fs');
var clusterMQ = require('../../');

//
// ## Manager `Manager(obj)`
//
// Creates a new instance of Manager.
//
function Manager(obj) {
  if (!(this instanceof Manager)) {
    return new Manager(obj);
  }

  obj = obj || { provider: 'native' };

  this.connection = clusterMQ.create(obj);
  this.connection.open();

  this.filename = obj.filename || './out.txt';
}
Manager.createManager = Manager;

//
// ##.init .init([workers])`
//
// Initializes the current process for testing and forks **workers** (defaults
// to 2) child processes.
//
Manager.prototype.init = init;
function init(workers) {
  var self = this;
  var count = typeof workers === 'number' ? workers : 2;

  if (cluster.isMaster) {
    fs.writeFileSync(self.filename, '');

    for (var i = 0; i < Number(count); i++) {
      cluster.fork({
        id: 'worker' + i,
        OUTFILE: self.filename
      });
    }

    process.env.id = 'master';
  }

  return self;
}

//
// ## runTestPush `runTestPush(name, [messages])`
//
// Creates a PushQueue named **name**, publishing **messages** (defaults to 4)
// messages over that queue.
//
Manager.prototype.runTestPush = runTestPush;
function runTestPush(name, messages) {
  var self = this;
  var count = typeof messages === 'number' ? messages : 4;
  var queue = self.connection.createPushQueue(name);

  for (var i = 0; i < count; i++) {
    queue.publish(process.env.id + '.' + i);
  }

  return self;
}

//
// ## runTestPull `runTestPull(name)`
//
// Creates a PullQueue named **name**, subscribing to all messages sent to it.
//
Manager.prototype.runTestPull = runTestPull;
function runTestPull(name) {
  var self = this;
  var queue = self.connection.createPullQueue(name);

  queue.subscribe(function handler(msg) {
    fs.appendFileSync(self.filename, process.env.id + ':' + name + ':' + msg + '\n');
  });

  return self;
}

//
// ## loadTestResults `loadTestResults()`
//
// Loads all content printed by previous test runs, returning a sorted Array of the results.
//
Manager.prototype.loadTestResults = loadTestResults;
function loadTestResults() {
  var self = this;

  return fs
    .readFileSync(self.filename)
    .toString()
    .split('\n')
    .filter(function (line) {
      return !!line;
    })
    .sort();
}

module.exports = Manager;