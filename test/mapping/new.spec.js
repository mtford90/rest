/*
 These tests deal with the creation of new SiestaModel objects.
 */

var s = require('../../core/index'),
    assert = require('chai').assert;

describe('mapping new object', function () {
    var Collection = require('../../core/collection');
    var RelationshipType = require('../../core/RelationshipType');
    var OneToManyProxy = require('../../core/OneToManyProxy');
    var cache = require('../../core/cache');

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    describe('fields', function () {
        var collection, Car;

        beforeEach(function (done) {
            collection = s.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(done);
        });

        it('valid', function () {
            var car = Car._new();
            _.each(Car._attributeNames, function (f) {
                assert(car[f] !== undefined);
            });
        });

        describe('id field', function () {
            var car;
            beforeEach(function () {
                car = Car._new();
            });

            it('should be present', function () {
                assert.property(car, 'id');
            });

            describe('in cache', function () {
                beforeEach(function () {
                    cache.insert(car);
                    assert.equal(car, cache.get({_id: car._id}));
                    car.id = 'newRemoteId';
                });
                it('should update cache', function () {
                    assert.equal(car, cache.get({id: car.id, model: car.model}));
                });
                it('should remove previous', function () {
                    assert.equal(car, cache.get({id: car.id, model: car.model}));
                    car.id = 'brandNewRemoteId';
                    assert.equal(car, cache.get({id: car.id, model: car.model}));
                    assert.notOk(cache.get({id: 'newRemoteId', model: car.model}))
                });
                it('should remove all if set remoteid to null', function () {
                    assert.equal(car, cache.get({id: car.id, model: car.model}));
                    car.id = null;
                    assert.notOk(cache.get({id: 'newRemoteId', model: car.model}))
                })
            });
        });


    });

    describe('relationships', function () {
        var collection, carMapping, personMapping;

        function configureAPI(type, reverseName, done) {
            collection = s.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        model: 'Person',
                        type: type,
                        reverse: reverseName
                    }
                }
            });
            Person = collection.model('Person', {
                id: 'id',
                attributes: ['age', 'name']
            });
            s.install(done);
        }

        beforeEach(function (done) {
            configureAPI(RelationshipType.OneToMany, 'cars', done);
        });

        describe('installation of proxies', function () {

            it('installs forward related object proxy', function () {
                var carObject = Car._new();
                assert.instanceOf(carObject.__proxies['owner'], OneToManyProxy);
            });

            it('installs reverse related object proxy', function () {
                var personObject = Person._new();
                assert.instanceOf(personObject.__proxies['cars'], OneToManyProxy);
            });

        });

    });


});
