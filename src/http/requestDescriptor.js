/**
 * @module http
 */

var Descriptor = require('./descriptor').Descriptor
    , Serialiser = require('./serialiser');

var _i = siesta._internal
    , util = _i.util
    , log = _i.log
    , defineSubProperty = _i.misc.defineSubProperty
;

var Logger = log.loggerWithName('RequestDescriptor');
Logger.setLevel(log.Level.warn);

/**
 * @class Describes a HTTP request
 * @param {Object} opts
 */
function RequestDescriptor(opts) {
    if (!this) {
        return new RequestDescriptor(opts);
    }

    Descriptor.call(this, opts);
    if (this._opts['serializer']) {
        this._opts.serialiser = this._opts['serializer'];
    }

    if (!this._opts.serialiser) {
        this._opts.serialiser = Serialiser.depthSerializer(0);
    }


    defineSubProperty.call(this, 'serialiser', this._opts);
    defineSubProperty.call(this, 'serializer', this._opts, 'serialiser');

}

RequestDescriptor.prototype = Object.create(Descriptor.prototype);


RequestDescriptor.prototype._serialise = function (obj, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    if (Logger.trace.isEnabled)
        Logger.trace('_serialise');
    var finished;
    var data = this.serialiser(obj, function (err, data) {
        if (!finished) {
            data = self._transformData(data);
            if (callback) callback(err, self._embedData(data));
        }
    });
    if (data !== undefined) {
        if (Logger.trace.isEnabled)
            Logger.trace('serialiser doesnt use a callback');
        finished = true;
        data = self._transformData(data);
        if (callback) callback(null, self._embedData(data));
    }
    else {
        if (Logger.trace.isEnabled)
            Logger.trace('serialiser uses a callback', this.serialiser);
    }
    return deferred.promise;
};

RequestDescriptor.prototype._dump = function (asJson) {
    var obj = {};
    obj.methods = this.method;
    obj.mapping = this.mapping.type;
    obj.path = this._rawOpts.path;
    var serialiser;
    if (typeof(this._rawOpts.serialiser) == 'function') {
        serialiser = 'function () { ... }'
    }
    else {
        serialiser = this._rawOpts.serialiser;
    }
    obj.serialiser = serialiser;
    var transforms = {};
    for (var f in this.transforms) {
        if (this.transforms.hasOwnProperty(f)) {
            var transform = this.transforms[f];
            if (typeof(transform) == 'function') {
                transforms[f] = 'function () { ... }'
            }
            else {
                transforms[f] = this.transforms[f];
            }
        }
    }
    obj.transforms = transforms;
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};

exports.RequestDescriptor = RequestDescriptor;
