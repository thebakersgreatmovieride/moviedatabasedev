window.gitDb = {};
gitDb.logs = [];

window.addEventListener("message", (event) => {
  // TODO: See if security check can be implemented here.
  //if (event.origin != "https://iframe-domain.com") {
  //  return; 
  //}

  if (event == null) {
    log("Message from iFrame recieved. Event data is null or undefined. Ignoring.");
    return;
  }

  if (event.origin == null) {
    log("Message from iFrame recieved. Event origin is missing. Ignoring.");
    return;
  }
  if (event.source == null) {
    log("Message from iFrame recieved. Event source is missing. Ignoring.");
    return;
  }
  if (event.data == null) {
    log("Message from iFrame recieved. Event data is missing. Ignoring.");
    return;
  }
  if (typeof event.data != "object") {
    log(" Message from iFrame recieved. Event data did not pass type check. Ignoring.");
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

  if (event.data.action != "APP_SCRIPT_LOG") {
    log("Message received from iframe: ACTION=" + eventDataAction + ", ORIGIN=" + event.origin + ", DATA=", event.data);
  }
  
  if (event.data.action == "INVENTORY_POST") {
    log("Recieved INVENTORY_POST data.");
    // Validate data.
    if (typeof event.data.movieInventory != "string") {
      log("Movie inventory did not pass typecheck, expected string, recieved " + typeof event.data.movieInventory + ".");
      return;
    }
    log("Movie inventory size = " + event.data.movieInventory.length);
    window.gitDb.dbFromAppScript = event.data;
    openMediaDatabase(saveInventoryToIndexedDb);
  }
  if (event.data.action == "INVENTORY_REQUEST") {
    log("Recieved request for stored inventory.");
    if (typeof event.origin != "string") {
      log("Error in INVENTORY_REQUEST handler: Event origin did not pass type check, type is " + typeof event.origin + ".");
      return;
    }
    if (typeof event.source != "object") {
      log("Error in INVENTORY_REQUEST handler: Event source did not pass type check, type is " + typeof event.source + ".");
      return;
    }
    window.gitDb.inventoryRequestOrigin = event.origin;
    window.gitDb.inventoryRequestSource = event.source;
    openMediaDatabase(getInventoryFromIndexedDb);
  }
  if (event.data.action == "APP_SCRIPT_LOG") {
    if (typeof event.data.message != "string") return;
    const logEntry = { message: event.data.message, timeStampe: Date.now(), source: "APP" };
    gitDb.logs.push(logEntry);
  }
  if (event.data.action == "REQUEST_REFRESH") {
    log("Hard refresh requested...");
    hardRefresh();
  }
});

function onLoad() {
  gitDb.DEBUG = {};
  gitDb.DEBUG.enableDbAlerts = false;
  initStorage();
}

function hardRefresh() {
      // Get the current URL structure
    const url = new URL(window.location.href);
    
    // Set or overwrite a unique 't' parameter with the current timestamp
    url.searchParams.set('t', new Date().getTime());
    
    // Redirect the browser to the new cache-busted URL
    window.location.href = url.toString();
}

function getInventoryFromIndexedDb() {
  log("Getting movie inventory from indexedDb...");
  readStringFromIndexedDB(gitDb.indexedDbRef, "moviesdb", "data")
    .then(value => gotMoviesString(value))
    .catch(error => {
      indexedDbReadFailure();
      log("Failed to read from IndexedDB: ", error);
  });
}

function gotMoviesString(result) {
    log("Got movie inventory, getting tv inventory from indexedDb...");
    window.gitDb.inventory = result;
    readStringFromIndexedDB(gitDb.indexedDbRef, "tvdb", "data").then(value => gotTvString(value));
}

function gotTvString(result) {
    log("Got tv inventory, getting filters from indexedDb...");
    window.gitDb.tvInv = result;
    readStringFromIndexedDB(gitDb.indexedDbRef, "filters", "data").then(value => gotFilterString(value));
}

function gotFilterString(result) {
    log("Got filters, sending data to App Script page...");
    window.gitDb.filters = result;
    //moviedb.loadedFromLocalDb = true;
    var typeChecks = true;
    if (typeof gitDb.inventory != "string") {
      log("Movie inventory value from Indexeddb did not pass type check. Type was " + typeof gitDb.inventory + ", expected string.");
      typeChecks = false;
    }
    if (typeof gitDb.tvInv != "string") {
      log("TV inventory value from Indexeddb did not pass type check. Type was " + typeof gitDb.tvInv + ", expected string.");
      typeChecks = false;
    }
  if (typeof gitDb.filters != "string") {
      log("Filters value from Indexeddb did not pass type check. Type was " + typeof gitDb.filters + ", expected string.");
      typeChecks = false;
    }
    var postData;
    if (typeChecks) {
      postData = {
        action: "INVENTORY_PAYLOAD",
        success: true,
        //lastModified: JSON.stringify(moviedb.libraryLastUpdated),
        lastModified: "",
        movieInventory: gitDb.inventory,
        tvInventory: gitDb.tvInv,
        filters: gitDb.filters,
        custom1: "",
        appVersion: ""
      };
    }
    else {
      postData = {
        action: "INVENTORY_PAYLOAD",
        success: false,
        //lastModified: JSON.stringify(moviedb.libraryLastUpdated),
        lastModified: "",
        movieInventory: "",
        tvInventory: "",
        filters: "",
        custom1: "",
        appVersion: ""
      };
    }
    try {
      window.gitDb.inventoryRequestSource.postMessage(postData, window.gitDb.inventoryRequestOrigin);
    }
    catch (err) {
      log("Exception sending post message with inventory data from Git page: " + err.message);
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
      log("Exception sending post message with inventory failure signal from Git page: " + err.message);
    }
}

function saveInventoryToIndexedDb() {
    writeStringToIndexedDB(gitDb.indexedDbRef, "moviesdb", "data", gitDb.dbFromAppScript.movieInventory);
    writeStringToIndexedDB(gitDb.indexedDbRef, "tvdb", "data", gitDb.dbFromAppScript.tvInventory);
    writeStringToIndexedDB(gitDb.indexedDbRef, "filters", "data", gitDb.dbFromAppScript.filters);
    //writeStringToIndexedDB(gitDb.indexedDbRef, "lastUpdated", "data", JSON.stringify(moviedb.libraryLastUpdated));
    writeStringToIndexedDB(gitDb.indexedDbRef, "lastUpdated", "data", gitDb.dbFromAppScript.lastModified);
    log("Wrote dbs to Indexeddb.");
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
    log("Opening Indexeddb 'gitMediaDB'...");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("gitMediaDB", version);

        request.onupgradeneeded = function (event) {
            log("Indexeddb 'gitMedidDB' requires upgrade to version " + version + ".");
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
            log("Indexeddb 'gitMedidDB' successfully opened.");
            window.gitDb.indexedDbRef = event.target.result;
            resolve(event.target.result);
            callbackFunc();
        };

        request.onerror = function (event) {
            log("Indexeddb 'gitMedidDB' failed to open.");
            reject("IndexedDB error: " + event.target.error);
        };
    });
}

