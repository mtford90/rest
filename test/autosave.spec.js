var assert = require('chai').assert;

describe('auto save', function () {
    var MyCollection, Person;
    before(function () {
        siesta.ext.storageEnabled = true;
    });

    afterEach(function () {
        siesta.autosave = false;
    });

    beforeEach(function (done) {
        siesta.reset(function () {
            MyCollection = siesta.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            done();
        });
    });

    it('autosaves on modelEvents if enabled', function (done) {
        siesta.autosave = true;
        siesta.once('saved', function () {
            siesta.ext.storage._pouch.allDocs()
                .then(function (resp) {
                    assert.ok(resp.rows.length, 'Should be a row');
                    var person = resp.rows[0];
                    done();
                })
                .catch(done);
        });
        Person.map({name: 'Mike', age: 24})
            .catch(done)
            .done();
    });

    it('does not interval on modelEvents if disabled', function (done) {
        siesta.autosave = false;
        Person.map({name: 'Mike', age: 24})
            .then(function () {
                siesta.ext.storage._pouch.allDocs()
                    .then(function (resp) {
                        assert.notOk(resp.rows.length, 'Should be no rows');
                        done();
                    })
                    .catch(done);
            })
            .catch(done)
            .done();
    });
});