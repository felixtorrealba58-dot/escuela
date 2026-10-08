/* ==========================================================================
   LÓGICA DEL SISTEMA DE GESTIÓN Y FICHA TÉCNICA - CE ZAZARABICOA
   CON GESTIÓN DE EXPEDIENTE DIGITAL Y DOCUMENTOS PROBATORIOS (INDEXEDDB)
   ========================================================================== */

const STORAGE_KEY = 'zazarabicoa_personal_db_v1';

// Estado de la aplicación
let personalList = [];
let editingId = null;
let currentPreviewRecord = null;
let currentPreviewDocs = {};

// Documentos probatorios en memoria durante la edición del formulario
// Claves posibles: 'fotoCarnet', 'cedulaDoc', 'tituloDoc', 'reciboPago', 'constanciaTrabajo'
let currentEditingDocs = {};

// Documento actualmente abierto en el visor modal
let currentViewingDoc = null;

// Inicialización al cargar la ventana
document.addEventListener('DOMContentLoaded', async () => {
  checkAuthentication();
  setupAuthListeners();
  initLogo();
  loadData();
  setupEventListeners();
  setupDocumentUploadListeners();
  updateServiceYearsLive();
  calculateAgeLive();
  renderDirectoryTable();
  updateTotalCounters();
});

// Asignar el logotipo institucional desde logo_base64 o fallback relativo
function initLogo() {
  const brandImg = document.getElementById('brandLogo');
  let src = 'assets/logo.png';
  if (typeof INSTITUTIONAL_LOGO_BASE64 !== 'undefined' && INSTITUTIONAL_LOGO_BASE64) {
    src = INSTITUTIONAL_LOGO_BASE64;
  }
  if (brandImg) brandImg.src = src;
}

function getLogoSrc() {
  if (typeof INSTITUTIONAL_LOGO_BASE64 !== 'undefined' && INSTITUTIONAL_LOGO_BASE64) {
    return INSTITUTIONAL_LOGO_BASE64;
  }
  return 'assets/logo.png';
}

// Cargar datos desde localStorage
function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      personalList = JSON.parse(stored);
    } catch (e) {
      console.error('Error al analizar datos guardados:', e);
      personalList = [];
    }
  } else {
    // Registros demostrativos iniciales
    personalList = [
      {
        id: 'rec_1',
        nombres: 'María Elena',
        apellidos: 'García Peña',
        nacionalidad: 'V',
        cedula: '14.528.910',
        telefono: '0414-5551234',
        correo: 'maria.garcia@gmail.com',
        direccion: 'Calle Comercio con Av. Miranda, Casa N° 45, Sector Centro',
        fechaNacimiento: '1981-05-14',
        tituloPregrado: 'Licenciada en Educación Integral',
        postgrado: 'Magíster en Gerencia Educativa',
        esBachiller: false,
        categoria: 'docente',
        docCodigo: '0104-5829',
        docNivel: '4',
        fechaIngreso: '2012-09-15',
        docCargo: 'Docente de Aula',
        docArea: 'Educación Primaria - 4to Grado Turno Mañana',
        condicion: 'Activo',
        observaciones: 'Coordinadora de proyectos comunitarios de lectura.',
        docsCount: 0,
        hasFotoCarnet: false
      },
      {
        id: 'rec_2',
        nombres: 'Carlos Alberto',
        apellidos: 'Rodríguez Mendoza',
        nacionalidad: 'V',
        cedula: '17.842.119',
        telefono: '0424-9876543',
        correo: 'carlos.rodriguez@educacion.gob.ve',
        direccion: 'Urb. El Rosal, Vereda 3, Bloque B-12',
        fechaNacimiento: '1986-11-20',
        tituloPregrado: 'T.S.U. en Informática y Gestión',
        postgrado: '',
        esBachiller: false,
        categoria: 'administrativo',
        adminNivel: 'Asistente Administrativo III',
        fechaIngreso: '2016-03-01',
        adminArea: 'Departamento de Control de Estudios y Evaluación',
        condicion: 'Activo',
        observaciones: 'Encargado de sistematización de notas y títulos.',
        docsCount: 0,
        hasFotoCarnet: false
      },
      {
        id: 'rec_3',
        nombres: 'José Ramón',
        apellidos: 'Colmenárez Morales',
        nacionalidad: 'V',
        cedula: '11.309.845',
        telefono: '0416-3334455',
        correo: '',
        direccion: 'Barrio La Cruz, Calle Principal N° 12-A',
        fechaNacimiento: '1974-08-09',
        tituloPregrado: '',
        postgrado: '',
        esBachiller: true,
        categoria: 'obrero',
        obreroNivel: 'Obrero Especialista I',
        fechaIngreso: '2008-01-16',
        obreroArea: 'Mantenimiento General, Plomería y Electricidad del Plantel',
        condicion: 'Activo',
        observaciones: 'Personal con amplia trayectoria y responsabilidad.',
        docsCount: 0,
        hasFotoCarnet: false
      }
    ];
    saveData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(personalList));
  updateTotalCounters();
}

