/**
 * Random tests for bugs that crop up.
 *
 * TODO: All tests within this file need to be sorted and moved into appropriate specs.
 */

var assert = require('chai').assert;

describe('bugs', function () {
    beforeEach(function (done) {
        siesta.reset(done);
    });


    describe('no name specified when creating mapping', function () {
        it('No obj', function (done) {
            var Collection = siesta.collection('Collection'),
                Model = Collection.model('Model');
            siesta.install(done);
        });

        it('obj', function (done) {
            var Collection = siesta.collection('Collection'),
                Model = Collection.model('Model', {});
            siesta.install(done);
        });

    });


    describe('ensure that mapping relationships using various methods works', function () {
        describe('ModelInstance', function () {
            describe('OneToOne', function () {
                it('forward', function (done) {
                    var Collection = siesta.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owner: {
                                    model: 'Person',
                                    type: 'OneToOne',
                                    reverse: 'car'
                                }
                            }
                        });

                    Person.graph({name: 'Michael', id: 1})
                        .then(function (person) {
                            Car.graph({name: 'car', owner: person})
                                .then(function (car) {
                                    assert.equal(car.owner, person);
                                    done();
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
                it('reverse', function (done) {
                    var Collection = siesta.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owner: {
                                    model: 'Person',
                                    type: 'OneToOne',
                                    reverse: 'car'
                                }
                            }
                        });

                    Car.graph({name: 'car'})
                        .then(function (car) {
                            Person.graph({name: 'Michael', id: 1, car: car})
                                .then(function (person) {
                                    assert.equal(person.car, car);
                                })
                                .catch(done);
                            done();
                        })
                        .catch(done);

                });
            });
            describe('OneToMany', function () {
                it('forward', function (done) {
                    var Collection = siesta.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owner: {
                                    model: 'Person',
                                    type: 'OneToMany',
                                    reverse: 'cars'
                                }
                            }
                        });
                    Person.graph({name: 'Michael', id: 1})
                        .then(function (person) {
                            Car.graph({name: 'car', owner: person})
                                .then(function (car) {
                                    assert.equal(car.owner, person);
                                    done();
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
                it('reverse', function (done) {
                    var Collection = siesta.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owner: {
                                    model: 'Person',
                                    type: 'OneToMany',
                                    reverse: 'cars'
                                }
                            }
                        });

                    Car.graph([{name: 'car'}, {name: 'anotherCar'}])
                        .then(function (cars) {
                            Person.graph({name: 'Michael', id: 1, cars: cars})
                                .then(function (person) {
                                    assert.include(person.cars, cars[0]);
                                    assert.include(person.cars, cars[1]);
                                    done();
                                })
                                .catch(done);
                        })
                        .catch(done);

                });
            });
            describe('ManyToMany', function () {
                it('forward', function (done) {
                    var Collection = siesta.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owners: {
                                    model: 'Person',
                                    type: 'ManyToMany',
                                    reverse: 'cars'
                                }
                            }
                        });
                    Person.graph([{name: 'Michael', id: 1}])
                        .then(function (people) {
                            Car.graph({name: 'car', owners: people})
                                .then(function (car) {
                                    assert.include(car.owners, people[0]);
                                    done();
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
                it('reverse', function (done) {
                    var Collection = siesta.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owners: {
                                    model: 'Person',
                                    type: 'ManyToMany',
                                    reverse: 'cars'
                                }
                            }
                        });
                    Car.graph([{name: 'car'}, {name: 'anotherCar'}])
                        .then(function (cars) {
                            Person.graph({name: 'Michael', id: 1, cars: cars})
                                .then(function (person) {
                                    assert.include(person.cars, cars[0]);
                                    assert.include(person.cars, cars[1]);
                                    done();
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
            });
        });
    });
});