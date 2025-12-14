let isPicking = false;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "ok" });
  } else if (request.action === "start_selection") {
    isPicking = true;
    document.body.style.cursor = "crosshair";
    addHoverListeners();
  } else if (request.action === "open_manager") {
    showManagerModal();
  }
});

let hoveredElement = null;

function addHoverListeners() {
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onElementClick, true);
}

function removeHoverListeners() {
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  document.removeEventListener('click', onElementClick, true);
  if (hoveredElement) hoveredElement.classList.remove('sound-clicker-highlight');
  document.body.style.cursor = "default";
}

function onMouseOver(e) {
  if (!isPicking) return;
  e.stopPropagation();
  hoveredElement = e.target;
  hoveredElement.classList.add('sound-clicker-highlight');
}

function onMouseOut(e) {
  if (!isPicking) return;
  e.target.classList.remove('sound-clicker-highlight');
}

function onElementClick(e) {
  if (!isPicking) return;
  e.preventDefault();
  e.stopPropagation();
  
  isPicking = false;
  const target = e.target;
  target.classList.remove('sound-clicker-highlight');
  removeHoverListeners();

  const selector = getCssSelector(target);
  showConfigModal(selector);
}

function createEl(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  children.forEach(child => {
    if (typeof child === 'string') el.textContent = child;
    else el.appendChild(child);
  });
  return el;
}

function showConfigModal(selector, prefillVol = 100) {
  removeAnyModals();

  // Create Modal Elements safely
  const title = createEl('h3', {}, ['Configure Sound']);
  const targetInfo = createEl('p', { style: 'font-size:11px; color:#555; word-break:break-all;' }, [`Target: ${selector}`]);
  
  const fileLabel = createEl('label', {}, ['Select MP3 File:']);
  const fileInput = createEl('input', { type: 'file', id: 'sound-file', accept: 'audio/*', style: 'margin-bottom: 10px; width:100%' });
  
  const volLabel = createEl('label', {}, ['Volume: ']);
  const volSpan = createEl('span', { id: 'vol-val' }, [String(prefillVol)]);
  volLabel.appendChild(volSpan);
  volLabel.appendChild(document.createTextNode('%'));

  const volInput = createEl('input', { type: 'range', id: 'sound-vol', min: '0', max: '100', value: prefillVol, style: 'width:100%' });
  
  const statusMsg = createEl('p', { id: 'save-status', style: 'font-size:12px; color:blue; display:none;' }, ['Processing...']);

  const btnCancel = createEl('button', { id: 'sound-clicker-cancel' }, ['Cancel']);
  const btnSave = createEl('button', { id: 'sound-clicker-save' }, ['Save']);
  const btnContainer = createEl('div', { className: 'buttons' }, [btnCancel, btnSave]);

  const modal = createEl('div', { id: 'sound-clicker-modal' }, [
    title, targetInfo, fileLabel, fileInput, volLabel, volInput, statusMsg, btnContainer
  ]);

  document.body.appendChild(modal);

  volInput.addEventListener('input', (e) => volSpan.textContent = e.target.value);

  btnSave.addEventListener('click', () => {
    const vol = volInput.value / 100;
    
    if (fileInput.files.length > 0) {
      statusMsg.style.display = 'block';
      statusMsg.textContent = "Saving... please wait.";
      
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        saveSound(selector, e.target.result, vol);
        modal.remove();
      };
      reader.readAsDataURL(file);
    } else {
      // Allow saving volume only if existing
       checkExistingAndSave(selector, vol, modal);
    }
  });

  btnCancel.addEventListener('click', () => modal.remove());
}

function checkExistingAndSave(selector, vol, modal) {
    const pageUrl = window.location.href;
    chrome.storage.local.get([pageUrl], (result) => {
        const pageData = result[pageUrl] || [];
        const existing = pageData.find(item => item.selector === selector);
        if (existing) {
          saveSound(selector, existing.url, vol);
          modal.remove();
        } else {
          alert("Please select a file.");
        }
    });
}


