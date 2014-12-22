if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

if (typeof PouchDB == 'undefined') {
    throw new Error('Could not find PouchDB. Have you included the script?');
}

var unsavedChanges = [],
    pouch = new PouchDB('siesta');

/**
 * Collate the unsaved changes of same models into objects representing all changes that must be
 * applied to PouchDB.
 * @private
 */
function _collate() {

}

/**
 * Serialise a model down to PouchDB.
 * @param {SiestaModel} model
 */
function _serialise(model) {
    var serialised = siesta.extend({}, model.__values);
    serialised['collection'] = model.collection;
    serialised['model'] = model.type;
    serialised['_id'] = model._id;
    return serialised;
}

/**
 * Load all data from PouchDB.
 */
function _load(collectionName) {

}

/**
 * Save all changes down to PouchDB.
 */
function save() {

}

siesta.on('Siesta', function (n) {
    console.log('storage module received change');
    unsavedChanges.push(n);
});

var storage = {
    _load: _load,
    save: save,
    _collate: _collate,
    _serialise: _serialise
};

Object.defineProperty(storage, '_unsavedChanges', {
    get: function () {return unsavedChanges}
});

Object.defineProperty(storage, '_pouch', {
    get: function () {return pouch}
});

if (typeof siesta != 'undefined') {
    if (!siesta.ext) {
        siesta.ext = {};
    }
    siesta.ext.storage = storage;
}

if (typeof module != 'undefined') {
    module.exports = storage;
}