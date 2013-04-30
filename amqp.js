// Provider: AMQP

module.exports = DeclareAmqp;

var amqp = require('amqp');
var assert = require('assert');

// Supported options are as for amqp.createConnection():
//   host, port, login, password, vhost
function DeclareAmqp(provider, url, options) {
  this.provider = provider;
  this._connectOptions = url ? {url:url} : options;
}

DeclareAmqp.prototype.open = function (callback) {
  assert(!this._connection, 'connectors can only be opened once');

  var c = this._connection = amqp.createConnection(this._connectOptions);

  function onReady() {
    c.removeListener('error', onError);
    callback();
  }

  function onError(err) {
    c.removeListener('ready', onReady);
    callback(err);
  }

  c.once('ready', onReady);
  c.once('error', onError);

  return this;
};

DeclareAmqp.prototype.close = function (callback) {
  if (this._connection) {
    if (callback) {
      this._connection.on('close', function (had_error) {
        // discard had_error, it's boolean instead of an Error object
        callback();
      });
    }
    this._connection.end();
    this._connection = null;
  }
  return this;
};

// FIXME(sroberts) not clear where errors go... should we register for
// error event before every interaction? Can errors occur at
// other times, necessitating a error handler for the whole
// connection? Hm.

// Get amqp connection for a queue
function c(q) {
  return q._declaration._connection;
}

// callback with err, or (null, queue) when queue is ready
function PushAmqp (declaration, name, callback) {
  var self = this;
  this._declaration = declaration;
  this._q = c(this).queue(name, function () {
    callback(null, self);
  });
}

PushAmqp.prototype.publish = function (msg) {
  c(this).publish(this._q.name, msg);
  return this;
};

PushAmqp.prototype.close = function(callback) {
  this._q.destroy(/* ifUnused? ifEmpty? */);
  if (callback) {
    process.nextTick(callback);
  }
};

DeclareAmqp.prototype.pushQueue = function (name, callback) {
  return new PushAmqp(this, name, callback);
};

function PullAmqp (declaration, name, callback) {
  var self = this;
  this._declaration = declaration;
  this._q = c(this).queue(name, function () {
    callback(null, self);
  });
}

PullAmqp.prototype.subscribe = function (callback) {
  this._q.subscribe(/* ack? prefetchCount? */ function (msg) {
    if (msg.data && msg.contentType)
      msg = msg.data; // non-json
    // else msg is already-parsed json
    callback(msg);
  });
  return this;
};

PullAmqp.prototype.close = function(callback) {
  this._q.destroy(/* ifUnused? ifEmpty? */);
  if (callback) {
    process.nextTick(callback);
  }
};

DeclareAmqp.prototype.pullQueue = function (name, callback) {
  return new PullAmqp(this, name, callback);
};

