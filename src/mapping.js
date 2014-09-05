var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Mapping');
Logger.setLevel(log.Level.warn);

var defineSubProperty = require('./misc').defineSubProperty;
var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var RestError = require('./error').RestError;
var relationship = require('./relationship');
var RelationshipType = relationship.RelationshipType;
var ForeignKeyRelationship = require('./foreignKeyRelationship').ForeignKeyRelationship;
var OneToOneRelationship = require('./oneToOneRelationship').OneToOneRelationship;
var Query = require('./query').Query;
var index = require('./index');
var Index = index.Index;
var Operation = require('../vendor/operations.js/src/operation').Operation;
var MappingOperation = require('./mappingOperation').MappingOperation;
var SaveOperation = require('./saveOperation').SaveOperation;
var RestObject = require('./object').RestObject;
var guid = require('./misc').guid;
var cache = require('./cache');
var extend = require('extend');

var ChangeType = require('./ChangeType').ChangeType;
var notificationCentre = require('./notificationCentre').notificationCentre;

var ArrayObserver = require('observe-js').ArrayObserver;


function Mapping(opts) {
    var self = this;
    this._opts = opts;
    Object.defineProperty(this, '_fields', {
        get: function () {
            var fields = [];
            if (self._opts.id) {
                fields.push(self._opts.id);
            }
            if (self._opts.attributes) {
                _.each(self._opts.attributes, function (x) {fields.push(x)});
            }
            return fields;
        },
        enumerable: true,
        configurable: true
    });

    defineSubProperty.call(this, 'type', self._opts);
    defineSubProperty.call(this, 'id', self._opts);
    defineSubProperty.call(this, 'collection', self._opts);
    defineSubProperty.call(this, 'attributes', self._opts);

    this._relationships = [];

    Object.defineProperty(this, 'relationships', {
        get: function () {
            return self._relationships;
        },
        enumerable: true,
        configurable: true
    });

    this.__dirtyObjects = [];

    Object.defineProperty(this, 'isDirty', {
        get: function () {
            return !!self.__dirtyObjects.length;
        },
        enumerable: true,
        configurable: true
    });

}

Mapping.prototype._markObjectAsDirty = function (obj) {
    if (this.__dirtyObjects.indexOf(obj) < 0) {
        this.__dirtyObjects.push(obj);
    }
    this._markCollectionAsDirtyIfNeccessary();
};

Mapping.prototype._unmarkObjectAsDirty = function (obj) {
    var idx = this.__dirtyObjects.indexOf(obj);
    if (idx > -1) {
        this.__dirtyObjects.splice(idx, 1);
    }
    this._markCollectionAsDirtyIfNeccessary();
};

Mapping.prototype._markCollectionAsDirtyIfNeccessary = function () {
    var collection = CollectionRegistry[this.collection];
    if (collection) {
        if (this.__dirtyObjects.length) {
            collection._markMappingAsDirty(this);
        }
        else {
            collection._unmarkMappingAsDirty(this);
        }
    }
    else {
        throw new RestError('Collection "' + this.collection + '" does not exist.');
    }

};

Mapping.prototype.installRelationships = function () {
    var self = this;
    self._relationships = [];
    if (self._opts.relationships) {
        for (var name in self._opts.relationships) {
            Logger.debug(self.type + ': configuring relationship ' + name);
            if (self._opts.relationships.hasOwnProperty(name)) {
                var relationship = self._opts.relationships[name];
                var relationshipClass;
                if (relationship.type == RelationshipType.ForeignKey) {
                    relationshipClass = ForeignKeyRelationship;
                }
                else if (relationship.type == RelationshipType.OneToOne) {
                    relationshipClass = OneToOneRelationship;
                }
                else {
                    throw new RestError('Unknown relationship type "' + relationship.type.toString() + '"');
                }
                var mappingName = relationship.mapping;
                Logger.debug('reverseMappingName', mappingName);
                var collection = CollectionRegistry[self.collection];
                Logger.debug('collection', CollectionRegistry);
                var reverseMapping = collection[mappingName];

                if (!reverseMapping) {
                    var arr = mappingName.split('.');
                    if (arr.length == 2) {
                        var collectionName = arr[0];
                        mappingName = arr[1];
                        var otherCollection = CollectionRegistry[collectionName];
                        if (!otherCollection) {
                            throw new RestError('Collection with name "' + collectionName + '" does not exist.');
                        }
                        reverseMapping = otherCollection[mappingName];
                    }
                }
                if (reverseMapping) {
                    Logger.debug('reverseMapping', reverseMapping);
                    var relationshipObj = new relationshipClass(name, relationship.reverse, self, reverseMapping);
                    self._relationships.push(relationshipObj);
                }
                else {
                    throw new RestError('Mapping with name "' + mappingName.toString() + '" does not exist');
                }
            }
        }
    }
};

Mapping.prototype.installReverseRelationships = function () {
    _.each(this.relationships, function (r) {
        var reverseMapping = r.reverseMapping;
        Logger.debug('Configuring reverse relationship "' + r.reverseName + '" on ' + reverseMapping.type);
        if (reverseMapping.relationships.indexOf(r) < 0) {
            reverseMapping.relationships.push(r);
        }
        Logger.debug(reverseMapping.type + ' now has relationships:', reverseMapping.relationships);
    });
};

