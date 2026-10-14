window.gitDb = {};

window.addEventListener("message", (event) => {
  // 1. ALWAYS verify the origin of the sender for security
  //if (event.origin !== "https://your-iframe-domain.com") {
  //  return; 
  //}

  // 2. Access and handle the data sent by the iframe
  console.log("Message received from iframe (" + event.origin + "):", event.data);
  console.log("Message type = " + event.data.action);
  console.log("Movie inventory size = " + event.data.movieInventory.length);
  if (event.data.action == "INVENTORY_POST") {
    window.gitDb.dbFromAppScript = event.data;
    openMediaDatabase(saveInventoryToIndexedDb);
  }
  //if (event.data.status === "success") {
    // Execute parent page logic here
    event.source.postMessage("Message Recieved.", event.origin);
  //}
});


function saveInventoryToIndexedDb() {
    writeStringToIndexedDB(gitDb.indexedDbRef, "moviesdb", "data", gitDb.dbFromAppScript.movieInventory);
    writeStringToIndexedDB(gitDb.indexedDbRef, "tvdb", "data", gitDb.dbFromAppScript.tvInventory);
    writeStringToIndexedDB(gitDb.indexedDbRef, "filters", "data", gitDb.dbFromAppScript.filters);
    //writeStringToIndexedDB(gitDb.indexedDbRef, "lastUpdated", "data", JSON.stringify(moviedb.libraryLastUpdated));
    writeStringToIndexedDB(gitDb.indexedDbRef, "lastUpdated", "data", gitDb.dbFromAppScript.lastModified);
    console.log("Wrote dbs to Indexeddb.");
}

function writeStringToIndexedDB(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    const request = store.put(value, key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openMediaDatabase(callbackFunc) {
    console.log("in openMediaDatabase");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("gitMediaDB", 1);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;

            // Create object stores if they don't already exist
            if (!db.objectStoreNames.contains("moviesdb")) db.createObjectStore("moviesdb");
            if (!db.objectStoreNames.contains("tvdb")) db.createObjectStore("tvdb");
            if (!db.objectStoreNames.contains("filters")) db.createObjectStore("filters");
            if (!db.objectStoreNames.contains("lastUpdated")) db.createObjectStore("lastUpdated");
            if (!db.objectStoreNames.contains("appVersion")) db.createObjectStore("appVersion");
            if (!db.objectStoreNames.contains("custom1")) db.createObjectStore("custom1");
            if (!db.objectStoreNames.contains("custom1")) db.createObjectStore("custom2");
            if (!db.objectStoreNames.contains("custom1")) db.createObjectStore("custom3");
            if (!db.objectStoreNames.contains("custom1")) db.createObjectStore("custom4");
            if (!db.objectStoreNames.contains("custom1")) db.createObjectStore("custom5");
        };

        request.onsuccess = function (event) {
            console.log("openMediaDatabase onSuccess");
            window.gitDb.indexedDbRef = event.target.result;
            resolve(event.target.result);
            callbackFunc();
        };

        request.onerror = function (event) {
            console.log("openMediaDatabase onError");
            reject("IndexedDB error: " + event.target.error);
        };
    });
}
