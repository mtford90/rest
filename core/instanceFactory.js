var log = require('./log')('model'),
  InternalSiestaError = require('./error').InternalSiestaError,
  RelationshipType = require('./RelationshipType'),
  Query = require('./Query'),
  ModelInstance = require('./ModelInstance'),
  util = require('./util'),
  guid = util.guid,
  cache = require('./cache'),
  extend = require('extend'),
  modelEvents = require('./modelEvents'),
  wrapArray = require('./events').wrapArray,
  OneToManyProxy = require('./OneToManyProxy'),
  OneToOneProxy = require('./OneToOneProxy'),
  ManyToManyProxy = require('./ManyToManyProxy'),
  ReactiveQuery = require('./ReactiveQuery'),
  ModelEventType = modelEvents.ModelEventType;

function ModelInstanceFactory(model) {
  this.model = model;
}

ModelInstanceFactory.prototype = {
  _getLocalId: function(data) {
    var localId;
    if (data) {
      localId = data.localId ? data.localId : guid();
    } else {
      localId = guid();
    }
    return localId;
  },
  /**
   * Configure attributes
   * @param modelInstance
   * @param data
   * @private
   */

  _installAttributes: function(modelInstance, data) {
    var Model = this.model,
      attributeNames = Model._attributeNames,
      idx = attributeNames.indexOf(Model.id);
    util.extend(modelInstance, {
      __values: util.extend(Model.attributes.reduce(function(m, a) {
        if (a.default !== undefined) m[a.name] = a.default;
        return m;
      }, {}), data || {})
    });
    if (idx > -1) attributeNames.splice(idx, 1);
    attributeNames.forEach(function(attributeName) {
      var attributeDefinition = Model._attributeDefinitionWithName(attributeName);
      Object.defineProperty(modelInstance, attributeName, {
        get: function() {
          var value = modelInstance.__values[attributeName];
          return value === undefined ? null : value;
        },
        set: function(v) {
          if (attributeDefinition.parse) {
            v = attributeDefinition.parse.call(modelInstance, v);
          }
          if (Model.parseAttribute) {
            v = Model.parseAttribute.call(modelInstance, attributeName, v);
          }
          var old = modelInstance.__values[attributeName];
          var propertyDependencies = this._propertyDependencies[attributeName] || [];
          propertyDependencies = propertyDependencies.map(function(dependant) {
            return {
              prop: dependant,
              old: this[dependant]
            }
          }.bind(this));

          modelInstance.__values[attributeName] = v;
          propertyDependencies.forEach(function(dep) {
            var propertyName = dep.prop;
            var new_ = this[propertyName];
            modelEvents.emit({
              collection: Model.collectionName,
              model: Model.name,
              localId: modelInstance.localId,
              new: new_,
              old: dep.old,
              type: ModelEventType.Set,
              field: propertyName,
              obj: modelInstance
            });
          }.bind(this));
          var e = {
            collection: Model.collectionName,
            model: Model.name,
            localId: modelInstance.localId,
            new: v,
            old: old,
            type: ModelEventType.Set,
            field: attributeName,
            obj: modelInstance
          };
          window.lastEmission = e;
          modelEvents.emit(e);
          if (util.isArray(v)) {
            wrapArray(v, attributeName, modelInstance);
          }
        },
        enumerable: true,
        configurable: true
      });
    });
  },
  _installMethods: function(modelInstance) {
    var Model = this.model;
    Object.keys(Model.methods).forEach(function(methodName) {
      if (modelInstance[methodName] === undefined) {
        modelInstance[methodName] = Model.methods[methodName].bind(modelInstance);
      }
      else {
        log('A method with name "' + methodName + '" already exists. Ignoring it.');
      }
    }.bind(this));
  },
  _installProperties: function(modelInstance) {
    var _propertyNames = Object.keys(this.model.properties),
      _propertyDependencies = {};
    _propertyNames.forEach(function(propName) {
      var propDef = this.model.properties[propName];
      var dependencies = propDef.dependencies || [];
      dependencies.forEach(function(attr) {
        if (!_propertyDependencies[attr]) _propertyDependencies[attr] = [];
        _propertyDependencies[attr].push(propName);
      });
      delete propDef.dependencies;
      if (modelInstance[propName] === undefined) {
        Object.defineProperty(modelInstance, propName, propDef);
      }
      else {
        log('A property/method with name "' + propName + '" already exists. Ignoring it.');
      }
    }.bind(this));

    modelInstance._propertyDependencies = _propertyDependencies;
  },
  _installRemoteId: function(modelInstance) {
    var Model = this.model;
    var idField = Model.id;
    Object.defineProperty(modelInstance, idField, {
      get: function() {
        return modelInstance.__values[Model.id] || null;
      },
      set: function(v) {
        var old = modelInstance[Model.id];
        modelInstance.__values[Model.id] = v;
        modelEvents.emit({
          collection: Model.collectionName,
          model: Model.name,
          localId: modelInstance.localId,
          new: v,
          old: old,
          type: ModelEventType.Set,
          field: Model.id,
          obj: modelInstance
        });
        cache.remoteInsert(modelInstance, v, old);
      },
      enumerable: true,
      configurable: true
    });
  },
  /**
   * @param definition - Definition of a relationship
   * @param modelInstance - Instance of which to install the relationship.
   */
  _installRelationship: function(definition, modelInstance) {
    var proxy;
    var type = definition.type;
    if (type == RelationshipType.OneToMany) {
      proxy = new OneToManyProxy(definition);
    }
    else if (type == RelationshipType.OneToOne) {
      proxy = new OneToOneProxy(definition);
    }
    else if (type == RelationshipType.ManyToMany) {
      proxy = new ManyToManyProxy(definition);
    }
    else {
      throw new InternalSiestaError('No such relationship type: ' + type);
    }
    proxy.install(modelInstance);
  },
  _installRelationshipProxies: function(modelInstance) {
    var model = this.model;
    for (var name in model.relationships) {
      if (model.relationships.hasOwnProperty(name)) {
        var definition = util.extend({}, model.relationships[name]);
        this._installRelationship(definition, modelInstance);
      }
    }
  },
  _registerInstance: function(modelInstance, shouldRegisterChange) {
    cache.insert(modelInstance);
    shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
    if (shouldRegisterChange) modelInstance._emitNew();
  },
  _installLocalId: function(modelInstance, data) {
    modelInstance.localId = this._getLocalId(data);
  },
  /**
   * Convert raw data into a ModelInstance
   * @returns {ModelInstance}
   */
  _instance: function(data, shouldRegisterChange) {
    if (!this.model._relationshipsInstalled || !this.model._reverseRelationshipsInstalled) {
      throw new InternalSiestaError('Model must be fully installed before creating any models');
    }
    var modelInstance = new ModelInstance(this.model);
    this._installLocalId(modelInstance, data);
    this._installAttributes(modelInstance, data);
    this._installMethods(modelInstance);
    this._installProperties(modelInstance);
    this._installRemoteId(modelInstance);
    this._installRelationshipProxies(modelInstance);
    this._registerInstance(modelInstance, shouldRegisterChange);
    return modelInstance;
  }
};

module.exports = ModelInstanceFactory;