Mapping.prototype.query = function (query, callback) {
    var q = new Query(this, query);
    q.execute(callback);
};

Mapping.prototype.get = function (id, callback) {
    var opts = {};
    opts[this.id] = id;
    var q = new Query(this, opts);
    q.execute(function (err, rows) {
        var obj = null;
        if (!err && rows.length) {
            if (rows.length > 1) {
                err = 'More than one object with id=' + id.toString();
            }
            else {
                obj = rows[0];
            }
        }
        if (callback) callback(err, obj);
    });
};

Mapping.prototype.all = function (callback) {
    var q = new Query(this, {});
    q.execute(callback);
};

Mapping.prototype.install = function (callback) {
    var errors = this._validate();
    if (!errors.length) {
        index.installIndexes(this.collection, this.type, this._fields, callback);
    }
    else {
        if (callback) callback(errors);
    }
};

Mapping.prototype._validate = function () {
    var errors = [];
    if (!this.type) {
        errors.push('Must specify a type');
    }
    if (!this.collection) {
        errors.push('A mapping must belong to an collection');
    }
    return errors;
};


function broadcast(obj, change) {
    var payload = {
        collection: obj.collection,
        type: obj.type,
        obj: obj,
        change: change
    };
    var mappingNotif = obj.collection + ':' + obj.type;
    notificationCentre.emit(mappingNotif, payload);
    var collectioNotif = obj.collection;
    notificationCentre.emit(collectioNotif, payload);
    var genericNotif = 'Fount';
    notificationCentre.emit(genericNotif, payload);
}

///**
// * Wraps the methods of a javascript array object so that notifications are sent
// * on calls.
// *
// * @param array the array we have wrapping
// * @param field name of the field
// * @param restObject the object to which this array is a property
// */
//

function wrapArray(array, field, restObject) {
    if (!array.observer) {
        array.observer = new ArrayObserver(array);
    }
    array.observer.open(function (splices) {
        splices.forEach(function (splice) {
            broadcast(restObject, {
                field: field,
                type: ChangeType.Splice,
                index: splice.index,
                addedCount: splice.addedCount,
                removed: splice.removed
            });
        });
    })
}

/**
 * Map data into Fount.
 *
 * @param data Raw data received remotely or otherwise
 * @param callback Called once pouch persistence returns.
 * @param obj Force mapping to this object
 */
Mapping.prototype.map = function (data, callback, obj) {
    if (Object.prototype.toString.call(data) == '[object Array]') {
        return this._mapBulk(data, callback);
    }
    else {
        var op = new MappingOperation(this, data, function () {
            var err = op.error;
            if (err) {
                if (callback) callback(err);
            }
            else if (callback) {
                callback(null, op._obj, op.operations);
            }
        });
        op._obj = obj;
        op.start();
        return op;
    }
};


Mapping.prototype._mapBulk = function (data, callback) {
    Logger.trace('_mapBulk: ' + JSON.stringify(data, null, 4));
    var self = this;
    var operations = _.map(data, function (datum) {
        return new MappingOperation(self, datum);
    });
    var op = new Operation('Bulk Mapping', operations, function (err) {
        if (err) {
            callback(err);
        }
        else {
            var objects = _.pluck(operations, '_obj');
            var res = _.map(operations, function (op) {
                return {
                    err: op.error,
                    obj: op._obj,
                    raw: op.data,
                    op: op
                }
            });
            callback(null, objects, res);
        }

    });
    op.start();
    return op;
};

/**
 * Convert raw data into a RestObject
 * @returns {RestObject}
 * @private
 */
Mapping.prototype._new = function (data) {
    var self = this;
    var _id = guid();
    var restObject = new RestObject(this);
    Logger.info('New object created _id="' + _id.toString() + '"', data);
    restObject._id = _id;
    // Place attributes on the object.
    restObject.__values = data || {};
    var fields = this._fields;
    var idx = fields.indexOf(this.id);
    if (idx > -1) {
        fields.splice(idx, 1);
    }
    restObject.__dirtyFields = [];
    _.each(fields, function (field) {

        Object.defineProperty(restObject, field, {
            get: function () {
                return restObject.__values[field] || null;
            },
            set: function (v) {
                var old = restObject.__values[field];
                restObject.__values[field] = v;
                broadcast(restObject, {
                    type: ChangeType.Set,
                    old: old,
                    new: v,
                    field: field
                });
                if (Object.prototype.toString.call(v) === '[object Array]') {
                    wrapArray(v, field, restObject);
                }

                if (v != old) {
                    Logger.trace('Marking "' + field + '" as dirty for _id="' + restObject._id + '" as just changed to ' + v);
                    restObject._markFieldAsDirty(field);
                }

            },
            enumerable: true,
            configurable: true
        });
    });

    Object.defineProperty(restObject, this.id, {
        get: function () {
            return restObject.__values[self.id] || null;
        },
        set: function (v) {
            var old = restObject.__values[self.id];
            restObject.__values[self.id] = v;
            broadcast(restObject, {
                type: ChangeType.Set,
                old: old,
                new: v,
                field: self.id
            });
            cache.remoteInsert(restObject, v, old);
        },
        enumerable: true,
        configurable: true
    });


    // Place relationships on the object.
    _.each(this.relationships, function (relationship) {
        relationship.contributeToRestObject(restObject);
    });

    return restObject;
};

