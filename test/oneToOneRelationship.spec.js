var s = require('../core/index'),
    assert = require('chai').assert;

describe('one to one relationship proxy', function () {

    before(function () {
        s.ext.storageEnabled = false;
    });

    var RelationshipProxy = require('../core/RelationshipProxy'),
        OneToOneProxy = require('../core/OneToOneProxy'),
        OneToManyProxy = require('../core/OneToManyProxy'),
        SiestaModel = require('../core/modelInstance'),
        cache = require('../core/cache');

    var MyCollection, Car, Person;
    var carProxy, personProxy;
    var car, person;

    beforeEach(function (done) {
        s.reset(function () {
            MyCollection = s.collection('MyCollection');
            Car = MyCollection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            done();
        });
    });

    describe('get', function () {
        beforeEach(function () {
            carProxy = new OneToOneProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owner',
                isReverse: false
            });
            personProxy = new OneToOneProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owner',
                isReverse: true
            });
            car = new SiestaModel(Car);
            car._id = 'car';
            carProxy.install(car);
            person = new SiestaModel(Person);
            person._id = 'person';
            personProxy.install(person);
            cache.insert(person);
            cache.insert(car);
        });

        it('forward', function (done) {
            carProxy.related = person;
            carProxy.get(function (err, obj) {
                if (err) done(err);
                assert.equal(person, obj);
                done();
            });
        });

        it('reverse', function (done) {
            personProxy.related = car;
            personProxy.get(function (err, obj) {
                if (err) done(err);
                assert.equal(car, obj);
                assert.equal(personProxy.related, car);
                done();
            });
        });
    });

    describe('set', function () {
        var carProxy, personProxy;
        var car, person;
        beforeEach(function () {
            carProxy = new OneToOneProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owner',
                isReverse: false
            });
            personProxy = new OneToOneProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owner',
                isReverse: true
            });
            car = new SiestaModel(Car);
            car._id = 'car';
            carProxy.install(car);
            person = new SiestaModel(Person);
            person._id = 'person';
            personProxy.install(person);
        });

        describe('none pre-existing', function () {
            describe('forward', function () {
                it('should set forward', function () {
                    car.owner = person;
                    assert.equal(car.owner, person);
                    assert.equal(carProxy.related, person);
                });

                it('should set reverse', function () {
                    car.owner = person;
                    assert.equal(person.cars, car);
                    assert.equal(personProxy.related, car);
                });
            });

            describe('backwards', function () {
                it('should set forward', function () {
                    person.cars = car;
                    assert.equal(person.cars, car);
                    assert.equal(personProxy.related, car);

                });

                it('should set reverse', function () {
                    person.cars = car;
                    assert.equal(car.owner, person);
                    assert.equal(carProxy.related, person);
                });
            });


        });

        describe('pre-existing', function () {

            var anotherPerson, anotherPersonProxy;

            beforeEach(function () {
                anotherPerson = new SiestaModel(Person);
                anotherPerson._id = 'anotherPerson';
                anotherPersonProxy = new OneToOneProxy({
                    reverseModel: Person,
                    forwardModel: Car,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isReverse: true
                });
                anotherPersonProxy.install(anotherPerson);
                cache.insert(anotherPerson);
                cache.insert(person);
                cache.insert(car);
            });


            describe('no fault', function () {
                beforeEach(function () {
                    car.owner = anotherPerson;
                });
                describe('forward', function () {
                    it('should set forward', function () {
                        car.owner = person;
                        assert.equal(car.owner, person);
                        assert.equal(carProxy.related, person);
                    });

                    it('should set reverse', function () {
                        car.owner = person;
                        assert.equal(person.cars, car);
                        assert.equal(personProxy.related, car);
                    });

                    it('should clear the old', function () {
                        car.owner = person;
                        assert.notOk(anotherPersonProxy._id);
                        assert.notOk(anotherPersonProxy.related);
                    });
                });
                describe('backwards', function () {
                    it('should set forward', function () {
                        person.cars = car;
                        assert.equal(person.cars, car);
                        assert.equal(personProxy.related, car);

                    });

                    it('should set reverse', function () {
                        person.cars = car;
                        assert.equal(car.owner, person);
                        assert.equal(carProxy.related, person);
                    });

                    it('should clear the old', function () {
                        person.cars = car;
                        assert.notOk(anotherPersonProxy._id);
                        assert.notOk(anotherPersonProxy.related);
                    });

                });
            });


        });
    });

    describe('removal', function () {
        beforeEach(function () {
            carProxy = new OneToOneProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'car',
                forwardName: 'owner',
                isReverse: false
            });
            personProxy = new OneToOneProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'car',
                forwardName: 'owner',
                isReverse: true
            });
            car = new SiestaModel(Car);
            car._id = 'car';
            carProxy.install(car);
            person = new SiestaModel(Person);
            person._id = 'person';
            personProxy.install(person);
            cache.insert(car);
            cache.insert(person);
        });

        it('removal', function (done) {
            car.owner = person;
            person.remove().then(function () {
                assert.notOk(car.owner);
                done();
            }).catch(done);
        });

        it('reverse removal', function (done) {
            person.car = car;
            car.remove().then(function () {
                assert.notOk(person.car);
                done();
            }).catch(done);
        });

    });


});