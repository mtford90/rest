describe('store', function () {

    var RestAPI, cache, RestObject, Mapping, Store, Pouch;

    var mapping, api;

    beforeEach(function (done) {
        module('restkit.store', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _cache_, _RestObject_, _Store_, _Mapping_, _Pouch_) {
            RestAPI = _RestAPI_;
            cache = _cache_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
            Store = _Store_;
            Pouch = _Pouch_;
        });
        RestAPI._reset();
        api = new RestAPI('myApi', function (err, version) {
            if (err) done(err);
            mapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
        }, function () {
            done();
        });
    });

    it('already cached', function (done) {
        var restObject = new RestObject(mapping);
        var pouchId = 'pouchId';
        restObject._id = pouchId;
        cache.insert(restObject);
        Store.get({_id: pouchId}, function (err, doc) {
            if (err)done(err);
            console.log('doc:', doc);
            assert.equal(doc, restObject);
            done();
        });
    });

    it('in pouch, have _id', function (done) {
        var pouchid = 'pouchId';
        Pouch.getPouch().put({type: 'Car', api: 'myApi', colour: 'red', _id: pouchid}, function (err, doc) {
            if (err) done(err);
            Store.get({_id: pouchid}, function (err, doc) {
                if (err)done(err);
                console.log('doc:', doc);
                done();
            });
        });
    });

    it('in pouch, dont have _id', function (done) {
        var pouchid = 'pouchId';
        var remoteId = 'xyz';
        Pouch.getPouch().put({type: 'Car', api: 'myApi', colour: 'red', _id: pouchid, id: remoteId}, function (err, doc) {
            if (err) done(err);
            Store.get({id: remoteId, mapping: mapping}, function (err, doc) {
                if (err) done(err);
                console.log('doc:', doc);
                done();
            });
        });
    });

    describe('multiple', function () {
        it('xyz', function (done) {
            Pouch.getPouch().bulkDocs(
                [
                    {type: 'Car', api: 'myApi', colour: 'red', _id: 'localId1', id: 'remoteId1'},
                    {type: 'Car', api: 'myApi', colour: 'blue', _id: 'localId2', id: 'remoteId2'},
                    {type: 'Car', api: 'myApi', colour: 'green', _id: 'localId3', id: 'remoteId3'}
                ],
                function (err) {
                    if (err) done(err);
                    Store.getMultiple([
                        {_id: 'localId1'},
                        {_id: 'localId2'},
                        {_id: 'localId3'}
                    ], function (err, docs) {
                        if (err) done(err);
                        console.log('docs:', docs);
                        _.each(docs, function (d) {
                            assert.instanceOf(d, RestObject);
                        });
                        done();
                    })
                }
            );
        })
    });

});