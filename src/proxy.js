var RestError = require('./error').RestError
    , Store = require('./store')
    , defineSubProperty = require('./misc').defineSubProperty
    , Operation = require('../vendor/operations.js/src/operation').Operation
    , util = require('./util')
    , _ = util._
    , changes = require('./changes')
    , Query = require('./query').Query
    , log = require('../vendor/operations.js/src/log')
    , ChangeType = require('./changeType').ChangeType;

function Fault(proxy) {
    var self = this;
    this.proxy = proxy;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            return self.proxy.isFault;
        },
        enumerable: true,
        configurable: true
    });
}

Fault.prototype.get = function () {
    this.proxy.get.apply(this.proxy, arguments);
};

Fault.prototype.set = function () {
    this.proxy.set.apply(this.proxy, arguments);
};

function NewObjectProxy(opts) {
    this._opts = opts;
    if (!this) return new NewObjectProxy(opts);
    var self = this;
    this.fault = new Fault(this);
    this.object = null;
    this._id = undefined;
    this.related = null;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            }
            else if (self._id === null) {
                return false;
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
                    self._id = null;
                }
            }
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'reverseMapping', this._opts);
    defineSubProperty.call(this, 'forwardMapping', this._opts);
    defineSubProperty.call(this, 'forwardName', this._opts);
    defineSubProperty.call(this, 'reverseName', this._opts);
    Object.defineProperty(this, 'isReverse', {
        get: function () {
            if (self.object) {
                return self.object.mapping == self.reverseMapping;
            }
            else {
                throw new RestError('Cannot use proxy until installed')
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(this, 'isForward', {
        get: function () {
            if (self.object) {
                return self.object.mapping == self.forwardMapping;
            }
            else {
                throw new RestError('Cannot use proxy until installed')
            }
        },
        enumerable: true,
        configurable: true
    });
}

NewObjectProxy.prototype.install = function (obj) {
    if (obj) {
        if (!this.object) {
            this.object = obj;
            var self = this;
            var name = getForwardName.call(this);
            Object.defineProperty(obj, name, {
                get: function () {
                    if (self.related) {
                        return self.related;
                    }
                    else {
                        return self.fault;
                    }
                },
                set: function (v) {
                    self.set(v);
                },
                configurable: true,
                enumerable: true
            });
            obj[ ('get' + util.capitaliseFirstLetter(name))] = _.bind(this.get, this);
            obj[ ('set' + util.capitaliseFirstLetter(name))] = _.bind(this.set, this);
            obj[name + 'Proxy'] = this;
            if (!obj._proxies) {
                obj._proxies = [];
            }
            obj._proxies.push(this);
        }
        else {
            throw new RestError('Already installed.');
        }
    }
    else {
        throw new RestError('No object passed to relationship install');
    }
};

NewObjectProxy.prototype.set = function (obj) {
    throw new RestError('Must subclass NewObjectProxy');
};

NewObjectProxy.prototype.get = function (callback) {
    throw new RestError('Must subclass NewObjectProxy');
};

function getReverseProxyForObject(obj) {
    var reverseName = getReverseName.call(this);
    var proxyName = (reverseName + 'Proxy');
    if (util.isArray(obj)) {
        return _.pluck(obj, proxyName);
    }
    else {
        return obj[proxyName];
    }
}

function getReverseName() {
    return this.isForward ? this.reverseName : this.forwardName;
}

function getForwardName() {
    return this.isForward ? this.forwardName : this.reverseName;
}

function getReverseMapping() {
    return this.isForward ? this.reverseMapping : this.forwardMapping;
}

function checkInstalled() {
    if (!this.object) {
        throw new RestError('Proxy must be installed on an object before can use it.');
    }
}

/**
 * Configure _id and related with the new related object.
 * @param obj
 */
function set(obj) {
    registerSetChange.call(this, obj);
    if (obj) {
        if (util.isArray(obj)) {
            this._id = _.pluck(obj, '_id');
            this.related = obj;
        }
        else {
            this._id = obj._id;
            this.related = obj;
        }
    }
    else {
        this._id = null;
        this.related = null;
    }
}

function splice(idx, numRemove) {
    registerSpliceChange.apply(this, arguments);
    var add = Array.prototype.slice.call(arguments, 2);
    var returnValue = _.partial(this._id.splice, idx, numRemove).apply(this._id, _.pluck(add, '_id'));
    if (this.related) {
        _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
    }
    return returnValue;
}

function clearReverseRelated() {
    var self = this;
    if (!self.isFault) {
        if (this.related) {
            var reverseProxy = getReverseProxyForObject.call(this, this.related);
            var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
            _.each(reverseProxies, function (p) {
                if (util.isArray(p._id)) {
                    var idx = p._id.indexOf(self.object._id);
                    splice.call(p, idx, 1);
                }
                else {
                    set.call(p, null);
                }
            });
        }
    }
    else {
        if (self._id) {
            var reverseName = getReverseName.call(this);
            var reverseMapping = getReverseMapping.call(this);
            var identifiers = util.isArray(self._id) ? self._id : [self._id];
            if (this._reverseIsArray) {
                _.each(identifiers, function (_id) {
                    changes.registerChange({
                        collection: reverseMapping.collection,
                        mapping: reverseMapping.type,
                        _id: _id,
                        field: reverseName,
                        removed: [self.object._id],
                        type: ChangeType.Remove
                    });
                });
            }
            else {
                _.each(identifiers, function (_id) {
                    changes.registerChange({
                        collection: reverseMapping.collection,
                        mapping: reverseMapping.type,
                        _id: _id,
                        field: reverseName,
                        new: null,
                        old: self.object._id,
                        type: ChangeType.Set
                    });
                });
            }

        }
        else {
            throw new Error();
        }
    }
}

function setReverse(obj) {
    var self = this;
    var reverseProxy = getReverseProxyForObject.call(this, obj);
    var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
    _.each(reverseProxies, function (p) {
        clearReverseRelated.call(p);
        if (util.isArray(p._id)) {
            splice.call(p, p._id.length, 0, self.object);
        }
        else {
            set.call(p, self.object);
        }
    });
}

function registerSetChange(obj) {
    var mapping = this.object.mapping.type;
    var coll = this.object.collection;
    var newVar;
    if (util.isArray(obj)) {
        newVar = _.pluck(obj, '_id');
    }
    else {
        newVar = obj ? obj._id : obj;
    }
    changes.registerChange({
        collection: coll,
        mapping: mapping,
        _id: this.object._id,
        field: getForwardName.call(this),
        new: newVar,
        old: this._id,
        type: ChangeType.Set
    });
}

function registerSpliceChange(idx, numRemove) {
    var add = Array.prototype.slice.call(arguments, 2);
    var mapping = this.object.mapping.type;
    var coll = this.object.collection;
    changes.registerChange({
        collection: coll,
        mapping: mapping,
        _id: this.object._id,
        field: getForwardName.call(this),
        index: idx,
        removed: this._id.slice(idx, idx+numRemove),
        added: _.pluck(add, '_id'),
        type: ChangeType.Splice
    });
}

exports.NewObjectProxy = NewObjectProxy;
exports.Fault = Fault;
exports.getReverseProxyForObject = getReverseProxyForObject;
exports.getReverseName = getReverseName;
exports.getReverseMapping = getReverseMapping;
exports.checkInstalled = checkInstalled;
exports.set = set;
exports.registerSetChange = registerSetChange;
exports.splice = splice;
exports.clearReverseRelated = clearReverseRelated;
exports.setReverse = setReverse;