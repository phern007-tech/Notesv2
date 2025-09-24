console.log('NotesV3 Loaded — Enhanced UX, Copy, Z-Index, Color Picker, Close All');

(() => {
  'use strict';

  const STORAGE_KEY = 'sticky_notes_global_v2';
  const MAX_NOTES = 10;
  const COLORS = ['#fff899', '#c1e7ff', '#d0f0c0', '#ffdbea', '#ffe0b3', '#d9a7ff', '#a8dadc', '#fca311'];
  const MIN_OPACITY = 0.01; // 1%
  const MAX_OPACITY = 0.99; // 99%

  let overlay, panel, addButton, panelToggle, controlBar, isPanelOpen = false;
  let nextColorIndex = 0;
  let zIndexCounter = 2147483647 + 10; // Start above base

  // Load global state
  const loadGlobalState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_state');
      if (saved) {
        const state = JSON.parse(saved);
        nextColorIndex = state.nextColorIndex || 0;

        if (panel && state.panelLeft !== undefined) {
          panel.style.left = state.panelLeft + 'px';
          panel.style.top = state.panelTop + 'px';
        }

        if (controlBar && state.controlLeft !== undefined) {
          controlBar.style.right = 'auto';
          controlBar.style.bottom = 'auto';
          controlBar.style.left = state.controlLeft + 'px';
          controlBar.style.top = state.controlTop + 'px';
        }
      }
    } catch (e) {
      console.warn('Failed to load global state');
    }
  };

  const saveGlobalState = () => {
    try {
      const state = {
        nextColorIndex,
        panelLeft: panel ? parseInt(panel.style.left) || window.innerWidth - 240 : undefined,
        panelTop: panel ? parseInt(panel.style.top) || 80 : undefined,
        controlLeft: controlBar ? parseInt(controlBar.style.left) || window.innerWidth - 100 : undefined,
        controlTop: controlBar ? parseInt(controlBar.style.top) || window.innerHeight - 80 : undefined
      };
      localStorage.setItem(STORAGE_KEY + '_state', JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save global state');
    }
  };

  // Create global overlay
  const createOverlay = () => {
    const o = document.createElement('div');
    o.className = 'sticky-bookmark-overlay';
    Object.assign(o.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2147483647'
    });
    document.body.appendChild(o);
    return o;
  };

  // Create Notes Panel (sidebar)
  const createNotesPanel = () => {
    const p = document.createElement('div');
    p.className = 'sticky-notes-panel';
    Object.assign(p.style, {
      position: 'fixed',
      top: '80px',
      right: '20px',
      width: '220px',
      maxHeight: '70vh',
      backgroundColor: '#fafafa',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
      padding: '0',
      overflow: 'hidden',
      zIndex: '2147483650', // ↑ Always above notes
      pointerEvents: 'auto',
      display: 'none',
      fontSize: '13px',
      fontFamily: 'system-ui, sans-serif'
    });

    // Panel Header (draggable)
    const header = document.createElement('div');
    header.textContent = '📌 My Notes';
    header.style.cssText = `
      padding: 8px 12px;
      background: #f0f0f0;
      font-weight: bold;
      border-bottom: 1px solid #ddd;
      cursor: move;
      user-select: none;
      border-radius: 8px 8px 0 0;
    `;
    p.appendChild(header);

    // Make panel draggable
    let isDragging = false, startX, startY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseInt(p.style.left) || window.innerWidth - 240;
      initialTop = parseInt(p.style.top) || 80;
      document.addEventListener('mousemove', dragMove);
      document.addEventListener('mouseup', dragEnd);
    });

    const dragMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      p.style.left = (initialLeft + dx) + 'px';
      p.style.top = (initialTop + dy) + 'px';
    };

    const dragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', dragMove);
      document.removeEventListener('mouseup', dragEnd);
      saveGlobalState();
    };

    // Notes list container
    const list = document.createElement('div');
    list.className = 'notes-list';
    list.style.cssText = 'padding: 10px; max-height: calc(70vh - 60px); overflow-y: auto;';
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetEl = e.target.closest('.note-item');
      const draggedEl = document.querySelector(`[data-drag-id="${draggedId}"]`);
      if (!draggedEl || !targetEl) return;

      const allItems = Array.from(list.querySelectorAll('.note-item'));
      const draggedIdx = allItems.indexOf(draggedEl);
      const targetIdx = allItems.indexOf(targetEl);

      if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return;

      if (draggedIdx < targetIdx) {
        list.insertBefore(draggedEl, targetEl.nextSibling);
      } else {
        list.insertBefore(draggedEl, targetEl);
      }

      reorderNotesByPanel();
      saveNotes();
    });
    p.appendChild(list);

    // New Note button
    const newBtn = document.createElement('button');
    newBtn.textContent = '+ New Note';
    newBtn.style.cssText = `
      width: 100%;
      padding: 8px;
      margin-top: 10px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 0 0 8px 8px;
      cursor: pointer;
      font-weight: bold;
    `;
    newBtn.addEventListener('click', () => {
      if (document.querySelectorAll('.sticky-bookmark-note').length >= MAX_NOTES) {
        alert(`Max ${MAX_NOTES} notes allowed.`);
        return;
      }
      const note = createNote(null, null, null, null, null, '', '', nextColorIndex, false, 1.0);
      nextColorIndex = (nextColorIndex + 1) % COLORS.length;
      overlay.appendChild(note);
      saveNotes();
      saveGlobalState();
      if (isPanelOpen) updatePanel();
    });
    p.appendChild(newBtn);

    document.body.appendChild(p);
    return p;
  };

  // Reorder actual notes array to match panel display order
  const reorderNotesByPanel = () => {
    const list = panel.querySelector('.notes-list');
    const itemEls = list.querySelectorAll('.note-item');
    const orderedIds = Array.from(itemEls).map(el => el.dataset.noteId);

    const fragment = document.createDocumentFragment();
    orderedIds.forEach(id => {
      const note = document.querySelector(`.sticky-bookmark-note[data-id="${id}"]`);
      if (note) fragment.appendChild(note);
    });

    while (overlay.firstChild) {
      overlay.removeChild(overlay.firstChild);
    }
    overlay.appendChild(fragment);
  };

  // Update panel content
  const updatePanel = () => {
    if (!panel) return;
    const list = panel.querySelector('.notes-list');
    list.innerHTML = '';
    document.querySelectorAll('.sticky-bookmark-note').forEach(note => {
      const item = document.createElement('div');
      item.className = 'note-item';
      item.dataset.noteId = note.dataset.id;
      item.draggable = true;

      item.style.cssText = `
        padding: 8px;
        margin: 6px 0;
        background: #f9f9f9;
        border-radius: 6px;
        cursor: grab;
        position: relative;
        border: 1px solid #eee;
      `;

      const titleEl = note.querySelector('.sticky-note-title');
      const noteTitle = titleEl.value || '(untitled)';
      item.innerHTML = `
        <div style="font-weight:500; font-size:13px;">${escapeHtml(noteTitle)}</div>
        <button class="kebab" style="position:absolute; top:8px; right:8px; background:none; border:none; font-size:18px; cursor:pointer;">⋯</button>
      `;

      // Drag setup
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', note.dataset.id);
        item.style.opacity = '0.7';
        item.dataset.dragId = note.dataset.id;
      });

      item.addEventListener('dragend', () => {
        item.style.opacity = '1';
        delete item.dataset.dragId;
      });

      const kebab = item.querySelector('.kebab');
      kebab.addEventListener('click', (e) => {
        e.stopPropagation();
        showNoteMenu(e, note, item, kebab);
      });

      item.addEventListener('dblclick', () => {
        note.style.display = 'flex';
        note.scrollIntoView({ behavior: 'smooth', block: 'center' });
        note.style.boxShadow = '0 0 0 3px #00aaff';
        setTimeout(() => note.style.boxShadow = '2px 3px 10px rgba(0,0,0,0.3)', 1000);
      });

      item.addEventListener('click', (e) => {
        if (e.target === kebab) return;
        bringToFront(note);
        document.querySelectorAll('.sticky-bookmark-note').forEach(n => n.style.outline = 'none');
        note.style.outline = '2px solid #00aaff';
        setTimeout(() => note.style.outline = 'none', 1500);
      });

      list.appendChild(item);
    });
  };

  // Show note options menu BELOW the kebab button
  const showNoteMenu = (e, note, panelItem, triggerBtn) => {
    // Close any existing menus
    document.querySelectorAll('.note-context-menu').forEach(m => m.remove());

    const rect = triggerBtn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'note-context-menu';
    menu.style.cssText = `
      position: absolute;
      top: ${rect.bottom + window.scrollY + 4}px;
      left: ${rect.left + window.scrollX}px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      padding: 8px;
      z-index: 2147483649;
      font-size: 13px;
      min-width: 180px;
    `;

    const opacity = parseFloat(note.style.opacity) || 1.0;

    menu.innerHTML = `
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px;" class="menu-open">🔍 Open Note</div>
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px;" class="menu-color">🎨 Change Color</div>
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px;" class="menu-opacity">💧 Transparency: ${Math.round(opacity * 100)}%</div>
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px; color:#0078d4;" class="menu-copy">📋 Copy to Clipboard</div>
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px; color:red;" class="menu-delete">🗑️ Delete Note</div>
      <hr style="margin:6px 0; border:0; border-top:1px solid #eee;">
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px; color:red; font-weight:bold;" class="menu-close-all">⚠️ Close All Notes</div>
    `;

    document.body.appendChild(menu);

    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);

    menu.querySelector('.menu-open').addEventListener('click', () => {
      note.style.display = 'flex';
      note.scrollIntoView({ behavior: 'smooth', block: 'center' });
      note.style.boxShadow = '0 0 0 3px #00aaff';
      setTimeout(() => note.style.boxShadow = '2px 3px 10px rgba(0,0,0,0.3)', 1000);
      closeMenu();
    });

    menu.querySelector('.menu-color').addEventListener('click', () => {
      const colorContainer = document.createElement('div');
      colorContainer.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; padding-top:8px; border-top:1px solid #eee;';

      // Preset colors
      COLORS.forEach((color, idx) => {
        const swatch = document.createElement('div');
        swatch.style.cssText = `
          width: 24px; height: 24px; border-radius: 50%; background: ${color};
          cursor: pointer; border: 2px solid transparent;
          ${note.style.backgroundColor === color ? 'border-color: #000;' : ''}
        `;
        swatch.addEventListener('click', () => {
          note.style.backgroundColor = color;
          saveNotes();
          closeMenu(); // Auto-close after selection
        });
        colorContainer.appendChild(swatch);
      });

      // Custom color picker
      const customPicker = document.createElement('input');
      customPicker.type = 'color';
      customPicker.value = note.style.backgroundColor || COLORS[0];
      customPicker.style.cssText = 'width:24px; height:24px; border:none; cursor:pointer; margin-left:6px;';
      customPicker.addEventListener('input', () => {
        note.style.backgroundColor = customPicker.value;
        saveNotes();
      });
      customPicker.addEventListener('change', () => {
        closeMenu(); // Close on final pick
      });

      colorContainer.appendChild(customPicker);
      menu.appendChild(colorContainer);
    });

    menu.querySelector('.menu-opacity').addEventListener('click', () => {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = MIN_OPACITY * 100;
      slider.max = MAX_OPACITY * 100;
      slider.value = opacity * 100;
      slider.step = 1;
      slider.style.cssText = 'width:100%; margin-top:6px;';

      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value) / 100;
        note.style.opacity = val;
        menu.querySelector('.menu-opacity').textContent = `💧 Transparency: ${slider.value}%`;
        saveNotes();
      });

      menu.appendChild(slider);
    });

    menu.querySelector('.menu-copy').addEventListener('click', async () => {
      const titleEl = note.querySelector('.sticky-note-title');
      const contentEl = note.querySelector('.sticky-note-content');
      const text = `[${titleEl.value || 'Untitled'}]\n\n${contentEl.innerText}`;

      try {
        await navigator.clipboard.writeText(text);
        showCopiedToast(note);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
      closeMenu();
    });

    menu.querySelector('.menu-delete').addEventListener('click', () => {
      if (confirm('Delete this note permanently?')) {
        note.remove();
        saveNotes();
        if (isPanelOpen) updatePanel();
      }
      closeMenu();
    });

    menu.querySelector('.menu-close-all').addEventListener('click', () => {
      if (confirm('⚠️ Close ALL notes? This will hide them until you reopen via panel.')) {
        document.querySelectorAll('.sticky-bookmark-note').forEach(n => n.style.display = 'none');
        if (isPanelOpen) updatePanel();
      }
      closeMenu();
    });
  };

  // Show "Copied!" toast above note
  const showCopiedToast = (note) => {
    const toast = document.createElement('div');
    toast.textContent = '✅ Copied!';
    toast.style.cssText = `
      position: absolute;
      top: -36px;
      left: 50%;
      transform: translateX(-50%);
      background: #4CAF50;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 2147483649;
      animation: fadeOut 1.5s forwards;
    `;

    const keyframes = `
      @keyframes fadeOut {
        0% { opacity: 1; transform: translateX(-50%) translateY(0); }
        70% { opacity: 1; }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
    `;

    // Inject keyframes once
    if (!document.getElementById('copy-toast-keyframes')) {
      const style = document.createElement('style');
      style.id = 'copy-toast-keyframes';
      style.textContent = keyframes;
      document.head.appendChild(style);
    }

    note.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 1600);
  };

  // Bring clicked note to front
  const bringToFront = (note) => {
    note.style.zIndex = zIndexCounter++;
  };

  // Toggle panel visibility
  const togglePanel = () => {
    if (!panel) {
      panel = createNotesPanel();
    }
    isPanelOpen = !isPanelOpen;
    panel.style.display = isPanelOpen ? 'block' : 'none';
    panelToggle.textContent = isPanelOpen ? '▼ Notes' : '▲ Notes';
    if (isPanelOpen) updatePanel();
  };

  // Create floating ➕ and ▲ buttons inside draggable container
  const createFloatingControls = () => {
    controlBar = document.createElement('div');
    Object.assign(controlBar.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483651', // ↑ Above panel and notes
      pointerEvents: 'auto',
      display: 'flex',
      gap: '8px',
      padding: '6px',
      background: 'rgba(255,255,255,0.8)',
      borderRadius: '24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      cursor: 'move'
    });

    addButton = document.createElement('button');
    addButton.textContent = '➕';
    Object.assign(addButton.style, {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      border: 'none',
      background: '#fff899',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      cursor: 'pointer',
      fontSize: '18px'
    });

    panelToggle = document.createElement('button');
    panelToggle.textContent = '▲ Notes';
    Object.assign(panelToggle.style, {
      padding: '8px 12px',
      borderRadius: '20px',
      border: 'none',
      background: '#eee',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      fontSize: '12px',
      whiteSpace: 'nowrap'
    });

    addButton.addEventListener('click', () => {
      if (document.querySelectorAll('.sticky-bookmark-note').length >= MAX_NOTES) {
        alert(`Max ${MAX_NOTES} notes allowed.`);
        return;
      }
      const note = createNote(null, null, null, null, null, '', '', nextColorIndex, false, 1.0);
      nextColorIndex = (nextColorIndex + 1) % COLORS.length;
      overlay.appendChild(note);
      saveNotes();
      saveGlobalState();
      if (isPanelOpen) updatePanel();
    });

    panelToggle.addEventListener('click', togglePanel);

    // Make entire control bar draggable
    let isDragging = false, startX, startY, initialLeft, initialTop;
    controlBar.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseInt(controlBar.style.left) || window.innerWidth - parseInt(controlBar.style.right || 100) - controlBar.offsetWidth;
      initialTop = parseInt(controlBar.style.top) || window.innerHeight - parseInt(controlBar.style.bottom || 20) - controlBar.offsetHeight;
      document.addEventListener('mousemove', dragMove);
      document.addEventListener('mouseup', dragEnd);
    });

    const dragMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      controlBar.style.left = (initialLeft + dx) + 'px';
      controlBar.style.top = (initialTop + dy) + 'px';
      controlBar.style.right = 'auto';
      controlBar.style.bottom = 'auto';
    };

    const dragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', dragMove);
      document.removeEventListener('mouseup', dragEnd);
      saveGlobalState();
    };

    controlBar.appendChild(addButton);
    controlBar.appendChild(panelToggle);
    document.body.appendChild(controlBar);
  };

  // Escape HTML for safe insertion
  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // Create a single note
  const createNote = (id, left, top, width, height, content, title = '', colorIndex = 0, isCollapsed = false, opacity = 1.0) => {
    const n = document.createElement('div');
    n.className = 'sticky-bookmark-note';
    n.dataset.id = id || 'note-' + Date.now();
    const bgColor = COLORS[colorIndex % COLORS.length];

    Object.assign(n.style, {
      position: 'absolute',
      left: left || (50 + Math.random() * 100) + 'px',
      top: top || (50 + Math.random() * 100) + 'px',
      width: width || '250px',
      minWidth: '150px',
      height: isCollapsed ? '30px' : (height || '200px'),
      minHeight: isCollapsed ? '30px' : '150px',
      backgroundColor: bgColor,
      borderRadius: '8px',
      boxShadow: '2px 3px 10px rgba(0,0,0,0.3)',
      padding: '0',
      pointerEvents: 'auto',
      cursor: 'default',
      userSelect: 'none',
      zIndex: zIndexCounter++,
      display: 'flex',
      flexDirection: 'column',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
      transition: 'height 0.2s ease',
      opacity: opacity
    });

    n.innerHTML = `
      <div class="sticky-note-header" style="padding:6px 10px;background:rgba(255,255,255,0.4);border-bottom:1px solid rgba(0,0,0,0.1);display:flex;justify-content:space-between;align-items:center;cursor:move;border-radius:8px 8px 0 0;">
        <input class="sticky-note-title" type="text" placeholder="Note Title" value="${escapeHtml(title)}" style="flex:1; background:transparent; border:none; outline:none; font-weight:bold; font-size:13px; padding:2px 4px; margin-right:6px;"/>
        <div style="display:flex; align-items:center; gap:4px;">
          <button class="btn-toggle" style="background:none;border:none;font-size:16px;cursor:pointer;color:#555;" title="${isCollapsed ? 'Expand' : 'Collapse'}">${isCollapsed ? '▲' : '▼'}</button>
          <button class="btn-minimize" style="background:none;border:none;font-size:18px;cursor:pointer;color:#555;" title="Minimize">_</button>
          <button class="btn-copy" style="background:none;border:none;font-size:18px;cursor:pointer;color:#555;" title="Copy to Clipboard">📋</button>
        </div>
      </div>
      <div class="sticky-note-content" contenteditable="true" style="flex:1;padding:10px;outline:none;overflow:auto;resize:none;background:transparent;user-select:text;cursor:text;border:none;${isCollapsed ? 'display:none;' : ''}"></div>
    `;

    const header = n.querySelector('.sticky-note-header');
    const titleEl = n.querySelector('.sticky-note-title');
    const contentEl = n.querySelector('.sticky-note-content');
    const toggleBtn = n.querySelector('.btn-toggle');
    const minimizeBtn = n.querySelector('.btn-minimize');
    const copyBtn = n.querySelector('.btn-copy');

    if (content) contentEl.innerHTML = content;
    else contentEl.innerHTML = '<p><br></p>';

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isCollapsed = !isCollapsed;
      n.style.height = isCollapsed ? '30px' : '200px';
      n.style.minHeight = isCollapsed ? '30px' : '150px';
      contentEl.style.display = isCollapsed ? 'none' : 'block';
      toggleBtn.textContent = isCollapsed ? '▲' : '▼';
      toggleBtn.title = isCollapsed ? 'Expand' : 'Collapse';
      saveNotes();
    });

    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      n.style.display = 'none';
      if (isPanelOpen) updatePanel();
    });

    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = `[${titleEl.value || 'Untitled'}]\n\n${contentEl.innerText}`;
      try {
        await navigator.clipboard.writeText(text);
        showCopiedToast(n);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    });

    // Click anywhere on note → bring to front
    n.addEventListener('mousedown', () => {
      bringToFront(n);
    });

    // Draggable
    let isDragging = false, startX, startY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target === titleEl) return;
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseInt(n.style.left);
      initialTop = parseInt(n.style.top);
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
    });

    const onDragMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      n.style.left = (initialLeft + dx) + 'px';
      n.style.top = (initialTop + dy) + 'px';
    };

    const onDragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      saveNotes();
    };

    // Resizers
    const addResizer = (dir, cursorStyle) => {
      const resizer = document.createElement('div');
      resizer.className = `resizer-${dir}`;
      Object.assign(resizer.style, {
        position: 'absolute',
        cursor: cursorStyle,
        zIndex: 2147483648
      });

      if (dir === 'left') {
        resizer.style.cssText += 'top: 0; left: 0; width: 6px; height: 100%;';
      } else if (dir === 'bottom') {
        resizer.style.cssText += 'bottom: 0; left: 6px; right: 6px; height: 6px;';
      } else if (dir === 'right') {
        resizer.style.cssText += 'top: 0; right: 0; width: 6px; height: 100%;';
      }

      let isResizing = false, startValue, startSize;
      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        if (dir === 'left' || dir === 'right') {
          startValue = e.clientX;
          startSize = parseFloat(n.style.width);
        } else {
          startValue = e.clientY;
          startSize = parseFloat(n.style.height);
        }
        document.addEventListener('mousemove', resizeMove);
        document.addEventListener('mouseup', resizeEnd);
      });

      const resizeMove = (e) => {
        if (!isResizing) return;
        let delta = (dir === 'left' || dir === 'bottom') ? startValue - (dir === 'left' ? e.clientX : e.clientY) : e.clientX - startValue;
        let newSize = startSize + delta;

        if (dir === 'left' || dir === 'right') {
          newSize = Math.max(150, newSize);
          n.style.width = newSize + 'px';
          if (dir === 'left') {
            const newLeft = initialLeft - delta;
            n.style.left = newLeft + 'px';
          }
        } else {
          newSize = Math.max(isCollapsed ? 30 : 150, newSize);
          n.style.height = newSize + 'px';
        }
      };

      const resizeEnd = () => {
        isResizing = false;
        document.removeEventListener('mousemove', resizeMove);
        document.removeEventListener('mouseup', resizeEnd);
        saveNotes();
      };

      n.appendChild(resizer);
    };

    ['left', 'bottom', 'right'].forEach(dir => {
      const cursor = dir === 'left' || dir === 'right' ? 'ew-resize' : 'ns-resize';
      addResizer(dir, cursor);
    });

    // Auto-save
    let saveTimeout;
    const debouncedSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveNotes, 500);
    };

    titleEl.addEventListener('input', debouncedSave);
    contentEl.addEventListener('input', debouncedSave);
    contentEl.addEventListener('paste', () => setTimeout(debouncedSave, 100));

    // Allow image paste/drop
    contentEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = document.createElement('img');
          img.src = ev.target.result;
          img.style.maxWidth = '100%';
          contentEl.appendChild(img);
          debouncedSave();
        };
        reader.readAsDataURL(files[0]);
      }
    });

    contentEl.addEventListener('dragover', (e) => e.preventDefault());

    return n;
  };

  // Save all notes
  const saveNotes = () => {
    const notes = document.querySelectorAll('.sticky-bookmark-note');
    const data = Array.from(notes).map(n => {
      const titleEl = n.querySelector('.sticky-note-title');
      const contentEl = n.querySelector('.sticky-note-content');
      const bgColor = n.style.backgroundColor;
      const colorIndex = COLORS.indexOf(bgColor) !== -1 ? COLORS.indexOf(bgColor) : 0;
      return {
        id: n.dataset.id,
        left: n.style.left,
        top: n.style.top,
        width: n.style.width,
        height: n.style.height,
        content: contentEl.innerHTML,
        title: titleEl.value,
        colorIndex,
        isCollapsed: contentEl.style.display === 'none',
        opacity: parseFloat(n.style.opacity) || 1.0
      };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    saveGlobalState();
  };

  // Load notes
  const loadNotes = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved notes');
      return [];
    }
  };

  // Inject CSS
  const injectStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .sticky-bookmark-overlay { position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:2147483647; }
      .sticky-bookmark-note { position:absolute; min-width:150px; min-height:30px; border-radius:8px; box-shadow:2px 3px 10px rgba(0,0,0,0.3); padding:0; pointer-events:auto; cursor:default; user-select:none; z-index:2147483647; display:flex; flex-direction:column; font-size:14px; font-family:system-ui,sans-serif; transition: height 0.2s ease; }
      .sticky-note-header { padding:6px 10px; background:rgba(255,255,255,0.4); border-bottom:1px solid rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center; cursor:move; border-radius:8px 8px 0 0; }
      .sticky-note-header button { background:none; border:none; font-size:16px; cursor:pointer; color:#555; padding:2px 4px; }
      .sticky-note-content { flex:1; padding:10px; outline:none; overflow:auto; resize:none; background:transparent; user-select:text; cursor:text; border:none; }
      .sticky-notes-panel { position:fixed; top:80px; right:20px; width:220px; max-height:70vh; background:#fafafa; border:1px solid #ddd; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.15); padding:0; overflow:hidden; z-index:2147483650; pointer-events:auto; display:none; font-size:13px; font-family:system-ui,sans-serif; }
      .note-item { cursor: grab; }
      .note-item:active { cursor: grabbing; }
      .note-context-menu { font-family: system-ui, sans-serif; }
    `;
    document.head.appendChild(style);
  };

  // Initialize
  const init = () => {
    if (document.querySelector('.sticky-bookmark-overlay')) return;

    injectStyles();
    overlay = createOverlay();
    createFloatingControls();
    loadGlobalState();

    const savedNotes = loadNotes();
    savedNotes.forEach(noteData => {
      const note = createNote(
        noteData.id,
        noteData.left,
        noteData.top,
        noteData.width,
        noteData.height,
        noteData.content,
        noteData.title,
        noteData.colorIndex,
        noteData.isCollapsed,
        noteData.opacity
      );
      overlay.appendChild(note);
    });

    if (savedNotes.length === 0) {
      const note = createNote();
      overlay.appendChild(note);
      saveNotes();
    }

    if (isPanelOpen) updatePanel();
  };

  init();
})();
