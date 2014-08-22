angular.module('restkit.relationship', ['restkit', 'restkit.store'])

    .constant('RelationshipType', {
        ForeignKey: 'ForeignKey',
        ManyToMany: 'ManyToMany',
        OneToOne: 'OneToOne'
    })

    .factory('RelatedObjectProxy', function ($q) {
        function RelatedObjectProxy(relationship, object) {
            this.relationship = relationship;
            this.object = object;
            this._id = null;
            this.relatedObject = null;
        }

        RelatedObjectProxy.prototype.get = function (callback) {
            var self = this;
            var deferred = $q.defer();
            this.relationship.getRelated(this.object, function (err, related) {
                if (!err) {
                    self.relatedObject = related;
                }
                if (callback) callback(err, related);
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(related);
                }
            });
            return deferred.promise;
        };

        RelatedObjectProxy.prototype.isFault = function () {
            if (this._id) {
                return !this.relatedObject;
            }
            return false; // If no object is related then implicitly this is not a fault.
        };

        return RelatedObjectProxy;
    })

    .factory('Relationship', function (RestError, RelatedObjectProxy) {
        function Relationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new Relationship(name, reverseName, mapping, reverseMapping);
            }
            this.mapping = mapping;
            this.name = name;
            this.reverseName = reverseName;
            this.reverseMapping = reverseMapping;
        }

        Relationship.prototype.getRelated = function (obj, callback) {
            throw Error('Relationship.getRelated must be overridden');
        };
        Relationship.prototype.contributeToRestObject = function (obj) {
            if (obj.mapping === this.mapping) {
                obj[this.name] = new RelatedObjectProxy(this, obj);
            }
            else if (obj.mapping == this.reverseMapping) {
                obj[this.reverseName] = new RelatedObjectProxy(this, obj);
            }
            else {
                throw new RestError('Cannot contribute to object as this relationship has neither a forward or reverse mapping that matches', {relationship: this, obj: obj});
            }
        };
        return Relationship;
    })

    .factory('ManyToManyRelationship', function (Relationship, Store, jlog) {

        var $log = jlog.loggerWithName('ManyToManyRelationship');

        function ManyToManyRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new ManyToManyRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }

        ManyToManyRelationship.prototype = Object.create(Relationship.prototype);

        ManyToManyRelationship.prototype.getRelated = function (obj, callback) {

            var self = this;
            var storeQueries;
            if (obj[this.name]) {
                storeQueries = _.map(obj[this.name], function (_id) {return {_id: _id}});
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + this.name.toString() + '"');
                return;
            }
            Store.getMultiple(storeQueries, function (errs) {
                if (errs) {
                    var allErrorsAre404 = true;
                    for (var i = 0; i < errs.length; i++) {
                        var err = errs[i];
                        if (err.status != 404) {
                            allErrorsAre404 = false;
                            break;
                        }
                    }
                    if (allErrorsAre404) {
                        $log.debug('Couldnt find using _id, therefore using as remote id');
                        // Attempt to use the identifier as a remote id and lookup that way instead.
                        storeQueries = _.map(obj[self.name], function (id) {
                            var storeQuery = {};
                            storeQuery[self.reverseMapping.id] = id;
                            storeQuery.mapping = self.reverseMapping;
                            return storeQuery;
                        });
                        Store.getMultiple(storeQueries, callback);
                    }
                    else {
                        if (callback) callback(errs);
                    }
                }
                else if (callback) {
                    callback();
                }
            });
        };

        return ManyToManyRelationship;
    })

    .factory('ForeignKeyRelationship', function (Relationship, Store, jlog) {
        var $log = jlog.loggerWithName('ForeignKeyRelationship');

        function ForeignKeyRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new ForeignKeyRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }

        ForeignKeyRelationship.prototype = Object.create(Relationship.prototype);

        ForeignKeyRelationship.prototype.getRelated = function (obj, callback) {
            var name;
            if (obj.mapping === this.mapping) {
                name = this.name;
            }
            else if (obj.mapping === this.reverseMapping) {
                name = this.reverseName;
            }
            var storeQuery = {};
            var proxy = obj[name];
            if (proxy) {
                storeQuery._id = proxy._id;
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + name.toString() + '"');
                return;
            }
            Store.get(storeQuery, function (err, obj) {
                if (err) {
                    if (callback) callback(err);
                }
                else if (callback) {
                    callback(null, obj);
                }
            });
        };

        return ForeignKeyRelationship;
    })

    .factory('OneToOneRelationship', function (Relationship, Store, jlog) {
        var $log = jlog.loggerWithName('OneToOneRelationship');

        function OneToOneRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new OneToOneRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }

        OneToOneRelationship.prototype = Object.create(Relationship.prototype);

        OneToOneRelationship.prototype.getRelated = function (obj, callback) {
            var name;
            if (obj.mapping === this.mapping) {
                name = this.name;
            }
            else if (obj.mapping === this.reverseMapping) {
                name = this.reverseName;
            }
            var storeQuery = {};
            var proxy = obj[name];
            if (proxy) {
                storeQuery._id = proxy._id;
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + name.toString() + '"');
                return;
            }
            Store.get(storeQuery, function (err) {
                if (err) {
                    if (callback) callback(err);
                }
                else if (callback) {
                    callback();
                }
            });
        };

        return OneToOneRelationship;
    })


;