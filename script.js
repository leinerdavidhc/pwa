let db;

// Abre o crea la base de datos en IndexedDB
const request = indexedDB.open('personaDB', 1);

request.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('personas')) {
        db.createObjectStore('personas', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = event => {
    db = event.target.result;
    fetchPersonas(); // Cargar personas al iniciar la página
};

request.onerror = event => {
    console.error('Error al abrir IndexedDB:', event);
};

// Manejar el envío del formulario
document.getElementById('persona-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;

    const persona = { name, email, phone, address };

    if (navigator.onLine) {
        fetch('http://localhost:4000/api/persona', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(persona)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Persona creada:', data);
            fetchPersonas(); // Actualizar la tabla después de crear la persona
        })
        .catch(error => console.error('Error:', error));
    } else {
        const transaction = db.transaction(['personas'], 'readwrite');
        const store = transaction.objectStore('personas');
        store.add(persona);

        transaction.oncomplete = () => {
            console.log('Persona guardada localmente.');
            // Solicitar sincronización en segundo plano
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.sync.register('sync-personas');
                });
            }
            fetchPersonas(); // Actualizar la tabla después de guardar localmente
        };

        transaction.onerror = () => {
            console.error('Error al guardar localmente.');
        };
    }

    document.getElementById('persona-form').reset();
});

// Función para obtener personas desde el servidor o IndexedDB
function fetchPersonas() {
    if (navigator.onLine) {
        fetch('http://localhost:4000/api/persona')
        .then(response => response.json())
        .then(data => {
            personas = data;
            renderPersonas(); // Actualizar la tabla con los datos del servidor
        })
        .catch(error => console.error('Error al obtener personas:', error));
    } else {
        const transaction = db.transaction(['personas'], 'readonly');
        const store = transaction.objectStore('personas');
        const request = store.getAll();

        request.onsuccess = () => {
            personas = request.result;
            renderPersonas(); // Actualizar la tabla con los datos locales
        };

        request.onerror = () => {
            console.error('Error al obtener personas de IndexedDB.');
        };
    }
}

// Renderizar los datos en la tabla
function renderPersonas() {
    const personaTableBody = document.getElementById('persona-table-body');
    personaTableBody.innerHTML = '';

    personas.forEach(persona => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${persona.id || 'N/A'}</td>
            <td>${persona.name || 'N/A'}</td>
            <td>${persona.email || 'N/A'}</td>
            <td>${persona.phone || 'N/A'}</td>
            <td>${persona.address || 'N/A'}</td>
            <td><button onclick="deletePersona(${persona.id})">Delete</button></td>
        `;
        personaTableBody.appendChild(row);
    });
}

// Eliminar una persona
function deletePersona(id) {
    const transaction = db.transaction(['personas'], 'readwrite');
    const store = transaction.objectStore('personas');
    store.delete(id);

    transaction.oncomplete = () => {
        console.log('Persona eliminada localmente.');
        fetchPersonas(); // Actualizar la tabla después de eliminar localmente
    };

    transaction.onerror = () => {
        console.error('Error al eliminar localmente.');
    };

    // Eliminar también del servidor
    fetch(`http://localhost:4000/api/persona/${id}`, { method: 'DELETE' })
        .then(response => console.log('Persona eliminada del servidor:', id))
        .catch(error => console.error('Error al eliminar del servidor:', error));
}

// Registrar el service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('Service Worker registrado', reg))
        .catch(err => console.log('Error al registrar el Service Worker', err));
    });
}
