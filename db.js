/* ==========================================================================
   GESTOR DE BASE DE DATOS LOCAL INDEXEDDB PARA EXPEDIENTES DIGITALES
   C.E. ZAZARABICOA - ALMACENAMIENTO DE ALTA CAPACIDAD
   ========================================================================== */

const DB_NAME = 'ZazarabicoaExpedienteDB';
const DB_VERSION = 1;
const STORE_NAME = 'expedientes_documentos';

let dbInstance = null;

// Inicializar la base de datos IndexedDB
function getDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Almacén con clave compuesta: [recordId, docType]
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['recordId', 'docType'] });
        store.createIndex('recordId', 'recordId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Guardar o actualizar un documento en IndexedDB
async function dbSaveDocument(recordId, docType, docInfo) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      recordId: recordId,
      docType: docType,
      fileName: docInfo.fileName || 'documento',
      fileType: docInfo.fileType || 'application/octet-stream',
      fileSize: docInfo.fileSize || 0,
      fileSizeFormatted: docInfo.fileSizeFormatted || '',
      dataUrl: docInfo.dataUrl, // Base64 Data URL (imagen o PDF)
      uploadedAt: docInfo.uploadedAt || new Date().toISOString()
    };

    const request = store.put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Obtener un documento específico de un funcionario
async function dbGetDocument(recordId, docType) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get([recordId, docType]);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Obtener todos los documentos asociados a un funcionario
async function dbGetAllDocumentsForRecord(recordId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('recordId');
    const request = index.getAll(IDBKeyRange.only(recordId));
    
    request.onsuccess = () => {
      const docsMap = {};
      (request.result || []).forEach(doc => {
        docsMap[doc.docType] = doc;
      });
      resolve(docsMap);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

// Eliminar un documento específico
async function dbDeleteDocument(recordId, docType) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete([recordId, docType]);
    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Eliminar todos los documentos asociados a un funcionario
async function dbDeleteAllDocumentsForRecord(recordId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('recordId');
    const request = index.openCursor(IDBKeyRange.only(recordId));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve(true);
      }
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

// Formatear tamaño de archivo en bytes a KB o MB
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
