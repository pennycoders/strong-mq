//
// # NativeSubscribeQueue
//
// TODO: Description.
//
var cluster = require('cluster');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

//
// ## NativeSubscribeQueue `NativeSubscribeQueue(obj)`
//
// Creates a new instance of NativeSubscribeQueue with the following options:
//
function NativeSubscribeQueue(obj) {
  if (!(this instanceof NativeSubscribeQueue)) {
    return new NativeSubscribeQueue(obj);
  }

  EventEmitter.call(this);

  obj = obj || {};

  this.name = obj.name;
  this.queue = obj.queue || null;
}
util.inherits(NativeSubscribeQueue, EventEmitter);
NativeSubscribeQueue.createQueue = NativeSubscribeQueue;

//
// ## subscribe `subscribe(pattern, [handler])`
//
// Subscribes to **pattern**, increasing the types of `message` events emitted. If provided, **handler** will be
// added as a `'message'` event listener for this queue.
//
NativeSubscribeQueue.prototype.subscribe = cluster.isMaster ? masterSubscribe : workerSubscribe;
function masterSubscribe(pattern, handler) {
  var self = this;
  var regexp = RegExp('^' + pattern + '\\.');

  if (!self.queue) {
    // This will only happen if NativeSubscribeQueue is used externally and improperly.
    throw new Error('No underlying queue was created.');
  }

  self.queue.on('publish', function(data) {
    if (regexp.test(data.topic + '.')) {
      self.emit('message', data.msg);
    }
  });

  if (typeof handler === 'function') {
    self.on('message', handler);
  }

  return self;
}
function workerSubscribe(pattern) {
  var self = this;
  var regexp = RegExp('^' + pattern + '\\.');

  process.on('message', function(data) {
    if (data.name === self.name && data.type === 'publish' && regexp.test(data.topic + '.')) {
      self.emit('message', data.msg);
    }
  });

  if (typeof handler === 'function') {
    self.on('message', handler);
  }

  return self;
}

module.exports = NativeSubscribeQueue;