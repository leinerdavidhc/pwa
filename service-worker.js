const CACHE_NAME = 'persona-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './images/icons/icon-72x72.png',
    './images/icons/icon-96x96.png',
    './images/icons/icon-128x128.png',
    './images/icons/icon-144x144.png',
    './images/icons/icon-152x152.png',
    './images/icons/icon-192x192.png',
    './images/icons/icon-384x384.png',
    './images/icons/icon-512x512.png'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(urlsToCache))
    );
});

// Recuperar recursos desde el caché
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
});

// Manejar sincronización en background
self.addEventListener('sync', event => {
    if (event.tag === 'sync-personas') {
        event.waitUntil(syncPersonas());
    }
});

async function syncPersonas() {
    const db = await openDatabase();
    const transaction = db.transaction(['personas'], 'readonly');
    const store = transaction.objectStore('personas');
    const personas = await store.getAll();

    if (personas.length > 0) {
        // Enviar todos los registros al servidor
        const syncPromises = personas.map(persona =>
            fetch('http://158.247.124.44:4000/api/persona/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(persona)
            })
            .then(response => response.json())
            .then(data => {
                console.log('Persona sincronizada:', data);
                return data; // Devolver el resultado para manejar después
            })
            .catch(error => {
                console.error('Error al sincronizar:', error);
                return null; // Devolver null en caso de error
            })
        );

        const results = await Promise.all(syncPromises);

        // Limpiar la base de datos solo si todas las solicitudes fueron exitosas
        const allSuccessful = results.every(result => result !== null);
        if (allSuccessful) {
            const clearTransaction = db.transaction(['personas'], 'readwrite');
            const clearStore = clearTransaction.objectStore('personas');
            clearStore.clear();
        }
    }
}

// Abrir la base de datos en IndexedDB
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('personaDB', 1);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('personas')) {
                db.createObjectStore('personas', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = event => {
            resolve(event.target.result);
        };

        request.onerror = event => {
            reject(event.target.error);
        };
    });
}
