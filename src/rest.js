angular.module('restkit', ['logging', 'restkit.mapping', 'restkit.collection'])

    .factory('guid', function () {
        return (function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return function () {
                return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                    s4() + '-' + s4() + s4() + s4();
            };
        })();
    })

    .factory('wrappedCallback', function () {
        return function (callback) {
            return function (err, res) {
                if (callback) callback(err, res);
            }
        }
    })

    // Global entry points into Siesta.
    .factory('Siesta', function (Collection, CollectionRegistry, SaveOperation, CompositeOperation) {
        var siesta = {
            Collection: Collection,
            save: function (callback) {
                var dirtyCollections = [];
                for (var collName in CollectionRegistry) {
                    if (CollectionRegistry.hasOwnProperty(collName)) {
                        var coll = CollectionRegistry[collName];
                        if (coll.isDirty) dirtyCollections.push(coll);
                    }
                }
                var dirtyMappings = _.reduce(dirtyCollections, function (memo, c) {
                    _.each(c.__dirtyMappings, function (m) {
                        memo.push(m);
                    });
                    return memo;
                }, []);
                var dirtyObjects = _.reduce(dirtyMappings, function (memo, m) {
                    _.each(m.__dirtyObjects, function (o) {memo.push(o)});
                    return memo;
                }, []);
                if (dirtyObjects.length) {
                    var saveOperations = _.map(dirtyObjects, function (obj) {
                        return new SaveOperation(obj);
                    });
                    var op = new CompositeOperation('Save at mapping level', saveOperations, function () {
                        if (callback) callback(op.error ? op.error : null);
                    });
                    op.start();
                    return op;
                }
                else if (callback) {
                    callback();
                }
            }
        };
        Object.defineProperty(siesta, 'isDirty', {
            get: function () {
                return Collection.isDirty
            },
            configurable: true,
            enumerable: true
        });
        return  siesta;
    })

    .factory('RestError', function () {
        /**
         * Extension of javascript Error class for internal errors.
         * @param message
         * @param context
         * @param ssf
         * @returns {RestError}
         * @constructor
         */
        function RestError(message, context, ssf) {
            if (!this) {
                return new RestError(message, context);
            }

            this.message = message;

            this.context = context;
            // capture stack trace
            ssf = ssf || arguments.callee;
            if (ssf && Error.captureStackTrace) {
                Error.captureStackTrace(this, ssf);
            }
        }

        RestError.prototype = Object.create(Error.prototype);
        RestError.prototype.name = 'RestError';
        RestError.prototype.constructor = RestError;

        return RestError;
    })

/**
 * Delegate property of an object to another object.
 */
    .factory('defineSubProperty', function () {
        return function (property, subObj, innerProperty) {
            return Object.defineProperty(this, property, {
                get: function () {
                    if (innerProperty) {
                        return subObj[innerProperty];
                    }
                    else {
                        return subObj[property];
                    }
                },
                set: function (value) {
                    if (innerProperty) {
                        subObj[innerProperty] = value;
                    }
                    else {
                        subObj[property] = value;
                    }
                },
                enumerable: true,
                configurable: true
            });
        }
    })

    .factory('assert', function (RestError) {
        function assert(condition, message, context) {
            if (!condition) {
                message = message || "Assertion failed";
                context = context || {};
                throw new RestError(message, context);
            }
        }

        return assert;
    })

    .factory('constructMapFunction', function () {

        function arrayAsString(arr) {
            var arrContents = _.reduce(arr, function (memo, f) {return memo + '"' + f + '",'}, '');
            arrContents = arrContents.substring(0, arrContents.length - 1);
            return '[' + arrContents + ']';
        }

        return function (collection, type, fields) {
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
    })

    .factory('constructMapFunction2', function () {

        return function (collection, type, fields) {
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
    })


;