// Configuración de escuchas generales
function setupEventListeners() {
  // Pestañas principales
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Selector de categoría de personal
  document.querySelectorAll('input[name="categoria"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      handleCategoryChange(e.target.value);
    });
  });

  // Cálculo de años de servicio en vivo
  const fechaIngresoInput = document.getElementById('fechaIngreso');
  if (fechaIngresoInput) {
    fechaIngresoInput.addEventListener('input', updateServiceYearsLive);
    fechaIngresoInput.addEventListener('change', updateServiceYearsLive);
  }

  // Cálculo de edad en vivo
  const fechaNacInput = document.getElementById('fechaNacimiento');
  if (fechaNacInput) {
    fechaNacInput.addEventListener('input', calculateAgeLive);
    fechaNacInput.addEventListener('change', calculateAgeLive);
  }

  // Checkbox de Bachiller
  const chkBachiller = document.getElementById('esBachiller');
  if (chkBachiller) {
    chkBachiller.addEventListener('change', (e) => {
      const pregradoInput = document.getElementById('tituloPregrado');
      if (e.target.checked && pregradoInput && !pregradoInput.value.trim()) {
        pregradoInput.placeholder = 'No aplica (Registrado como Bachiller)';
      } else if (pregradoInput) {
        pregradoInput.placeholder = 'Ej: Lic. en Educación, Ing., T.S.U...';
      }
    });
  }

  // Formulario guardar
  const form = document.getElementById('personalForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveRecordFromForm(false);
    });
  }

  // Guardar y ver ficha
  const btnSaveAndPreview = document.getElementById('btnSaveAndPreview');
  if (btnSaveAndPreview) {
    btnSaveAndPreview.addEventListener('click', (e) => {
      e.preventDefault();
      if (validateForm()) {
        saveRecordFromForm(true);
      }
    });
  }

  // Cancelar edición
  const btnCancelEdit = document.getElementById('btnCancelEdit');
  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', resetForm);
  }

  // Buscador y filtros del directorio
  const searchInput = document.getElementById('searchQuery');
  if (searchInput) searchInput.addEventListener('input', renderDirectoryTable);

  const filterCat = document.getElementById('filterCategory');
  if (filterCat) filterCat.addEventListener('change', renderDirectoryTable);

  const filterCond = document.getElementById('filterCondition');
  if (filterCond) filterCond.addEventListener('change', renderDirectoryTable);

  // Cerrar modal de ficha
  const btnCloseModal = document.getElementById('btnCloseModal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closePreviewModal);

  // Imprimir ficha
  const btnPrintSheet = document.getElementById('btnPrintSheet');
  if (btnPrintSheet) {
    btnPrintSheet.addEventListener('click', () => {
      window.print();
    });
  }

  // Editar desde visor de ficha
  const btnEditFromPreview = document.getElementById('btnEditFromPreview');
  if (btnEditFromPreview) {
    btnEditFromPreview.addEventListener('click', () => {
      if (currentPreviewRecord) {
        closePreviewModal();
        editRecord(currentPreviewRecord.id);
      }
    });
  }

  // Visor de Documentos (Cerrar y Descargar)
  const btnDocViewerClose = document.getElementById('btnDocViewerClose');
  if (btnDocViewerClose) btnDocViewerClose.addEventListener('click', closeDocViewer);

  const btnDocViewerDownload = document.getElementById('btnDocViewerDownload');
  if (btnDocViewerDownload) {
    btnDocViewerDownload.addEventListener('click', () => {
      if (currentViewingDoc) {
        downloadDocFile(currentViewingDoc);
      }
    });
  }

  // Botones de Respaldo y Excel
  const btnExportExcel = document.getElementById('btnExportExcel');
  if (btnExportExcel) btnExportExcel.addEventListener('click', exportToExcel);

  const btnExportBackup = document.getElementById('btnExportBackup');
  if (btnExportBackup) btnExportBackup.addEventListener('click', exportBackupJSON);

  const btnImportBackup = document.getElementById('btnImportBackup');
  const fileBackupInput = document.getElementById('fileBackupInput');
  if (btnImportBackup && fileBackupInput) {
    btnImportBackup.addEventListener('click', () => fileBackupInput.click());
    fileBackupInput.addEventListener('change', handleImportBackup);
  }
}

// ==========================================================================
// CONTROL DE SUBIDA Y GESTIÓN DE DOCUMENTOS PROBATORIOS
// ==========================================================================

function setupDocumentUploadListeners() {
  // 1. Fotografía Tipo Carnet
  const btnUploadCarnet = document.getElementById('btnUploadCarnet');
  const inputCarnetPhoto = document.getElementById('inputCarnetPhoto');
  const btnRemoveCarnet = document.getElementById('btnRemoveCarnet');

  if (btnUploadCarnet && inputCarnetPhoto) {
    btnUploadCarnet.addEventListener('click', () => inputCarnetPhoto.click());
    inputCarnetPhoto.addEventListener('change', handleCarnetPhotoUpload);
  }

  if (btnRemoveCarnet) {
    btnRemoveCarnet.addEventListener('click', () => {
      delete currentEditingDocs['fotoCarnet'];
      updateCarnetPhotoUI(null);
      if (editingId) {
        dbDeleteDocument(editingId, 'fotoCarnet').catch(console.error);
      }
    });
  }

  // 2. Disparadores de carga de los 4 documentos probatorios
  document.querySelectorAll('.btn-upload-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const docType = btn.getAttribute('data-doctype');
      const box = document.getElementById(`box_${docType}`);
      const fileInput = box ? box.querySelector('.doc-file-input') : null;
      if (fileInput) fileInput.click();
    });
  });

  // Escucha de cambio para cada input de archivo de documento
  document.querySelectorAll('.doc-file-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const docType = e.target.getAttribute('data-doctype');
      handleDocumentFileUpload(docType, e.target.files[0]);
      e.target.value = ''; // Reset para permitir volver a subir el mismo archivo si se desea
    });
  });

  // Botones Ver Documento
  document.querySelectorAll('.btn-view-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const docType = btn.getAttribute('data-doctype');
      const doc = currentEditingDocs[docType];
      if (doc) openDocViewer(doc, getDocLabel(docType));
    });
  });

  // Botones Descargar Documento
  document.querySelectorAll('.btn-download-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const docType = btn.getAttribute('data-doctype');
      const doc = currentEditingDocs[docType];
      if (doc) downloadDocFile(doc);
    });
  });

  // Botones Eliminar Documento
  document.querySelectorAll('.btn-delete-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const docType = btn.getAttribute('data-doctype');
      if (confirm(`¿Desea quitar el recaudo "${getDocLabel(docType)}"?`)) {
        delete currentEditingDocs[docType];
        updateDocBoxUI(docType, null);
        if (editingId) {
          dbDeleteDocument(editingId, docType).catch(console.error);
        }
      }
    });
  });
}

// Procesar y comprimir la Fotografía Tipo Carnet
function handleCarnetPhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Por favor seleccione un archivo de imagen (JPG, PNG, WebP) para la fotografía carnet.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // Redimensionar suavemente a proporción estándar carnet (300 x 375 px)
      const targetW = 300;
      const targetH = 375;
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Centrado y recorte proporcional (cover)
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;
      const offsetX = (targetW - scaledW) / 2;
      const offsetY = (targetH - scaledH) / 2;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

      const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const docInfo = {
        fileName: file.name,
        fileType: 'image/jpeg',
        fileSize: Math.round(optimizedDataUrl.length * 0.75),
        fileSizeFormatted: formatFileSize(Math.round(optimizedDataUrl.length * 0.75)),
        dataUrl: optimizedDataUrl,
        uploadedAt: new Date().toISOString()
      };

      currentEditingDocs['fotoCarnet'] = docInfo;
      updateCarnetPhotoUI(docInfo);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// Actualizar la interfaz de la Foto Carnet
