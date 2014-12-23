if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

if (typeof PouchDB == 'undefined') {
    throw new Error('Could not find PouchDB. Have you included the script?');
}

var DB_NAME = 'siesta';
var unsavedObjects = [],
    unsavedObjectsHash = {},
    _i = siesta._internal,
    CollectionRegistry = _i.CollectionRegistry,
    log = _i.log,
    pouch = new PouchDB(DB_NAME);

var Logger = log.loggerWithName('Storage');
Logger.setLevel(log.Level.trace);

/**
 * Serialise a model down to PouchDB.
 * @param {ModelInstance} model
 */
function _serialise(model) {
    var serialised = siesta.extend({}, model.__values);
    serialised['collection'] = model.collection;
    serialised['model'] = model.type;
    serialised['_id'] = model._id;
    var rev = model._rev;
    if (rev) serialised['_rev'] = rev;
    serialised = _.reduce(model._relationshipNames, function (memo, n) {
        var val = model[n];
        if (siesta.isArray(val)) {
            memo[n] = _.pluck(val, '_id');
        }
        else if (val) {
            memo[n] = val._id;
        }
        return memo;
    }, serialised);
    return serialised;
}

function _deserialise(data, cb) {
    var collectionName = data.collection,
        modelName = data.model,
        collection = CollectionRegistry[collectionName],
        model = collection[modelName];
    // Add blank object with correct _id to the cache so that can map data onto it.
    var rev = data._rev;
    delete data._rev;
    delete data.collection;
    delete data.model;
    var relationshipNames = model._relationshipNames;
    _.each(relationshipNames, function (r) {
        var _id = data[r];
        if (siesta.isArray(_id)) {
            data[r] = _.map(_id, function (x) { return {_id: x}});
        }
        else {
            data[r] = {_id: _id};
        }
    });
    model.map(data, {disableNotifications: true}, function (err, instance) {
        if (!err) {
            instance._rev = rev;
        }
        else {
            Logger.error('err', err);
        }
        cb(err, instance);
    });
}

/**
 * Load all data from PouchDB.
 */
function _load(callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = callback || function () {};
    var mapFunc = function (doc) {
        emit(doc._id, doc);
    }.toString();
    pouch.query({map: mapFunc}).then(function (resp) {
        console.log('resp', resp);
        var tasks = siesta.map(siesta.pluck(resp.rows, 'value'), function (datum) {
            return function (done) {
                _deserialise(datum, done)
            }
        });
        siesta.parallel(tasks, function (err, instances) {
            callback(err, instances);
            if (err) deferred.reject(err);
            else deferred.resolve(instances);
        });
    }).catch(function (err) {
        callback(err);
        if (deferred) deferred.reject(err);
    });
    return deferred ? deferred.promise : null;
}

/**
 * Save all changes down to PouchDB.
 */
function save(callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = callback || function () {};
    var objects = unsavedObjects;
    unsavedObjects = [];
    unsavedObjectsHash = {};
    pouch.bulkDocs(_.map(objects, _serialise)).then(function (resp) {
        for (var i = 0; i < resp.length; i++) {
            var response = resp[i];
            var obj = objects[i];
            if (response.ok) {
                obj._rev = response.rev;
            }
            else {
                Logger.error('Error saving object with _id="' + obj._id + '"', response);
            }
        }
        callback();
        if (deferred) deferred.resolve();
    }, function (err) {
        callback(err);
        if (deferred) deferred.reject(err);
    });
    return deferred ? deferred.promise : null;
}

var listener = function (n) {
    var changedObject = n.obj,
        ident = changedObject._id;
    if (!changedObject) {
        throw new _i.error.InternalSiestaError('No obj field in notification received by storage extension');
    }
    if (!(ident in unsavedObjectsHash)) {
        unsavedObjectsHash[ident] = changedObject;
        unsavedObjects.push(changedObject);
    }
};
siesta.on('Siesta', listener);

var storage = {
    _load: _load,
    save: save,
    _serialise: _serialise,
    _reset: function (cb) {
        siesta.removeListener('Siesta', listener);
        unsavedObjects = [];
        unsavedObjectsHash = {};
        pouch.destroy(function (err) {
            if (!err) {
                pouch = new PouchDB(DB_NAME);
            }
            siesta.on('Siesta', listener);
            Logger.warn('Reset complete');
            cb(err);
        })
    }
};

Object.defineProperty(storage, '_unsavedObjects', {
    get: function () {return unsavedObjects}
});

Object.defineProperty(storage, '_pouch', {
    get: function () {return pouch}
});

if (typeof siesta != 'undefined') {
    if (!siesta.ext) {
        siesta.ext = {};
    }
    siesta.ext.storage = storage;
}

if (typeof module != 'undefined') {
    module.exports = storage;
}