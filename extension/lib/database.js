var Db = function () {
    this.store;
};

Db.prototype.open = function (cb) {
    var self = this
        , request = window.indexedDB.open('cmnt', 2);
    request.onerror = function (event) {
        console.log(event.target.errorCode);
    };
    request.onsuccess = function (event) {
        self.store = request.result;
        if (cb) cb();
    };
    request.onupgradeneeded = function (event) {
        var db = event.target.result
            , objectStore = db.createObjectStore('notifications', { 
                keyPath:  'id'
                , autoIncrement: true
            });
    };
};

Db.prototype.insert = function (data, cb) {
    var self = this
        , transaction
        , objectStore
        , request;
    transaction = self.store.transaction(['notifications'], 'readwrite');
    objectStore = transaction.objectStore('notifications');
    request = objectStore.add(data);
    request.onsuccess = function (event) {
        cb(data);
    };
};

Db.prototype.readAll = function (store, cb) {
    var objectStore = this.store.transaction(store).objectStore(store)
        , items = [];
    objectStore.openCursor().onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
            items.push(cursor.value);
            cursor.continue();
        } else {
            cb(items);
        }
    };
};

Db.prototype.delete = function (store, id) {
    var request = this.store.transaction([store], 'readwrite')
                .objectStore(store)
                .delete(id);
    request.onsuccess = function(event) {};
};

window.cmntDb = new Db();