function updateCarnetPhotoUI(docInfo) {
  const previewImg = document.getElementById('carnetPhotoPreview');
  const placeholder = document.getElementById('carnetPhotoPlaceholder');
  const btnRemove = document.getElementById('btnRemoveCarnet');

  if (docInfo && docInfo.dataUrl) {
    if (previewImg) {
      previewImg.src = docInfo.dataUrl;
      previewImg.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (btnRemove) btnRemove.style.display = 'inline-flex';
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
    if (btnRemove) btnRemove.style.display = 'none';
  }
}

// Procesar archivo para los 4 documentos probatorios (Cédula, Título, Recibo, Constancia)
function handleDocumentFileUpload(docType, file) {
  if (!file) return;

  const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
    alert('Tipo de archivo no compatible. Por favor adjunte un archivo en formato PDF o Imagen (JPG, PNG).');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const docInfo = {
      fileName: file.name,
      fileType: file.type || 'application/pdf',
      fileSize: file.size,
      fileSizeFormatted: formatFileSize(file.size),
      dataUrl: event.target.result,
      uploadedAt: new Date().toISOString()
    };

    currentEditingDocs[docType] = docInfo;
    updateDocBoxUI(docType, docInfo);
  };
  reader.readAsDataURL(file);
}

// Actualizar la tarjeta visual del documento
function updateDocBoxUI(docType, docInfo) {
  const box = document.getElementById(`box_${docType}`);
  const statusBadge = document.getElementById(`status_${docType}`);
  const infoRow = document.getElementById(`info_${docType}`);
  const nameEl = document.getElementById(`name_${docType}`);
  const sizeEl = document.getElementById(`size_${docType}`);
  const btnView = document.getElementById(`btnView_${docType}`);
  const btnDl = document.getElementById(`btnDl_${docType}`);
  const btnDel = document.getElementById(`btnDel_${docType}`);

  if (docInfo) {
    if (box) box.classList.add('has-file');
    if (statusBadge) {
      statusBadge.textContent = '🟢 Consignado';
      statusBadge.className = 'doc-status-badge uploaded';
    }
    if (infoRow) infoRow.style.display = 'flex';
    if (nameEl) nameEl.textContent = docInfo.fileName || 'Documento adjunto';
    if (sizeEl) sizeEl.textContent = docInfo.fileSizeFormatted || '';
    if (btnView) btnView.style.display = 'inline-flex';
    if (btnDl) btnDl.style.display = 'inline-flex';
    if (btnDel) btnDel.style.display = 'inline-flex';
  } else {
    if (box) box.classList.remove('has-file');
    if (statusBadge) {
      statusBadge.textContent = '⚪ Sin adjuntar';
      statusBadge.className = 'doc-status-badge pending';
    }
    if (infoRow) infoRow.style.display = 'none';
    if (nameEl) nameEl.textContent = '';
    if (sizeEl) sizeEl.textContent = '';
    if (btnView) btnView.style.display = 'none';
    if (btnDl) btnDl.style.display = 'none';
    if (btnDel) btnDel.style.display = 'none';
  }
}

function getDocLabel(docType) {
  const labels = {
    fotoCarnet: 'Fotografía Tipo Carnet',
    cedulaDoc: 'Cédula de Identidad',
    tituloDoc: 'Título Académico',
    reciboPago: 'Recibo de Pago MPPE',
    constanciaTrabajo: 'Constancia de Trabajo'
  };
  return labels[docType] || docType;
}

// ==========================================================================
// MODAL VISOR DE DOCUMENTOS
// ==========================================================================