Mapping.prototype.save = function (callback) {
    var dirtyObjects = this.__dirtyObjects;
    if (dirtyObjects.length) {
        var saveOperations = _.map(dirtyObjects, function (obj) {
            return new SaveOperation(obj);
        });
        var op = new Operation('Save at mapping level', saveOperations, function () {
            if (callback) callback(op.error ? op.error : null);
        });
        op.start();
        return op;
    }
    else {
        if (callback) callback();
    }
};

Mapping.prototype._dump = function (asJSON) {
    var dumped = {};
    dumped.name = this.type;
    dumped.attributes = this.attributes;
    dumped.id = this.id;
    dumped.collection = this.collection;
    dumped.relationships = _.map(this.relationships, function (r) {
        if (r.isForward(this)) {
            return r.name;
        }
        else {
            return r.reverseName;
        }
    });
    return asJSON ? JSON.stringify(dumped, null, 4) : dumped;
};

Mapping.prototype.toString = function () {
    return 'Mapping[' + this.type + ']';
};


/**
 * A subclass of RestError specifcally for errors that occur during mapping.
 * @param message
 * @param context
 * @param ssf
 * @returns {MappingError}
 * @constructor
 */
function MappingError(message, context, ssf) {
    if (!this) {
        return new MappingError(message, context);
    }

    this.message = message;

    this.context = context;
    // capture stack trace
    ssf = ssf || arguments.callee;
    if (ssf && RestError.captureStackTrace) {
        RestError.captureStackTrace(this, ssf);
    }
}

MappingError.prototype = Object.create(RestError.prototype);
MappingError.prototype.name = 'MappingError';
MappingError.prototype.constructor = MappingError;

function arrayAsString(arr) {
    var arrContents = _.reduce(arr, function (memo, f) {return memo + '"' + f + '",'}, '');
    arrContents = arrContents.substring(0, arrContents.length - 1);
    return '[' + arrContents + ']';
}


function constructMapFunction (collection, type, fields) {
    var mapFunc;
    var onlyEmptyFieldSetSpecified = (fields.length == 1 && !fields[0].length);
    var noFieldSetsSpecified = !fields.length || onlyEmptyFieldSetSpecified;

    var arr = arrayAsString(fields);
    if (noFieldSetsSpecified) {
        mapFunc = function (doc) {
            var type = "$2";
            var collection = "$3";
            if (doc.type == type && doc.collection == collection) {
                emit(doc.type, doc);
            }
        }.toString();
    }
    else {
        mapFunc = function (doc) {
            var type = "$2";
            var collection = "$3";
            if (doc.type == type && doc.collection == collection) {
                //noinspection JSUnresolvedVariable
                var fields = $1;
                var aggField = '';
                for (var idx in fields) {
                    //noinspection JSUnfilteredForInLoop
                    var field = fields[idx];
                    var value = doc[field];
                    if (value !== null && value !== undefined) {
                        aggField += value.toString() + '_';
                    }
                    else if (value === null) {
                        aggField += 'null_';
                    }
                    else {
                        aggField += 'undefined_';
                    }
                }
                aggField = aggField.substring(0, aggField.length - 1);
                emit(aggField, doc);
            }
        }.toString();
        mapFunc = mapFunc.replace('$1', arr);
    }
    mapFunc = mapFunc.replace('$2', type);
    mapFunc = mapFunc.replace('$3', collection);
    return mapFunc;
}


function constructMapFunction2 (collection, type, fields) {
    var mapFunc;
    var onlyEmptyFieldSetSpecified = (fields.length == 1 && !fields[0].length);
    var noFieldSetsSpecified = !fields.length || onlyEmptyFieldSetSpecified;

    if (noFieldSetsSpecified) {
        mapFunc = function (doc) {
            if (doc.type == type && doc.collection == collection) {
                emit(doc.type, doc);
            }
        };
    }
    else {
        mapFunc = function (doc) {
            if (doc.type == type && doc.collection == collection) {
                var aggField = '';
                for (var idx in fields) {
                    //noinspection JSUnfilteredForInLoop
                    var field = fields[idx];
                    var value = doc[field];
                    if (value !== null && value !== undefined) {
                        aggField += value.toString() + '_';
                    }
                    else if (value === null) {
                        aggField += 'null_';
                    }
                    else {
                        aggField += 'undefined_';
                    }
                }
                aggField = aggField.substring(0, aggField.length - 1);
                emit(aggField, doc);
            }
        };
    }
    return mapFunc;
}

exports.Mapping = Mapping;
exports.MappingError = MappingError;
exports.constructMapFunction2 = constructMapFunction2;
exports.constructMapFunction = constructMapFunction;