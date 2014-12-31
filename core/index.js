var collection = require('./collection'),
    util = require('./util'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    Collection = collection.Collection,
    cache = require('./cache'),
    Model = require('./model').Model,
    notifications = require('./notifications'),
    Operation = require('./operation/operation').Operation,
    OperationQueue = require('./operation/queue').OperationQueue,
    RelationshipType = require('./relationship').RelationshipType,
    PositionedReactiveQuery = require('./positionedReactiveQuery'),
    ReactiveQuery = require('./reactiveQuery'),
    changes = require('./changes'),
    log = require('./operation/log'),
    _ = util._;

Operation.logLevel = log.Level.warn;
OperationQueue.logLevel = log.Level.warn;

if (window.Q) window.q = window.Q;

// Initialise siesta object. Strange format facilities using submodules with requireJS.
var siesta = function (ext) {
    if (!siesta.ext) siesta.ext = {};
    _.extend(siesta.ext, ext || {});
    return siesta;
};

// Notifications
_.extend(siesta, {
    on: notifications.on.bind(notifications),
    off: notifications.removeListener.bind(notifications),
    once: notifications.once.bind(notifications),
    removeAllListeners: notifications.removeAllListeners.bind(notifications)
});
_.extend(siesta, {
    removeListener: siesta.off,
    addListener: siesta.on
});

// Expose some stuff for usage by extensions and/or users
_.extend(siesta, {
    RelationshipType: RelationshipType,
    ChangeType: changes.ChangeType,
    LogLevel: log.Level,
    InsertionPolicy: ReactiveQuery.InsertionPolicy,
    _internal: {
        log: log,
        Model: Model,
        model: require('./model'),
        error: require('./error'),
        ChangeType: changes.ChangeType,
        siestaModel: require('./modelInstance'),
        extend: require('extend'),
        notifications: require('./notifications'),
        cache: require('./cache'),
        Operation: Operation,
        OperationQueue: OperationQueue,
        coreChanges: changes,
        CollectionRegistry: require('./collectionRegistry').CollectionRegistry,
        Collection: collection.Collection,
        collection: collection,
        utils: util,
        util: util,
        _: util._,
        query: require('./query'),
        store: require('./store')
    },
    _: util._,
    async: util.async,
    isArray: util.isArray,
    isString: util.isString
});

siesta.ext = {};


_.extend(siesta, {
    /**
     * Wipe everything. Used during test generally.
     */
    reset: function (cb) {
        cache.reset();
        CollectionRegistry.reset();
        siesta.ext.http.DescriptorRegistry.reset();
        if (siesta.ext.storageEnabled) {
            siesta.ext.storage._reset(cb);
        }
        else {
            cb();
        }
    },
    /**
     * Creates and registers a new Collection.
     * @param  {String} name
     * @param  {Object} [opts]
     * @return {Collection}
     */
    collection: function (name, opts) {
        return new Collection(name, opts);
    },
    /**
     * Install all collections.
     * @param {Function} [callback]
     * @returns {q.Promise}
     */
    install: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.cb(callback, deferred);
        var collectionNames = CollectionRegistry.collectionNames,
            tasks = _.map(collectionNames, function (n) {
                return function (done) {
                    CollectionRegistry[n].install(done);
                }
            });
        siesta.async.parallel(tasks, function (err) {
            if (err) {
                callback(err);
            }
            else {
                var ensureSingletons = function (err) {
                    if (!err) {
                        var ensureSingletonTasks = [];
                        for (var i = 0; i < collectionNames.length; i++) {
                            var collection = CollectionRegistry[collectionNames[i]],
                                modelNames = Object.keys(collection._models);
                            for (var j = 0; j < modelNames.length; j++) {
                                var modelName = modelNames[j],
                                    model = collection[modelName];
                                var fn = function (done) {
                                    this.ensureSingletons(done);
                                }.bind(model);
                                ensureSingletonTasks.push(fn);
                            }
                        }
                        siesta.async.parallel(ensureSingletonTasks, function (err, res) {
                            callback(err, res);
                        });
                    }
                    else {
                        callback(err);
                    }
                };
                if (siesta.ext.storageEnabled) {
                    // Load models from PouchDB.
                    siesta.ext.storage._load(ensureSingletons);
                }
                else {
                    ensureSingletons();
                }
            }
        });

        return deferred ? deferred.promise : null;
    },
    setLogLevel: function (loggerName, level) {
        var Logger = log.loggerWithName(loggerName);
        Logger.setLevel(level);
    },
    notify: util.next
});




if (typeof window != 'undefined') {
    window.siesta = siesta;
}

module.exports = siesta;