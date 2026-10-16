window.gitDb = {};

window.addEventListener("message", (event) => {
  // 1. ALWAYS verify the origin of the sender for security
  //if (event.origin !== "https://your-iframe-domain.com") {
  //  return; 
  //}

  // 2. Access and handle the data sent by the iframe
  console.log("Message received from iframe (" + event.origin + "):", event.data);
  console.log("Message type = " + event.data.action);
  
  if (event.data.action == "INVENTORY_POST") {
    console.log("Movie inventory size = " + event.data.movieInventory.length);
    window.gitDb.dbFromAppScript = event.data;
    openMediaDatabase(saveInventoryToIndexedDb);
  }
  if (event.data.action == "INVENTORY_REQUEST") {
    console.log("Recieved request for stored inventory.");
    window.gitDb.inventoryRequestOrigin = event.origin;
    window.gitDb.inventoryRequestSource = event.source;
    getInventoryFromIndexedDb();
  }
  //if (event.data.status === "success") {
    // Execute parent page logic here
    event.source.postMessage("Message Recieved.", event.origin);
  //}
});

function onLoad() {
  window.moviedb = {};
  moviedb.DEBUG = {};
  moviedb.DEBUG.enableDbAlerts = true;
  initStorage();
}

function getInventoryFromIndexedDb() {
  console.log("Getting movie inventory from indexedDb...");
  readStringFromIndexedDB(gitDb.indexedDbRef, "moviesdb", "data")
    .then(value => gotMoviesString(value))
    .catch(error => {
      alert("Failed to read from IndexedDB:", error);
  });
}

function gotMoviesString(result) {
  console.log("Got movie inventory, getting tv inventory from indexedDb...");
  //alert("Got movies, getting Tv...");
    window.gitDb.inventory = JSON.parse(result);
    readStringFromIndexedDB(gitDb.indexedDbRef, "tvdb", "data").then(value => gotTvString(value));
    //displayDb();
    //readLocalDb("tvdb", gotTvString);
}

function gotTvString(result) {
    console.log("got tv inventory, getting filters from indexedDb...");
    window.gitDb.tvInv = JSON.parse(result);
    readStringFromIndexedDB(gitDb.indexedDbRef, "filters", "data").then(value => gotFilterString(value));
    //readLocalDb("filters", gotFilterString);
}

function gotFilterString(result) {
    console.log("got filters, sending data to App Script page...");
    window.gitDb.filters = JSON.parse(result);
    //moviedb.loadedFromLocalDb = true;
    //displayDb();
  const postData = {
    action: "INVENTORY_PAYLOAD",
    //lastModified: JSON.stringify(moviedb.libraryLastUpdated),
    lastModified: "",
    movieInventory: JSON.stringify(gitDb.inventory),
    tvInventory: JSON.stringify(gitDb.tvInv),
    filters: JSON.stringify(gitDb.filters),
    custom1: "",
    appVersion: ""
  };
    window.gitDB.inventoryRequestSource.postMessage(postData, window.gitDb.inventoryRequestOrigin);
}

function saveInventoryToIndexedDb() {
    writeStringToIndexedDB(gitDb.indexedDbRef, "moviesdb", "data", gitDb.dbFromAppScript.movieInventory);
    writeStringToIndexedDB(gitDb.indexedDbRef, "tvdb", "data", gitDb.dbFromAppScript.tvInventory);
    writeStringToIndexedDB(gitDb.indexedDbRef, "filters", "data", gitDb.dbFromAppScript.filters);
    //writeStringToIndexedDB(gitDb.indexedDbRef, "lastUpdated", "data", JSON.stringify(moviedb.libraryLastUpdated));
    writeStringToIndexedDB(gitDb.indexedDbRef, "lastUpdated", "data", gitDb.dbFromAppScript.lastModified);
    console.log("Wrote dbs to Indexeddb.");
}

function readStringFromIndexedDB(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);

    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result); // Returns the stored value, or undefined if not found
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
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
        const request = indexedDB.open("gitMediaDB", 2);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;

            // Create object stores if they don't already exist
            if (!db.objectStoreNames.contains("moviesdb")) db.createObjectStore("moviesdb");
            if (!db.objectStoreNames.contains("tvdb")) db.createObjectStore("tvdb");
            if (!db.objectStoreNames.contains("filters")) db.createObjectStore("filters");
            if (!db.objectStoreNames.contains("lastUpdated")) db.createObjectStore("lastUpdated");
            if (!db.objectStoreNames.contains("appVersion")) db.createObjectStore("appVersion");
            if (!db.objectStoreNames.contains("custom1")) db.createObjectStore("custom1");
            if (!db.objectStoreNames.contains("custom2")) db.createObjectStore("custom2");
            if (!db.objectStoreNames.contains("custom3")) db.createObjectStore("custom3");
            if (!db.objectStoreNames.contains("custom4")) db.createObjectStore("custom4");
            if (!db.objectStoreNames.contains("custom5")) db.createObjectStore("custom5");
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

async function initStorage() {
  try {
    let isPersisted = await checkPersistence();
    
    if (isPersisted) {
      if (moviedb.DEBUG.enableDbAlerts) alert("💾 Storage is already persistent. Your IndexedDB is safe!");
      console.log("💾 Storage is already persistent. Your IndexedDB is safe!");
    } else {
      if (moviedb.DEBUG.enableDbAlerts) alert("ℹ️ Storage is best-effort. Requesting persistence...");
      console.log("ℹ️ Storage is best-effort. Requesting persistence...");
      isPersisted = await requestPersistence();
      
      if (isPersisted) {
        if (moviedb.DEBUG.enableDbAlerts) alert("✅ Persistence GRANTED. Your data won't be deleted automatically.");
        console.log("✅ Persistence GRANTED. Your data won't be deleted automatically.");
      } else {
        if (moviedb.DEBUG.enableDbAlerts) alert("⚠️ Persistence DENIED. The browser may delete data under storage pressure.");
        console.log("⚠️ Persistence DENIED. The browser may delete data under storage pressure.");
      }
    }
  } catch (error) {
    if (moviedb.DEBUG.enableDbAlerts) alert("Error managing storage persistence:", error);
    console.log("Error managing storage persistence:", error);
  }
}

// Check if storage is already persistent
async function checkPersistence() {
  if (navigator.storage && navigator.storage.persisted) {
    const isPersisted = await navigator.storage.persisted();
    console.log(`Is persistent: ${isPersisted}`);
    return isPersisted;
  }
  return false;
}

// Request persistent storage
async function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    console.log(`Persistence granted: ${granted}`);
    return granted;
  }
  return false;
}
