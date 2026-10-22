window.gitDb = {};

window.addEventListener("message", (event) => {
  // 1. ALWAYS verify the origin of the sender for security
  //if (event.origin !== "https://your-iframe-domain.com") {
  //  return; 
  //}

  if (event == null) {
    console.log("Message from iFrame recieved. Event data is null or undefined. Ignoring.");
    return;
  }

  if (event.origin == null) {
    console.log("Message from iFrame recieved. Event origin is missing. Ignoring.");
    return;
  }
  if (event.source == null) {
    console.log("Message from iFrame recieved. Event source is missing. Ignoring.");
    return;
  }
  if (event.data == null) {
    console.log("Message from iFrame recieved. Event data is missing. Ignoring.");
    return;
  }
  if (typeof event.data != "object") {
    console.log("Message from iFrame recieved. Event data did not pass type check. Ignoring.");
    return;
  }
  var eventDataString = "";
  try {
    var eventDataString = event.data.toString();
  }
  catch (err) {
    var eventDataString = "[Failed to convert to string: " + err.message + "]";
  }
  var eventDataAction = "";
  try {
    if (typeof event.data.action != "string") {
      eventDataAction = "ACTION_MISSING: Type Check Failure";
    }
    else {
      eventDataAction = event.data.action;
    }
  }
  catch (err) {
    eventDataAction = "ACTION_FAULT: " + err.message;
  }
  
  console.log("Message received from iframe: ACTION=" + eventDataAction + ", ORIGIN=" + event.origin + ", DATA=", event.data);
  
  if (event.data.action == "INVENTORY_POST") {
    console.log("Recieved INVENTORY_POST data.");
    // Validate data.
    if (typeof event.data.movieInventory != "string") {
      console.log("Movie inventory did not pass typecheck, expected string, recieved " + typeof event.data.movieInventory + ".");
      return;
    }
    console.log("Movie inventory size = " + event.data.movieInventory.length);
    window.gitDb.dbFromAppScript = event.data;
    openMediaDatabase(saveInventoryToIndexedDb);
  }
  if (event.data.action == "INVENTORY_REQUEST") {
    console.log("Recieved request for stored inventory.");
    if (typeof event.origin != "string") {
      console.log("Error in INVENTORY_REQUEST handler: Event origin did not pass type check, type is " + typeof event.origin + ".");
      return;
    }
    if (typeof event.source != "object") {
      console.log("Error in INVENTORY_REQUEST handler: Event source did not pass type check, type is " + typeof event.source + ".");
      return;
    }
    window.gitDb.inventoryRequestOrigin = event.origin;
    window.gitDb.inventoryRequestSource = event.source;
    openMediaDatabase(getInventoryFromIndexedDb);
  }
});

function onLoad() {
  window.moviedb = {};
  moviedb.DEBUG = {};
  moviedb.DEBUG.enableDbAlerts = false;
  initStorage();
}

function getInventoryFromIndexedDb() {
  console.log("Getting movie inventory from indexedDb...");
  readStringFromIndexedDB(gitDb.indexedDbRef, "moviesdb", "data")
    .then(value => gotMoviesString(value))
    .catch(error => {
      indexedDbReadFailure();
      console.log("Failed to read from IndexedDB: ", error);
  });
}

function gotMoviesString(result) {
  console.log("Got movie inventory, getting tv inventory from indexedDb...");
    window.gitDb.inventory = JSON.parse(result);
    readStringFromIndexedDB(gitDb.indexedDbRef, "tvdb", "data").then(value => gotTvString(value));
}

function gotTvString(result) {
    console.log("got tv inventory, getting filters from indexedDb...");
    window.gitDb.tvInv = JSON.parse(result);
    readStringFromIndexedDB(gitDb.indexedDbRef, "filters", "data").then(value => gotFilterString(value));
}

function gotFilterString(result) {
    console.log("got filters, sending data to App Script page...");
    window.gitDb.filters = JSON.parse(result);
    //moviedb.loadedFromLocalDb = true;
    const postData = {
      action: "INVENTORY_PAYLOAD",
      success: true,
      //lastModified: JSON.stringify(moviedb.libraryLastUpdated),
      lastModified: "",
      movieInventory: JSON.stringify(gitDb.inventory),
      tvInventory: JSON.stringify(gitDb.tvInv),
      filters: JSON.stringify(gitDb.filters),
      custom1: "",
      appVersion: ""
    };
    try {
      window.gitDb.inventoryRequestSource.postMessage(postData, window.gitDb.inventoryRequestOrigin);
    }
    catch (err) {
      console.log("Exception sending post message with inventory data from Git page: " + err.message);
    }
}

function indexedDbReadFailure() {
    const postData = {
      action: "INVENTORY_PAYLOAD",
      success: false
    };
    try {
      window.gitDb.inventoryRequestSource.postMessage(postData, window.gitDb.inventoryRequestOrigin);
    }
    catch (err) {
      console.log("Exception sending post message with inventory failure signal from Git page: " + err.message);
    }
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
    var version = 2;
    console.log("Opening Indexeddb 'gitMediaDB'...");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("gitMediaDB", version);

        request.onupgradeneeded = function (event) {
            console.log("Indexeddb 'gitMedidDB' requires upgrade to version " + version + ".");
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
            console.log("Indexeddb 'gitMedidDB' successfully opened.");
            window.gitDb.indexedDbRef = event.target.result;
            resolve(event.target.result);
            callbackFunc();
        };

        request.onerror = function (event) {
            console.log("Indexeddb 'gitMedidDB' failed to open.");
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