function showManagerModal() {
  removeAnyModals();
  const pageUrl = window.location.href;
  
  chrome.storage.local.get([pageUrl], (result) => {
    const sounds = result[pageUrl] || [];
    
    const title = createEl('h3', {}, [`Managed Sounds (${sounds.length})`]);
    const listContainer = createEl('div', { id: 'sound-manager-list' });
    
    if (sounds.length === 0) {
      listContainer.appendChild(createEl('p', { style: 'padding:10px; color:#666' }, ['No sounds added yet.']));
    }

    sounds.forEach(item => {
      const elExists = document.querySelector(item.selector) ? "✅" : "❌";
      
      const nameDiv = createEl('div', { className: 'sound-item-name', title: item.selector }, [`${elExists} ${item.selector}`]);
      
      const btnEdit = createEl('button', { className: 'btn-edit' }, ['Edit']);
      btnEdit.onclick = () => showConfigModal(item.selector, item.volume * 100);

      const btnDel = createEl('button', { className: 'btn-del' }, ['Del']);
      btnDel.onclick = () => { deleteSound(item.selector); showManagerModal(); };

      const actionsDiv = createEl('div', { className: 'sound-item-actions' }, [btnEdit, btnDel]);
      
      const row = createEl('div', { className: 'sound-item-row' }, [nameDiv, actionsDiv]);
      
      // Hover highlight
      row.addEventListener('mouseenter', () => {
        const el = document.querySelector(item.selector);
        if(el) {
            el.scrollIntoView({behavior: "smooth", block: "center"});
            el.classList.add('manager-hover-highlight');
        }
      });
      row.addEventListener('mouseleave', () => {
        const el = document.querySelector(item.selector);
        if(el) el.classList.remove('manager-hover-highlight');
      });

      listContainer.appendChild(row);
    });

    const btnClose = createEl('button', { id: 'sound-clicker-cancel' }, ['Close']);
    btnClose.onclick = () => modal.remove();
    const btnContainer = createEl('div', { className: 'buttons' }, [btnClose]);

    const modal = createEl('div', { id: 'sound-clicker-modal' }, [title, listContainer, btnContainer]);
    document.body.appendChild(modal);
  });
}

function removeAnyModals() {
  const existing = document.getElementById('sound-clicker-modal');
  if (existing) existing.remove();
}

function saveSound(selector, audioData, volume) {
  const pageUrl = window.location.href;
  chrome.storage.local.get([pageUrl], (result) => {
    let pageData = result[pageUrl] || [];
    const existingIndex = pageData.findIndex(item => item.selector === selector);
    if (existingIndex > -1) {
      pageData[existingIndex] = { selector, url: audioData, volume };
    } else {
      pageData.push({ selector, url: audioData, volume });
    }
    const saveData = {};
    saveData[pageUrl] = pageData;
    chrome.storage.local.set(saveData, () => loadAndAttachSounds());
  });
}

function deleteSound(selector) {
  const pageUrl = window.location.href;
  chrome.storage.local.get([pageUrl], (result) => {
    let pageData = result[pageUrl] || [];
    const newData = pageData.filter(item => item.selector !== selector);
    
    // Cleanup
    const el = document.querySelector(selector);
    if(el) {
        el.removeEventListener('click', playSoundHandler);
        delete el._soundData;
        delete el._soundVol;
    }

    const saveData = {};
    saveData[pageUrl] = newData;
    chrome.storage.local.set(saveData, () => loadAndAttachSounds());
  });
}

function loadAndAttachSounds() {
  const pageUrl = window.location.href;
  chrome.storage.local.get([pageUrl], (result) => {
    const sounds = result[pageUrl];
    if (sounds && Array.isArray(sounds)) {
      sounds.forEach(item => {
        const el = document.querySelector(item.selector);
        if (el) {
          el._soundData = item.url;
          el._soundVol = item.volume;
          el.removeEventListener('click', playSoundHandler);
          el.addEventListener('click', playSoundHandler);
        }
      });
    }
  });
}

function playSoundHandler(e) {
  const audioData = e.currentTarget._soundData;
  const vol = e.currentTarget._soundVol;
  if (audioData) {
    const audio = new Audio(audioData);
    audio.volume = parseFloat(vol);
    audio.play().catch(err => console.error("Audio error:", err));
  }
}


function getCssSelector(el) {
  if (el.id) return '#' + el.id;
  let path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
        const firstClass = el.className.split(' ')[0];
        if(firstClass) selector += '.' + firstClass;
    }
    let sib = el, nth = 1;
    while (sib = sib.previousElementSibling) {
      if (sib.nodeName.toLowerCase() == selector) nth++;
    }
    if (nth > 1 || selector === 'div' || selector === 'span') selector += ":nth-of-type("+nth+")";
    path.unshift(selector);
    el = el.parentNode;
    if (el.id) { path.unshift('#'+el.id); break; }
  }
  return path.join(" > ");
}