function openDocViewer(docInfo, title) {
  currentViewingDoc = docInfo;
  const modal = document.getElementById('docViewerModal');
  const titleEl = document.getElementById('docViewerTitle');
  const subEl = document.getElementById('docViewerSubtitle');
  const container = document.getElementById('docViewerContainer');

  if (!modal || !container) return;

  if (titleEl) titleEl.textContent = title || docInfo.fileName;
  if (subEl) subEl.textContent = `${docInfo.fileName} • ${docInfo.fileSizeFormatted || ''}`;

  container.innerHTML = '';

  const isPdf = docInfo.fileType === 'application/pdf' || (docInfo.fileName && docInfo.fileName.toLowerCase().endsWith('.pdf'));

  if (isPdf) {
    const iframe = document.createElement('iframe');
    iframe.src = docInfo.dataUrl;
    container.appendChild(iframe);
  } else {
    const img = document.createElement('img');
    img.src = docInfo.dataUrl;
    img.alt = docInfo.fileName;
    container.appendChild(img);
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDocViewer() {
  const modal = document.getElementById('docViewerModal');
  if (modal) modal.classList.remove('active');
  const container = document.getElementById('docViewerContainer');
  if (container) container.innerHTML = '';
  currentViewingDoc = null;
  document.body.style.overflow = 'auto';
}

function downloadDocFile(docInfo) {
  if (!docInfo || !docInfo.dataUrl) return;
  const a = document.createElement('a');
  a.href = docInfo.dataUrl;
  a.download = docInfo.fileName || 'documento_expediente';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ==========================================================================
// LÓGICA DE FORMULARIO Y CATEGORÍAS
// ==========================================================================

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabId === 'tab-directorio') {
    renderDirectoryTable();
  }
}

function handleCategoryChange(selectedCategory) {
  document.querySelectorAll('.cat-radio-label').forEach(lbl => {
    const radio = lbl.querySelector('input[type="radio"]');
    lbl.classList.toggle('selected', radio && radio.value === selectedCategory);
  });

  const panelDocente = document.getElementById('panelDocente');
  const panelAdmin = document.getElementById('panelAdmin');
  const panelObrero = document.getElementById('panelObrero');

  if (panelDocente) panelDocente.style.display = (selectedCategory === 'docente') ? 'block' : 'none';
  if (panelAdmin) panelAdmin.style.display = (selectedCategory === 'administrativo') ? 'block' : 'none';
  if (panelObrero) panelObrero.style.display = (selectedCategory === 'obrero') ? 'block' : 'none';
}

function calculateServiceYears(ingresoStr) {
  if (!ingresoStr) return { text: 'Indique fecha de ingreso', years: 0, months: 0 };

  let entryDate;
  if (ingresoStr.length === 4 && !isNaN(ingresoStr)) {
    entryDate = new Date(parseInt(ingresoStr), 8, 15);
  } else {
    entryDate = new Date(ingresoStr + 'T00:00:00');
  }

  if (isNaN(entryDate.getTime())) {
    return { text: 'Fecha inválida', years: 0, months: 0 };
  }

  const today = new Date();
  if (entryDate > today) {
    return { text: '0 años (Fecha futura)', years: 0, months: 0 };
  }

  let years = today.getFullYear() - entryDate.getFullYear();
  let months = today.getMonth() - entryDate.getMonth();
  let days = today.getDate() - entryDate.getDate();

  if (days < 0) months--;
  if (months < 0) {
    years--;
    months += 12;
  }

  let text = '';
  if (years === 0) {
    text = `${months} ${months === 1 ? 'mes' : 'meses'} de servicio`;
  } else if (years === 1) {
    text = `1 año y ${months} ${months === 1 ? 'mes' : 'meses'} de servicio`;
  } else {
    text = `${years} años y ${months} ${months === 1 ? 'mes' : 'meses'} de servicio`;
  }

  return { text, years, months };
}

function updateServiceYearsLive() {
  const input = document.getElementById('fechaIngreso');
  const display = document.getElementById('aniosServicioCalculados');
  if (!input || !display) return;
  const result = calculateServiceYears(input.value.trim());
  display.value = result.text;
}

function calculateAge(fechaNacStr) {
  if (!fechaNacStr) return '';
  const birthDate = new Date(fechaNacStr + 'T00:00:00');
  if (isNaN(birthDate.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? `${age} años` : '';
}

function calculateAgeLive() {
  const input = document.getElementById('fechaNacimiento');
  const display = document.getElementById('edadCalculada');
  if (!input || !display) return;
  display.textContent = calculateAge(input.value.trim());
}

function validateForm() {
  const nombres = document.getElementById('nombres').value.trim();
  const apellidos = document.getElementById('apellidos').value.trim();
  const cedula = document.getElementById('cedula').value.trim();
  const fechaIngreso = document.getElementById('fechaIngreso').value.trim();

  if (!nombres || !apellidos || !cedula) {
    alert('Por favor complete los campos obligatorios: Nombres, Apellidos y Cédula de Identidad.');
    return false;
  }

  if (!fechaIngreso) {
    alert('Por favor indique el Año o Fecha de Ingreso para calcular los años de servicio.');
    return false;
  }

  return true;
}

// Guardar o Actualizar Registro con Expediente en IndexedDB
async function saveRecordFromForm(openPreviewImmediately = false) {
  if (!validateForm()) return;

  const selectedCatRadio = document.querySelector('input[name="categoria"]:checked');
  const categoria = selectedCatRadio ? selectedCatRadio.value : 'docente';

  const recordId = editingId ? editingId : 'rec_' + Date.now();

  // Contabilizar recaudos adjuntos
  const docsCount = Object.keys(currentEditingDocs).length;
  const hasFotoCarnet = !!currentEditingDocs['fotoCarnet'];

  const record = {
    id: recordId,
    nombres: document.getElementById('nombres').value.trim(),
    apellidos: document.getElementById('apellidos').value.trim(),
    nacionalidad: document.getElementById('nacionalidad').value,
    cedula: document.getElementById('cedula').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    correo: document.getElementById('correo').value.trim(),
    direccion: document.getElementById('direccion').value.trim(),
    fechaNacimiento: document.getElementById('fechaNacimiento').value,
    
    // Títulos
    tituloPregrado: document.getElementById('tituloPregrado').value.trim(),
    postgrado: document.getElementById('postgrado').value.trim(),
    esBachiller: document.getElementById('esBachiller').checked,

    // Categoría
    categoria: categoria,
    fechaIngreso: document.getElementById('fechaIngreso').value.trim(),
    condicion: document.getElementById('condicion').value,
    observaciones: document.getElementById('observaciones').value.trim(),

    // Campos Docente
    docCodigo: document.getElementById('docCodigo').value.trim(),
    docNivel: document.getElementById('docNivel').value,
    docCargo: document.getElementById('docCargo').value,
    docArea: document.getElementById('docArea').value.trim(),

    // Campos Administrativo
    adminNivel: document.getElementById('adminNivel').value.trim(),
    adminArea: document.getElementById('adminArea').value.trim(),

    // Campos Obrero
    obreroNivel: document.getElementById('obreroNivel').value.trim(),
    obreroArea: document.getElementById('obreroArea').value.trim(),

    // Resumen de expediente digital
    docsCount: docsCount,
    hasFotoCarnet: hasFotoCarnet,

    actualizadoEl: new Date().toISOString()
  };

  // Guardar cada documento en IndexedDB
  try {
    for (const [docType, docInfo] of Object.entries(currentEditingDocs)) {
      await dbSaveDocument(recordId, docType, docInfo);
    }
  } catch (err) {
    console.error('Error al guardar documentos en IndexedDB:', err);
    alert('Aviso: Hubo un problema al almacenar algunos archivos del expediente: ' + err.message);
  }

  if (editingId) {
    const idx = personalList.findIndex(item => item.id === editingId);
    if (idx !== -1) {
      personalList[idx] = record;
    }
  } else {
    // Comprobar cédula duplicada
    const exists = personalList.some(item => item.cedula === record.cedula && item.nacionalidad === record.nacionalidad);
    if (exists) {
      if (!confirm(`Ya existe un funcionario registrado con la Cédula ${record.nacionalidad}-${record.cedula}. ¿Desea guardarlo de todas formas?`)) {
        return;
      }
    }
    personalList.unshift(record);
  }

  saveData();

  const savedRecord = { ...record };
  const savedDocs = { ...currentEditingDocs };

  resetForm();

  if (openPreviewImmediately) {
    showPreviewModal(savedRecord, savedDocs);
  } else {
    alert('¡Registro y expediente digital guardados exitosamente!');
    switchTab('tab-directorio');
  }
}

// Reiniciar formulario
function resetForm() {
  editingId = null;
  currentEditingDocs = {};

  const form = document.getElementById('personalForm');
  if (form) form.reset();

  document.getElementById('formModeTitle').textContent = 'Registrar Nuevo Funcionario';
  document.getElementById('btnSubmitForm').textContent = '💾 Guardar Registro y Expediente';
  document.getElementById('btnCancelEdit').style.display = 'none';

  const defaultRadio = document.querySelector('input[name="categoria"][value="docente"]');
  if (defaultRadio) {
    defaultRadio.checked = true;
    handleCategoryChange('docente');
  }

  // Reset de la UI de fotos y documentos probatorios
  updateCarnetPhotoUI(null);
  ['cedulaDoc', 'tituloDoc', 'reciboPago', 'constanciaTrabajo'].forEach(type => {
    updateDocBoxUI(type, null);
  });

  updateServiceYearsLive();
  calculateAgeLive();
}

// Editar registro y cargar sus documentos desde IndexedDB
async function editRecord(id) {
  const rec = personalList.find(item => item.id === id);
  if (!rec) return;

  editingId = rec.id;
  switchTab('tab-formulario');

  document.getElementById('formModeTitle').textContent = `Modificar Datos: ${rec.nombres} ${rec.apellidos}`;
  document.getElementById('btnSubmitForm').textContent = '🔄 Actualizar Registro y Expediente';
  document.getElementById('btnCancelEdit').style.display = 'inline-flex';

  // Rellenar campos
  document.getElementById('nombres').value = rec.nombres || '';
  document.getElementById('apellidos').value = rec.apellidos || '';
  document.getElementById('nacionalidad').value = rec.nacionalidad || 'V';
  document.getElementById('cedula').value = rec.cedula || '';
  document.getElementById('telefono').value = rec.telefono || '';
  document.getElementById('correo').value = rec.correo || '';
  document.getElementById('direccion').value = rec.direccion || '';
  document.getElementById('fechaNacimiento').value = rec.fechaNacimiento || '';

  document.getElementById('tituloPregrado').value = rec.tituloPregrado || '';
  document.getElementById('postgrado').value = rec.postgrado || '';
  document.getElementById('esBachiller').checked = !!rec.esBachiller;

  const catRadio = document.querySelector(`input[name="categoria"][value="${rec.categoria || 'docente'}"]`);
  if (catRadio) {
    catRadio.checked = true;
    handleCategoryChange(rec.categoria || 'docente');
  }

  document.getElementById('fechaIngreso').value = rec.fechaIngreso || '';
  document.getElementById('condicion').value = rec.condicion || 'Activo';
  document.getElementById('observaciones').value = rec.observaciones || '';

  document.getElementById('docCodigo').value = rec.docCodigo || '';
  document.getElementById('docNivel').value = rec.docNivel || '1';
  document.getElementById('docCargo').value = rec.docCargo || 'Docente de Aula';
  document.getElementById('docArea').value = rec.docArea || '';

  document.getElementById('adminNivel').value = rec.adminNivel || '';
  document.getElementById('adminArea').value = rec.adminArea || '';

  document.getElementById('obreroNivel').value = rec.obreroNivel || '';
  document.getElementById('obreroArea').value = rec.obreroArea || '';

  updateServiceYearsLive();
  calculateAgeLive();

  // Cargar documentos desde IndexedDB
  try {
    const docs = await dbGetAllDocumentsForRecord(rec.id);
    currentEditingDocs = docs || {};

    updateCarnetPhotoUI(currentEditingDocs['fotoCarnet'] || null);

    ['cedulaDoc', 'tituloDoc', 'reciboPago', 'constanciaTrabajo'].forEach(type => {
      updateDocBoxUI(type, currentEditingDocs[type] || null);
    });
  } catch (err) {
    console.error('Error al cargar expediente desde IndexedDB:', err);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Eliminar registro y sus archivos
async function deleteRecord(id) {
  const rec = personalList.find(item => item.id === id);
  if (!rec) return;

  if (confirm(`¿Está seguro de que desea eliminar a "${rec.nombres} ${rec.apellidos}" (C.I. ${rec.nacionalidad}-${rec.cedula}) y todos sus documentos probatorios?`)) {
    personalList = personalList.filter(item => item.id !== id);
    saveData();

    try {
      await dbDeleteAllDocumentsForRecord(id);
    } catch (err) {
      console.error('Error al limpiar documentos en IndexedDB:', err);
    }

    renderDirectoryTable();
  }
}

// ==========================================================================
// RENDERIZADO DE TABLA DEL DIRECTORIO
// ==========================================================================

function renderDirectoryTable() {
  const tbody = document.getElementById('directoryTableBody');
  if (!tbody) return;

  const query = (document.getElementById('searchQuery').value || '').toLowerCase().trim();
  const filterCat = document.getElementById('filterCategory').value;
  const filterCond = document.getElementById('filterCondition').value;

  const filtered = personalList.filter(item => {
    const textMatch = !query || 
      item.nombres.toLowerCase().includes(query) ||
      item.apellidos.toLowerCase().includes(query) ||
      item.cedula.toLowerCase().includes(query) ||
      (item.docCodigo && item.docCodigo.toLowerCase().includes(query)) ||
      (item.tituloPregrado && item.tituloPregrado.toLowerCase().includes(query)) ||
      (item.docArea && item.docArea.toLowerCase().includes(query)) ||
      (item.adminArea && item.adminArea.toLowerCase().includes(query)) ||
      (item.obreroArea && item.obreroArea.toLowerCase().includes(query));

    const catMatch = filterCat === 'todos' || item.categoria === filterCat;
    const condMatch = filterCond === 'todos' || item.condicion === filterCond;

    return textMatch && catMatch && condMatch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <span class="icon">🔍</span>
            <p><strong>No se encontraron registros que coincidan con la búsqueda.</strong></p>
            <p style="font-size: 0.85rem;">Verifique los filtros o agregue un nuevo funcionario desde el formulario.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const service = calculateServiceYears(item.fechaIngreso);
    let catBadge = '';
    let cargoNivel = '';

    if (item.categoria === 'docente') {
      catBadge = '<span class="badge badge-docente">Docente</span>';
      cargoNivel = `${item.docCargo || 'Docente'} (Nivel ${item.docNivel || '1'})`;
    } else if (item.categoria === 'administrativo') {
      catBadge = '<span class="badge badge-admin">Administrativo</span>';
      cargoNivel = item.adminNivel || 'Administrativo';
    } else {
      catBadge = '<span class="badge badge-obrero">Obrero</span>';
      cargoNivel = item.obreroNivel || 'Obrero';
    }

    const condBadge = item.condicion === 'Activo' 
      ? '<span class="badge badge-activo">Activo</span>' 
      : '<span class="badge badge-reposo">De Reposo</span>';

    const docsBadge = `<span class="badge badge-docs" onclick="editRecord('${item.id}')" title="Haga clic para ver o gestionar recaudos">📁 ${item.docsCount || 0}/5 Recaudos</span>`;

    return `
      <tr>
        <td><strong>${item.nacionalidad}-${item.cedula}</strong></td>
        <td>
          <div style="font-weight: 600;">${item.nombres} ${item.apellidos}</div>
          <div style="font-size: 0.78rem; color: #64748b;">${item.telefono || 'Sin teléfono'}</div>
        </td>
        <td>${catBadge}</td>
        <td>
          <div style="font-weight: 500;">${cargoNivel}</div>
          <div style="font-size: 0.78rem; color: #64748b;">${item.docArea || item.adminArea || item.obreroArea || '-'}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #1e3a8a;">${service.text}</div>
          <div style="font-size: 0.75rem; color: #64748b;">Ingreso: ${formatDate(item.fechaIngreso)}</div>
        </td>
        <td>${docsBadge}</td>
        <td>${condBadge}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-primary btn-sm" onclick="viewRecordSheet('${item.id}')" title="Ver e Imprimir Ficha Carta">
              🖨️ Ficha
            </button>
            <button class="btn btn-secondary btn-sm" onclick="editRecord('${item.id}')" title="Editar y ver expediente">
              ✏️
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecord('${item.id}')" title="Eliminar">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function updateTotalCounters() {
  const total = personalList.length;
  const countBadge = document.getElementById('badgeTotalCount');
  if (countBadge) countBadge.textContent = `${total} Registrados`;
}

// ==========================================================================
// RENDERIZADO DE LA FICHA TÉCNICA OFICIAL PARA IMPRESIÓN TAMAÑO CARTA
// ==========================================================================

async function viewRecordSheet(id) {
  const rec = personalList.find(p => p.id === id);
  if (!rec) return;

  // Cargar recaudos y foto carnet desde IndexedDB
  let docs = {};
  try {
    docs = await dbGetAllDocumentsForRecord(rec.id);
  } catch (e) {
    console.error('Error al cargar recaudos para la ficha:', e);
  }

  showPreviewModal(rec, docs);
}

function showPreviewModal(rec, docs = {}) {
  currentPreviewRecord = rec;
  currentPreviewDocs = docs;

  const modal = document.getElementById('previewModal');
  const modalName = document.getElementById('previewPersonName');
  if (modalName) modalName.textContent = `${rec.nombres} ${rec.apellidos} (C.I. ${rec.nacionalidad}-${rec.cedula})`;

  const service = calculateServiceYears(rec.fechaIngreso);
  const edad = calculateAge(rec.fechaNacimiento);
  const fechaNacFormateada = formatDate(rec.fechaNacimiento);
  const fechaIngresoFormateada = formatDate(rec.fechaIngreso);
  const fechaHoy = new Date().toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });

  // Foto carnet para el encabezado de la hoja Carta
  let photoHtml = '';
  if (docs.fotoCarnet && docs.fotoCarnet.dataUrl) {
    photoHtml = `<div class="letter-carnet-photo-box"><img src="${docs.fotoCarnet.dataUrl}" alt="Foto carnet"></div>`;
  } else {
    photoHtml = `<div class="letter-carnet-photo-box"><div class="placeholder-label">FOTO TIPO<br>CARNET</div></div>`;
  }

  // Título y categoría
  let categoriaTitulo = '';
  let nivelTexto = '';
  let cargoTexto = '';
  let areaTexto = '';
  let codigoDocenteHtml = '';

  if (rec.categoria === 'docente') {
    categoriaTitulo = 'PERSONAL DOCENTE';
    nivelTexto = `DOCENTE ${toRoman(rec.docNivel || 1)} (NIVEL ${rec.docNivel || 1})`;
    cargoTexto = rec.docCargo || 'Docente de Aula';
    areaTexto = rec.docArea || 'No especificada';
    codigoDocenteHtml = `
      <tr>
        <th>CÓDIGO DE CARGO / RAC:</th>
        <td class="cell-bold">${rec.docCodigo ? rec.docCodigo : 'NO ASIGNADO'}</td>
        <th>CONDICIÓN / ESTATUS:</th>
        <td><span class="val-tag">${(rec.condicion || 'ACTIVO').toUpperCase()}</span></td>
      </tr>
    `;
  } else if (rec.categoria === 'administrativo') {
    categoriaTitulo = 'PERSONAL ADMINISTRATIVO';
    nivelTexto = rec.adminNivel ? rec.adminNivel.toUpperCase() : 'NO ESPECIFICADO';
    cargoTexto = 'ADMINISTRATIVO';
    areaTexto = rec.adminArea || 'No especificada';
    codigoDocenteHtml = `
      <tr>
        <th>CATEGORÍA LABORAL:</th>
        <td class="cell-bold">ADMINISTRATIVO</td>
        <th>CONDICIÓN / ESTATUS:</th>
        <td><span class="val-tag">${(rec.condicion || 'ACTIVO').toUpperCase()}</span></td>
      </tr>
    `;
  } else {
    categoriaTitulo = 'PERSONAL OBRERO';
    nivelTexto = rec.obreroNivel ? rec.obreroNivel.toUpperCase() : 'NO ESPECIFICADO';
    cargoTexto = 'OBRERO / SERVICIOS GENERALES';
    areaTexto = rec.obreroArea || 'No especificada';
    codigoDocenteHtml = `
      <tr>
        <th>CATEGORÍA LABORAL:</th>
        <td class="cell-bold">OBRERO</td>
        <th>CONDICIÓN / ESTATUS:</th>
        <td><span class="val-tag">${(rec.condicion || 'ACTIVO').toUpperCase()}</span></td>
      </tr>
    `;
  }

  // Formación académica
  let formacionHtml = '';
  if (rec.esBachiller && !rec.tituloPregrado) {
    formacionHtml = `
      <tr>
        <th>NIVEL ACADÉMICO:</th>
        <td colspan="3" class="cell-bold">BACHILLER DE LA REPÚBLICA (SIN TÍTULO UNIVERSITARIO)</td>
      </tr>
    `;
  } else {
    formacionHtml = `
      <tr>
        <th>TÍTULO DE PREGRADO:</th>
        <td colspan="3" class="cell-bold">${rec.tituloPregrado ? rec.tituloPregrado.toUpperCase() : 'NO REGISTRA'}</td>
      </tr>
      <tr>
        <th>ESTUDIOS DE POSTGRADO:</th>
        <td colspan="3">${rec.postgrado ? rec.postgrado.toUpperCase() : 'NO POSEE / NO REGISTRA'}</td>
      </tr>
    `;
    if (rec.esBachiller) {
      formacionHtml += `
        <tr>
          <th>CONDICIÓN DE BACHILLER:</th>
          <td colspan="3">Graduado de Bachiller</td>
        </tr>
      `;
    }
  }

  // Estados de recaudos para la tabla de inventario
  const hasCarnet = docs.fotoCarnet ? 'CONSIGNADO [✔]' : 'NO CONSIGNADO [—]';
  const hasCedula = docs.cedulaDoc ? 'CONSIGNADO [✔]' : 'NO CONSIGNADO [—]';
  const hasTitulo = docs.tituloDoc ? 'CONSIGNADO [✔]' : 'NO CONSIGNADO [—]';
  const hasRecibo = docs.reciboPago ? 'CONSIGNADO [✔]' : 'NO CONSIGNADO [—]';
  const hasConstancia = docs.constanciaTrabajo ? 'CONSIGNADO [✔]' : 'NO CONSIGNADO [—]';

  // Contenido de la hoja tamaño Carta
  const sheetContainer = document.getElementById('letterSheetContent');
  sheetContainer.innerHTML = `
    <!-- ENCABEZADO INSTITUCIONAL CON ESCUDO Y FOTO CARNET -->
    <div class="letter-header">
      <div class="letter-logo-box">
        <img id="printLogo" src="${getLogoSrc()}" alt="Escudo CE Zazarabicoa">
      </div>
      <div class="letter-header-text">
        <div class="line-rep">República Bolivariana de Venezuela</div>
        <div class="line-min">Ministerio del Poder Popular para la Educación</div>
        <div class="line-inst">COMPLEJO EDUCATIVO "ZAZARABICOA"</div>
        <div class="line-meta">Código Dependencia / Administrativo • Fundada en 1946 • Año Escolar Vigente</div>
      </div>
      <div class="letter-logo-box">
        ${photoHtml}
      </div>
    </div>

    <!-- TÍTULO DE LA FICHA -->
    <div class="letter-title-banner">
      <h2>EXPEDIENTE RESUMEN Y FICHA TÉCNICA DEL TRABAJADOR</h2>
      <div class="subcode">APARTADO: ${categoriaTitulo} • EMISIÓN OFICIAL EN HOJA TAMAÑO CARTA</div>
    </div>

    <!-- SECCIÓN I: DATOS PERSONALES -->
    <div class="letter-section">
      <div class="section-head">
        <span>I. DATOS DE IDENTIFICACIÓN Y CONTACTO PERSONAL</span>
        <span style="font-weight: normal; font-size: 7.5pt;">C.I. ${rec.nacionalidad}-${rec.cedula}</span>
      </div>
      <table class="section-table">
        <tr>
          <th>APELLIDOS Y NOMBRES:</th>
          <td colspan="3" class="cell-bold" style="font-size: 9pt;">
            ${rec.apellidos.toUpperCase()}, ${rec.nombres.toUpperCase()}
          </td>
        </tr>
        <tr>
          <th>CÉDULA DE IDENTIDAD:</th>
          <td class="cell-bold">${rec.nacionalidad}-${rec.cedula}</td>
          <th>FECHA DE NACIMIENTO:</th>
          <td>${fechaNacFormateada || 'No indicada'} ${edad ? `(${edad})` : ''}</td>
        </tr>
        <tr>
          <th>NÚMERO TELEFÓNICO:</th>
          <td>${rec.telefono || 'No registrado'}</td>
          <th>CORREO ELECTRÓNICO:</th>
          <td>${rec.correo || 'No registrado'}</td>
        </tr>
        <tr>
          <th>DIRECCIÓN DE HABITACIÓN:</th>
          <td colspan="3">${rec.direccion || 'No especificada'}</td>
        </tr>
      </table>
    </div>

    <!-- SECCIÓN II: FORMACIÓN ACADÉMICA -->
    <div class="letter-section">
      <div class="section-head">
        <span>II. FORMACIÓN ACADÉMICA Y PROFESIONAL</span>
      </div>
      <table class="section-table">
        ${formacionHtml}
      </table>
    </div>

    <!-- SECCIÓN III: DATOS LABORALES -->
    <div class="letter-section">
      <div class="section-head">
        <span>III. DATOS LABORALES E INSTITUCIONALES (${categoriaTitulo})</span>
      </div>
      <table class="section-table">
        ${codigoDocenteHtml}
        <tr>
          <th>NIVEL / CLASIFICACIÓN:</th>
          <td class="cell-bold">${nivelTexto}</td>
          <th>CARGO O FUNCIÓN:</th>
          <td>${cargoTexto}</td>
        </tr>
        <tr>
          <th>FECHA / AÑO DE INGRESO:</th>
          <td class="cell-bold">${fechaIngresoFormateada}</td>
          <th>AÑOS DE SERVICIO:</th>
          <td class="cell-bold" style="color: #0f172a; background-color: #f8fafc;">
            ★ ${service.text.toUpperCase()}
          </td>
        </tr>
        <tr>
          <th>ÁREA DE TRABAJO ESPECÍFICA:</th>
          <td colspan="3" class="cell-bold">${areaTexto.toUpperCase()}</td>
        </tr>
        ${rec.observaciones ? `
          <tr>
            <th>OBSERVACIONES / NOTAS:</th>
            <td colspan="3">${rec.observaciones}</td>
          </tr>
        ` : ''}
      </table>
    </div>

    <!-- SECCIÓN IV: INVENTARIO DE RECAUDOS PROBATORIOS CONSIGNADOS -->
    <div class="letter-section">
      <div class="section-head">
        <span>IV. INVENTARIO DE RECAUDOS PROBATORIOS CONSIGNADOS EN EL EXPEDIENTE</span>
        <span style="font-weight: normal; font-size: 7.2pt;">ARCHIVO CENTRAL</span>
      </div>
      <table class="checklist-table">
        <tr>
          <th style="width: 20%;">FOTOGRAFÍA CARNET</th>
          <th style="width: 20%;">CÉDULA DE IDENTIDAD</th>
          <th style="width: 20%;">TÍTULO ACADÉMICO</th>
          <th style="width: 20%;">RECIBO DE PAGO</th>
          <th style="width: 20%;">CONSTANCIA TRABAJO</th>
        </tr>
        <tr>
          <td class="check-mark ${docs.fotoCarnet ? 'check-yes' : 'check-no'}">${hasCarnet}</td>
          <td class="check-mark ${docs.cedulaDoc ? 'check-yes' : 'check-no'}">${hasCedula}</td>
          <td class="check-mark ${docs.tituloDoc ? 'check-yes' : 'check-no'}">${hasTitulo}</td>
          <td class="check-mark ${docs.reciboPago ? 'check-yes' : 'check-no'}">${hasRecibo}</td>
          <td class="check-mark ${docs.constanciaTrabajo ? 'check-yes' : 'check-no'}">${hasConstancia}</td>
        </tr>
      </table>
    </div>

    <!-- SECCIÓN V: CONSTANCIA Y FIRMAS -->
    <div class="letter-signatures-block">
      <p style="text-align: justify; font-size: 6.8pt; margin-bottom: 20px; line-height: 1.18;">
        Se hace constar que los datos y recaudos arriba relacionados reposan en el archivo de personal y expediente curricular 
        del <strong>Complejo Educativo "Zazarabicoa"</strong>, habiendo sido debidamente consignados y validados conforme a los 
        requisitos institucionales vigentes al día <strong>${fechaHoy}</strong>.
      </p>

      <div class="signatures-grid">
        <div class="signature-col">
          <div class="signature-line"></div>
          <div class="sig-name">${rec.nombres} ${rec.apellidos}</div>
          <div class="sig-role">FIRMA DEL FUNCIONARIO / TRABAJADOR<br>C.I. ${rec.nacionalidad}-${rec.cedula}</div>
        </div>

        <div class="signature-col">
          <div class="signature-line"></div>
          <div class="sig-name">DIRECCIÓN DEL PLANTEL</div>
          <div class="sig-role">FIRMA Y SELLO OFICIAL DE LA INSTITUCIÓN<br>C.E. "ZAZARABICOA" (1946)</div>
        </div>
      </div>

      <div class="letter-footer-note">
        Documento oficial emitido por el Sistema de Personal del C.E. Zazarabicoa • Formato estandarizado en Hoja Tamaño Carta (Letter)
      </div>
    </div>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = 'auto';
}

// ==========================================================================
// EXPORTACIÓN A EXCEL Y RESPALDO JSON
// ==========================================================================

function exportToExcel() {
  if (personalList.length === 0) {
    alert('No hay registros de personal disponibles para exportar.');
    return;
  }

  const headers = [
    'Nacionalidad',
    'Cedula',
    'Nombres',
    'Apellidos',
    'Telefono',
    'Correo',
    'Direccion',
    'Fecha Nacimiento',
    'Titulo Pregrado',
    'Postgrado',
    'Es Bachiller',
    'Categoria',
    'Codigo Cargo',
    'Nivel',
    'Cargo Funcion',
    'Area Especifica',
    'Fecha Ingreso',
    'Anios Servicio',
    'Recaudos Adjuntos',
    'Condicion'
  ];

  const rows = personalList.map(item => {
    const service = calculateServiceYears(item.fechaIngreso);
    let nivel = '';
    let cargo = '';
    let area = '';

    if (item.categoria === 'docente') {
      nivel = 'Nivel ' + (item.docNivel || '1');
      cargo = item.docCargo || 'Docente de Aula';
      area = item.docArea || '';
    } else if (item.categoria === 'administrativo') {
      nivel = item.adminNivel || '';
      cargo = 'Administrativo';
      area = item.adminArea || '';
    } else {
      nivel = item.obreroNivel || '';
      cargo = 'Obrero';
      area = item.obreroArea || '';
    }

    return [
      item.nacionalidad,
      item.cedula,
      `"${(item.nombres || '').replace(/"/g, '""')}"`,
      `"${(item.apellidos || '').replace(/"/g, '""')}"`,
      `"${(item.telefono || '').replace(/"/g, '""')}"`,
      `"${(item.correo || '').replace(/"/g, '""')}"`,
      `"${(item.direccion || '').replace(/"/g, '""')}"`,
      item.fechaNacimiento || '',
      `"${(item.tituloPregrado || '').replace(/"/g, '""')}"`,
      `"${(item.postgrado || '').replace(/"/g, '""')}"`,
      item.esBachiller ? 'SI' : 'NO',
      item.categoria.toUpperCase(),
      item.docCodigo || '',
      `"${nivel.replace(/"/g, '""')}"`,
      `"${cargo.replace(/"/g, '""')}"`,
      `"${area.replace(/"/g, '""')}"`,
      item.fechaIngreso || '',
      `"${service.text.replace(/"/g, '""')}"`,
      `${item.docsCount || 0} de 5`,
      item.condicion || 'Activo'
    ].join(';');
  });

  const csvContent = '\uFEFF' + headers.join(';') + '\r\n' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Nomina_Personal_Zazarabicoa_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportBackupJSON() {
  if (personalList.length === 0) {
    alert('No hay registros para respaldar.');
    return;
  }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(personalList, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', `Respaldo_Personal_Zazarabicoa_${new Date().toISOString().slice(0,10)}.json`);
  dlAnchor.click();
}

function handleImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        if (confirm(`Se encontraron ${imported.length} registros en el archivo. ¿Desea restaurar esta base de datos?`)) {
          personalList = imported;
          saveData();
          renderDirectoryTable();
          alert('¡Respaldo importado y restaurado exitosamente!');
        }
      } else {
        alert('El archivo no posee el formato de respaldo de personal válido.');
      }
    } catch (err) {
      alert('Error al leer el archivo de respaldo: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// Utilidades
function formatDate(dStr) {
  if (!dStr) return '';
  if (dStr.length === 4) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
}

function toRoman(num) {
  const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
  return map[num] || num;
}


// ==========================================================================
// SEGURIDAD Y CONTROL DE ACCESO CON CONTRASEÑA
// ==========================================================================
const ACCESS_PASSWORD = 'torrealba1970';
const AUTH_SESSION_KEY = 'zazarabicoa_auth_active';

function checkAuthentication() {
  const overlay = document.getElementById('loginOverlay');
  const isAuth = sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';

  if (isAuth) {
    if (overlay) overlay.style.display = 'none';
  } else {
    if (overlay) {
      overlay.style.display = 'flex';
      const input = document.getElementById('loginPassword');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
      }
    }
  }
}

function setupAuthListeners() {
  const loginForm = document.getElementById('loginForm');
  const passwordInput = document.getElementById('loginPassword');
  const errorMsg = document.getElementById('loginErrorMsg');
  const card = document.getElementById('loginCard');
  const btnToggle = document.getElementById('btnTogglePassword');
  const btnLock = document.getElementById('btnLockSession');
  const loginLogo = document.getElementById('loginLogoImg');

  if (loginLogo) {
    loginLogo.src = getLogoSrc();
  }

  if (btnToggle && passwordInput) {
    btnToggle.addEventListener('click', () => {
      const isPwd = passwordInput.type === 'password';
      passwordInput.type = isPwd ? 'text' : 'password';
      btnToggle.textContent = isPwd ? '🙈' : '👁️';
    });
  }

  if (loginForm && passwordInput) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = passwordInput.value.trim();

      if (entered === ACCESS_PASSWORD) {
        if (errorMsg) errorMsg.style.display = 'none';
        sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
        const overlay = document.getElementById('loginOverlay');
        if (overlay) {
          overlay.style.opacity = '0';
          overlay.style.transition = 'opacity 0.25s ease';
          setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.opacity = '1';
          }, 250);
        }
      } else {
        if (errorMsg) {
          errorMsg.style.display = 'block';
        }
        if (card) {
          card.classList.remove('shake');
          void card.offsetWidth; // reiniciar animacion
          card.classList.add('shake');
        }
        passwordInput.value = '';
        passwordInput.focus();
      }
    });
  }

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      if (confirm('¿Desea bloquear el sistema? Se requerirá la contraseña para ingresar nuevamente.')) {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        checkAuthentication();
      }
    });
  }
}
