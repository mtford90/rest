/**
 * A dead simple implementation of ES6 promise, that does not swallow errors.
 * @param fn
 * @constructor
 */

function Promise(fn) {
  this.okCallbacks = [];
  this.errorCallbacks = [];

  this.resolved = null;
  this.rejected = null;
  this.isResolved = false;
  this.isRejected = false;


  var resolve = function(payload) {
    if (!(this.resolved || this.rejected)) {
      this.resolved = payload;
      this.isResolved = true;
      for (var i = 0; i < this.okCallbacks.length; i++) {
        var cb = this.okCallbacks[i];
        cb(payload);
      }
    }
  }.bind(this);

  var reject = function(err) {
    if (!(this.resolved || this.rejected)) {
      this.rejected = err;
      this.isRejected = true;
      for (var i = 0; i < this.errorCallbacks.length; i++) {
        var cb = this.errorCallbacks[i];
        cb(err);
      }
    }
  }.bind(this);

  if (fn) fn(resolve, reject);
}

Promise.all = function(promises) {
  return new Promise(function(resolve, reject) {
    var n = promises.length;
    if (n) {
      var numResolve = 0;
      var numReject = 0;
      var resolveValues = [];
      var rejectValues = [];

      promises.forEach(function(promise, idx) {
        promise.then(function(payload) {
          resolveValues[idx] = payload;
          numResolve++;
          check();
        }, function(err) {
          rejectValues[idx] = err;
          numReject++;
          check();
        });
      });

      function check() {
        if ((numResolve + numReject) == n) {
          if (numReject) reject(rejectValues);
          else resolve(resolveValues);
        }
      }
    }
    else resolve([]);
  });
};

Promise.prototype = {
  then: function(ok, err) {
    if (this.isResolved) {
      if (ok) {
        ok(this.resolved);
      }
    }
    else if (this.isRejected) {
      if (err) {
        err(this.rejected);
      }
    }
    else {
      if (ok) {
        this.okCallbacks.push(ok);
      }
      if (err) {
        this.errorCallbacks.push(err);
      }
    }
    return this;
  },
  catch: function(err) {
    if (this.isRejected) {
      if (err) {
        err(this.rejected);
      }
    }
    else {
      if (err) {
        this.errorCallbacks.push(err);
      }
    }
    return this;
  }
};

module.exports = Promise;