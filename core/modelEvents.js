var InternalSiestaError = require('./error').InternalSiestaError,
  log = require('./log')('events'),
  ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
  extend = require('./util').extend;

/**
 * Constants that describe change events.
 * Set => A new value is assigned to an attribute/relationship
 * Splice => All javascript array operations are described as splices.
 * Delete => Used in the case where objects are removed from an array, but array order is not known in advance.
 * Remove => Object deletion events
 * New => Object creation events
 * @type {Object}
 */
var ModelEventType = {
  Set: 'set',
  Splice: 'splice',
  New: 'new',
  Remove: 'remove'
};

/**
 * Represents an individual change.
 * @param opts
 * @constructor
 */
function ModelEvent(opts) {
  this._opts = opts || {};
  Object.keys(opts).forEach(function(k) {
    this[k] = opts[k];
  }.bind(this));
}

ModelEvent.prototype._dump = function(pretty) {
  var dumped = {};
  dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
  dumped.model = (typeof this.model) == 'string' ? this.model : this.model.name;
  dumped.localId = this.localId;
  dumped.field = this.field;
  dumped.type = this.type;
  if (this.index) dumped.index = this.index;
  if (this.added) dumped.added = this.added.map(function(x) {return x._dump()});
  if (this.removed) dumped.removed = this.removed.map(function(x) {return x._dump()});
  if (this.old) dumped.old = this.old;
  if (this.new) dumped.new = this.new;
  return pretty ? util.prettyPrint(dumped) : dumped;
};

function broadcastEvent(collectionName, modelName, opts) {
  var app = siesta.app;
  var genericEvent = 'Siesta',
    collection = app.collectionRegistry[collectionName],
    model = collection[modelName];
  if (!collection) throw new InternalSiestaError('No such collection "' + collectionName + '"');
  if (!model) throw new InternalSiestaError('No such model "' + modelName + '"');
  var shouldEmit = opts.obj._emitEvents;
  // Don't emit pointless events.
  if (shouldEmit && 'new' in opts && 'old' in opts) {
    if (opts.new instanceof Date && opts.old instanceof Date) {
      shouldEmit = opts.new.getTime() != opts.old.getTime();
    }
    else {
      shouldEmit = opts.new != opts.old;
    }
  }
  if (shouldEmit) {
    app.events.emit(genericEvent, opts);
    var modelEvent = collectionName + ':' + modelName,
      localIdEvent = opts.localId;
    app.events.emit(collectionName, opts);
    app.events.emit(modelEvent, opts);
    app.events.emit(localIdEvent, opts);
    if (model.id && opts.obj[model.id]) app.events.emit(collectionName + ':' + modelName + ':' + opts.obj[model.id], opts);
  }
}

function validateEventOpts(opts) {
  if (!opts.model) throw new InternalSiestaError('Must pass a model');
  if (!opts.collection) throw new InternalSiestaError('Must pass a collection');
  if (!opts.localId) throw new InternalSiestaError('Must pass a local identifier');
  if (!opts.obj) throw new InternalSiestaError('Must pass the object');
}

function emit(app, opts) {
  validateEventOpts(opts);
  var collection = opts.collection;
  var model = opts.model;
  var c = new ModelEvent(opts);
  broadcastEvent(collection, model, c);
  return c;
}

extend(exports, {
  ModelEvent: ModelEvent,
  emit: emit,
  validateEventOpts: validateEventOpts,
  ModelEventType: ModelEventType,
  wrapArray: function(array, field, modelInstance) {
    if (!array.observer) {
      array.observer = new ArrayObserver(array);
      array.observer.open(function(splices) {
        var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
        if (fieldIsAttribute) {
          splices.forEach(function(splice) {
            emit(modelInstance.app, {
              collection: modelInstance.collectionName,
              model: modelInstance.model.name,
              localId: modelInstance.localId,
              index: splice.index,
              removed: splice.removed,
              added: splice.addedCount ? array.slice(splice.index, splice.index + splice.addedCount) : [],
              type: ModelEventType.Splice,
              field: field,
              obj: modelInstance
            });
          });
        }
      });
    }
  }
});
