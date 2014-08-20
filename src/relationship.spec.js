describe('relationship', function () {

    var RestAPI, Mapping, ForeignKeyRelationship, RestObject, cache, OneToOneRelationship,ManyToManyRelationship;

    beforeEach(function () {
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _Mapping_, _ForeignKeyRelationship_, _OneToOneRelationship_, _RestObject_, _cache_, _ManyToManyRelationship_) {
            RestAPI = _RestAPI_;
            Mapping = _Mapping_;
            ForeignKeyRelationship = _ForeignKeyRelationship_;
            OneToOneRelationship = _OneToOneRelationship_;
            ManyToManyRelationship = _ManyToManyRelationship_;
            RestObject = _RestObject_;
            cache = _cache_;
        });

        RestAPI._reset();
    });

    describe('ForeignKey', function () {
        var carMapping, personMapping;
        beforeEach(function (done) {
            carMapping = new Mapping({
                type: 'Car',
                id: 'id',
                attributes: ['colour', 'name'],
                api: 'myApi'
            });
            personMapping = new Mapping({
                type: 'Person',
                id: 'id',
                attributes: ['name', 'age'],
                api: 'myApi'
            });
            carMapping.install(function (err) {
                if (err) done(err);
                personMapping.install(done);
            });
        });

        it('local id', function (done) {
            var r = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var car = new RestObject(carMapping);
            car.owner = '4234sdfsdf';
            var person = new RestObject(personMapping);
            person._id = car.owner;
            cache.insert(person);
            r.getRelated(car, function (err, related) {
                done(err);
                assert.equal(person, related);
            });
        });

        it('remote id', function (done) {
            var r = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var car = new RestObject(carMapping);
            car.owner = '4234sdfsdf';
            var person = new RestObject(personMapping);
            person.id = car.owner;
            cache.insert(person);
            r.getRelated(car, function (err, related) {
                done(err);
                assert.equal(person, related);
            });
        });

    });

    describe('OneToOne', function () {
        var carMapping, personMapping;
        beforeEach(function (done) {
            carMapping = new Mapping({
                type: 'Car',
                id: 'id',
                attributes: ['colour', 'name'],
                api: 'myApi'
            });
            personMapping = new Mapping({
                type: 'Person',
                id: 'id',
                attributes: ['name', 'age'],
                api: 'myApi'
            });
            carMapping.install(function (err) {
                if (err) done(err);
                personMapping.install(done);
            });
        });

        it('local id', function (done) {
            var r = new OneToOneRelationship('owner', 'cars', carMapping, personMapping);
            var car = new RestObject(carMapping);
            car.owner = '4234sdfsdf';
            var person = new RestObject(personMapping);
            person._id = car.owner;
            cache.insert(person);
            r.getRelated(car, function (err, related) {
                done(err);
                assert.equal(person, related);
            });
        });

        it('remote id', function (done) {
            var r = new OneToOneRelationship('owner', 'cars', carMapping, personMapping);
            var car = new RestObject(carMapping);
            car.owner = '4234sdfsdf';
            var person = new RestObject(personMapping);
            person.id = car.owner;
            cache.insert(person);
            r.getRelated(car, function (err, related) {
                done(err);
                assert.equal(person, related);
            });
        });
    });

    describe('ManyToMany', function () {
        var carMapping, personMapping;
        beforeEach(function (done) {
            carMapping = new Mapping({
                type: 'Car',
                id: 'id',
                attributes: ['colour', 'name'],
                api: 'myApi'
            });
            personMapping = new Mapping({
                type: 'Person',
                id: 'id',
                attributes: ['name', 'age'],
                api: 'myApi'
            });
            carMapping.install(function (err) {
                if (err) done(err);
                personMapping.install(done);
            });
        });

        it('local id', function (done) {
            var r = new ManyToManyRelationship('owners', 'cars', carMapping, personMapping);
            var car = new RestObject(carMapping);
            car.owners = ['4234sdfsdf', '5245tdfd'];
            var person1 = new RestObject(personMapping);
            var person2 = new RestObject(personMapping);
            person1._id = car.owners[0];
            person2._id = car.owners[1];
            cache.insert(person1);
            cache.insert(person2);
            r.getRelated(car, function (err, related) {
                done(err);
                assert.include(related, person1);
                assert.include(related, person2);
            });
        });

        it('remote id', function (done) {
            var r = new ManyToManyRelationship('owners', 'cars', carMapping, personMapping);
            var car = new RestObject(carMapping);
            car.owners = ['4234sdfsdf', '5245tdfd'];
            var person1 = new RestObject(personMapping);
            var person2 = new RestObject(personMapping);
            person1.id = car.owners[0];
            person2.id = car.owners[1];
            cache.insert(person1);
            cache.insert(person2);
            r.getRelated(car, function (err, related) {
                done(err);
                assert.include(related, person1);
                assert.include(related, person2);
            });
        });
    });

});