/**
 * @module relationships
 */

var proxy = require('./proxy')
    , RelationshipProxy = proxy.RelationshipProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , InternalSiestaError = require('./error').InternalSiestaError
    , coreChanges = require('./changes')
    , notificationCentre = require('./notificationCentre')
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , SiestaModel = require('./modelInstance').ModelInstance
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType
    ;

/**
 * [ManyToManyProxy description]
 * @param {Object} opts
 */
function ManyToManyProxy(opts) {
    RelationshipProxy.call(this, opts);
    var self = this;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            }
            return true;
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            }
            else {
                if (!self._id) {
                    self._id = [];
                    self.related = [];
                    self.wrapArray(self.related);
                }
            }
        }
    });
    this._reverseIsArray = true;
}

ManyToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

_.extend(ManyToManyProxy.prototype, {
    clearReverse: function (removed) {
        var self = this;
        _.each(removed, function (removedObject) {
            var reverseProxy = proxy.getReverseProxyForObject.call(self, removedObject);
            var idx = reverseProxy._id.indexOf(self.object._id);
            proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function () {
                proxy.splice.call(reverseProxy, idx, 1);
            });
        });
    },
    setReverse: function (added) {
        var self = this;
        _.each(added, function (addedObject) {
            var reverseProxy = proxy.getReverseProxyForObject.call(self, addedObject);
            proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function () {
                proxy.splice.call(reverseProxy, 0, 0, self.object);
            });
        });
    },
    wrapArray: function (arr) {
        var self = this;
        wrapArrayForAttributes(arr, this.reverseName, this.object);
        if (!arr.oneToManyObserver) {
            arr.oneToManyObserver = new ArrayObserver(arr);
            var observerFunction = function (splices) {
                splices.forEach(function (splice) {
                    var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                    var removed = splice.removed;
                    self.clearReverse(removed);
                    self.setReverse(added);
                    var mapping = proxy.getForwardMapping.call(self);
                    coreChanges.registerChange({
                        collection: mapping.collection,
                        mapping: mapping.type,
                        _id: self.object._id,
                        field: proxy.getForwardName.call(self),
                        removed: removed,
                        added: added,
                        removedId: _.pluck(removed, '_id'),
                        addedId: _.pluck(added, '_id'),
                        type: ChangeType.Splice,
                        index: splice.index,
                        obj: self.object
                    });
                });
            };
            arr.oneToManyObserver.open(observerFunction);
        }
    },
    get: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var self = this;
        if (this.isFault) {
            Store.get({_id: this._id}, function (err, stored) {
                if (err) {
                    if (callback) callback(err);
                }
                else {
                    self.related = stored;
                    if (callback) callback(null, stored);
                }
            })
        }
        else {
            if (callback) callback(null, this.related);
        }
        return deferred ? deferred.promise : null;
    },
    validate: function (obj) {
        if (Object.prototype.toString.call(obj) != '[object Array]') {
            return 'Cannot assign scalar to many to many';
        }
        return null;
    },
    set: function (obj) {
        proxy.checkInstalled.call(this);
        var self = this;
        if (obj) {
            var errorMessage;
            if (errorMessage = this.validate(obj)) {
                return errorMessage;
            }
            else {
                proxy.clearReverseRelated.call(this);
                proxy.set.call(self, obj);
                this.wrapArray(obj);
                proxy.setReverse.call(self, obj);
            }
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
        }
    },
    install: function (obj) {
        RelationshipProxy.prototype.install.call(this, obj);
        obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(proxy.splice, this);
    }


});


module.exports = ManyToManyProxy;