async function initStorage() {
  try {
    let isPersisted = await checkPersistence();
    
    if (isPersisted) {
      log("💾 Storage is already persistent. Your IndexedDB is safe!");
    } else {
      log(" ℹ️ Storage is best-effort. Requesting persistence...");
      isPersisted = await requestPersistence();
      
      if (isPersisted) {
        log("✅ Persistence GRANTED. Your data won't be deleted automatically.");
      } else {
        log("⚠️ Persistence DENIED. The browser may delete data under storage pressure.");
      }
    }
  } catch (error) {
    log("Error managing storage persistence:", error);
  }
}

// Check if storage is already persistent
async function checkPersistence() {
  if (navigator.storage && navigator.storage.persisted) {
    const isPersisted = await navigator.storage.persisted();
    log(`Is persistent: ${isPersisted}`);
    return isPersisted;
  }
  return false;
}

// Request persistent storage
async function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    log(`Persistence granted: ${granted}`);
    return granted;
  }
  return false;
}

function log(message) {
  if (typeof message != "string") return;
  message = "[GIT] " + message;
  console.log(message);
  if (gitDb.DEBUG.enableDbAlerts) alert(message);
  const logEntry = { message: message, timeStamp: Date.now(), source: "GIT" }; 
  gitDb.logs.push(logEntry);
}
