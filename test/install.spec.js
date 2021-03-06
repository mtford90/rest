/**
 * This spec tests that removal of the old siesta.install() step that was required before use has been removed correctly
 */

var assert = require('chai').assert,
  internal = siesta._internal,
  CollectionRegistry = internal.CollectionRegistry,
  RelationshipType = siesta.RelationshipType;

describe('install step', function () {
  var MyCollection, Person;

  beforeEach(function (done) {
    siesta.reset(done);
  });

  beforeEach(function () {
    MyCollection = siesta.collection('MyCollection');
    Person = MyCollection.model('Person', {
      id: 'id',
      attributes: ['name', 'age', 'index']
    });
  });

  it('map', function (done) {
    Person.graph({name: 'Mike', age: 24})
      .then(function () {
        done();
      })
      .catch(done);
  });

  it('query', function (done) {
    Person.query({age__gt: 23})
      .then(function (res) {
        assert.notOk(res.length, 'Should be no results');
        done();
      })
      .catch(done);
  });

  it('reactive query', function (done) {
    var rq = Person._reactiveQuery({age__lt: 30});
    rq.init()
      .then(function () {
        assert.notOk(rq.results.length);
        rq.terminate();
        done();
      })
      .catch(done);
  });


  describe('install relationships', function () {
    beforeEach(function (done) {
      siesta.reset(done);
    });

    var Collection, Car, Person;

    function configureAPI(type, done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name'],
        relationships: {
          owner: {
            model: 'Person',
            type: type,
            reverse: 'cars'
          }
        }
      });
      Person = Collection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
      siesta.install(done);
    }

    describe('valid', function () {
      describe('Foreign Key', function () {

        beforeEach(function (done) {
          configureAPI(RelationshipType.OneToMany, function (err) {
            if (err) done(err);
            done();
          });
        });

        it('configures reverse mapping', function () {
          assert.equal(Car.relationships.owner.reverseModel, Person);
        });

        it('configures reverse name', function () {
          assert.equal(Car.relationships.owner.reverseName, 'cars');

          it('configures forward mapping', function () {
            assert.equal(Car.relationships.owner.forwardModel, Car);
          });

        });
        it('configures forward name', function () {
          assert.equal(Car.relationships.owner.forwardName, 'owner');
        });

        it('installs on reverse', function () {
          var keys = Object.keys(Person.relationships.cars);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (key != 'isForward' && key != 'isReverse') {
              assert.equal(Person.relationships.cars[key], Car.relationships.owner[key]);
            }
          }
        });


      });

      describe('OneToOne', function () {

        beforeEach(function (done) {
          configureAPI(RelationshipType.OneToOne, function (err) {
            if (err) done(err);
            done();
          });


        });
        it('configures reverse mapping', function () {
          assert.equal(Car.relationships.owner.reverseModel, Person);
        });

        it('configures reverse name', function () {
          assert.equal(Car.relationships.owner.reverseName, 'cars');


        });

        it('configures forward mapping', function () {
          assert.equal(Car.relationships.owner.forwardModel, Car);
        });
        it('configures forward name', function () {
          assert.equal(Car.relationships.owner.forwardName, 'owner');
        });

        it('installs on reverse', function () {
          var keys = Object.keys(Person.relationships.cars);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (key != 'isForward' && key != 'isReverse') {
              assert.equal(Person.relationships.cars[key], Car.relationships.owner[key]);
            }
          }
        });
      });
    });

    describe('invalid', function () {
      it('No such relationship type', function (done) {
        var collection = siesta.collection('myCollection');
        collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              model: 'Person',
              type: 'invalidtype',
              reverse: 'cars'
            }
          }
        });
        collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });

        siesta.install(function (err) {
          assert.ok(err);
          done();
        });

      });
    });
  });
});

describe('add stuff after install', function () {

  beforeEach(function (done) {
    siesta.reset(done);
  });
  it('add collection', function (done) {
    var MyCollection = siesta.collection('MyCollection'),
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age', 'index']
      });
    siesta
      .install()
      .then(function () {
        var AnotherCollection = siesta.collection('AnotherCollection');
        assert.equal(siesta.AnotherCollection, AnotherCollection);
        assert.equal(CollectionRegistry.AnotherCollection, AnotherCollection);
        done();
      }).catch(done);
  });

  describe('add simple model', function () {
    var MyCollection, Car;
    beforeEach(function (done) {
      MyCollection = siesta.collection('MyCollection');
      siesta
        .install()
        .then(function () {
          Car = MyCollection.model('Car', {
            attributes: ['type']
          });
          done();
        })
        .catch(done);
    });

    it('is available on the collection', function () {
      assert.equal(MyCollection.Car, Car);
    });

    it('graph works', function (done) {
      Car.graph({type: 'red'})
        .then(function (car) {
          assert.ok(car);
          done();
        })
        .catch(done);
    });

  });


  describe('add model with relationship', function () {
    var MyCollection, Car, Person;

    afterEach(function () {
      MyCollection = null;
      Car = null;
      Person = null;
    });

    describe('delay creation of relationship', function () {
      beforeEach(function (done) {
        MyCollection = siesta.collection('MyCollection');
        Person = MyCollection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        siesta
          .install()
          .then(function () {
            Car = MyCollection.model('Car', {
              attributes: ['type'],
              relationships: {
                owner: {
                  model: 'Person',
                  reverse: 'cars'
                }
              }
            });
            done();
          })
          .catch(done);
      });

      it('is available on the collection', function () {
        assert.equal(MyCollection.Car, Car);
      });

      it('graph works', function (done) {
        Person.graph({name: 'mike', age: 21})
          .then(function (p) {
            Car.graph({type: 'red', owner: p})
              .then(function (car) {
                assert.ok(car);
                assert.equal(car.owner, p);
                assert.include(p.cars, car);
                done();
              })
              .catch(done);
          }).catch(done);

      });
    });

    describe('delay creation of related model', function () {
      beforeEach(function (done) {
        MyCollection = siesta.collection('MyCollection');
        Car = MyCollection.model('Car', {
          attributes: ['type'],
          relationships: {
            owner: {
              model: 'Person',
              reverse: 'cars'
            }
          }
        });
        siesta.install()
          .then(function () {
            Person = MyCollection.model('Person', {
              id: 'id',
              attributes: ['name', 'age']
            });
            done();
          }).catch(done);
      });

      it('is available on the collection', function () {
        assert.equal(MyCollection.Car, Car);
      });

      it('graph works', function (done) {
        Person.graph({name: 'mike', age: 21})
          .then(function (p) {
            Car.graph({type: 'red', owner: p})
              .then(function (car) {
                assert.ok(car);
                assert.equal(car.owner, p);
                assert.include(p.cars, car);
                done();
              })
              .catch(done);
          }).catch(done);
      });
    });

    it('should setup indexes');

  });


});