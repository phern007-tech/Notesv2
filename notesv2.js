(() => {
  'use strict';

  const STORAGE_KEY = 'sticky_notes_global_v2';
  const MAX_NOTES = 10;
  const COLORS = ['#fff899', '#c1e7ff', '#d0f0c0', '#ffdbea', '#ffe0b3'];
  const MIN_OPACITY = 0.1;
  const MAX_OPACITY = 0.90;

  let overlay, panel, addButton, panelToggle, isPanelOpen = false;
  let nextColorIndex = 0;

  // Load global state
  const loadGlobalState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_state');
      if (saved) {
        const state = JSON.parse(saved);
        nextColorIndex = state.nextColorIndex || 0;
        if (panel) {
          if (state.panelLeft) panel.style.left = state.panelLeft;
          if (state.panelTop) panel.style.top = state.panelTop;
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
        panelLeft: panel?.style.left || 'unset',
        panelTop: panel?.style.top || 'unset'
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
      zIndex: '2147483648',
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
      const note = createNote(null, null, null, null, null, null, '', nextColorIndex, false, 1.0);
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

  // Update panel content
  const updatePanel = () => {
    if (!panel) return;
    const list = panel.querySelector('.notes-list');
    list.innerHTML = '';
    document.querySelectorAll('.sticky-bookmark-note').forEach(note => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 8px;
        margin: 6px 0;
        background: #f9f9f9;
        border-radius: 6px;
        cursor: pointer;
        position: relative;
        border: 1px solid #eee;
      `;

      const titleEl = note.querySelector('.sticky-note-title');
      const noteTitle = titleEl.value || '(untitled)';
      item.innerHTML = `
        <div style="font-weight:500; font-size:13px;">${escapeHtml(noteTitle)}</div>
        <div style="font-size:11px; color:#777; margin-top:2px;">Double-click to open</div>
        <button class="kebab" style="position:absolute; top:8px; right:8px; background:none; border:none; font-size:18px; cursor:pointer;">⋯</button>
      `;

      const kebab = item.querySelector('.kebab');
      kebab.addEventListener('click', (e) => {
        e.stopPropagation();
        showNoteMenu(e, note, item);
      });

      item.addEventListener('dblclick', () => {
        note.style.display = 'flex';
        note.scrollIntoView({ behavior: 'smooth', block: 'center' });
        note.style.boxShadow = '0 0 0 3px #00aaff';
        setTimeout(() => note.style.boxShadow = '2px 3px 10px rgba(0,0,0,0.3)', 1000);
      });

      item.addEventListener('click', (e) => {
        if (e.target === kebab) return;
        // Single click: highlight
        document.querySelectorAll('.sticky-bookmark-note').forEach(n => n.style.outline = 'none');
        note.style.outline = '2px solid #00aaff';
        setTimeout(() => note.style.outline = 'none', 1500);
      });

      list.appendChild(item);
    });
  };

  // Show note options menu
  const showNoteMenu = (e, note, panelItem) => {
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: absolute;
      top: ${e.clientY - panel.getBoundingClientRect().top + window.scrollY}px;
      left: ${e.clientX - panel.getBoundingClientRect().left + window.scrollX - 150}px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      padding: 8px;
      z-index: 2147483649;
      font-size: 13px;
      min-width: 160px;
    `;

    const opacity = parseFloat(note.style.opacity) || 1.0;

    menu.innerHTML = `
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px;" class="menu-open">🔍 Open Note</div>
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px;" class="menu-color">🎨 Change Color</div>
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px;" class="menu-opacity">💧 Transparency: ${Math.round(opacity * 100)}%</div>
      <div style="padding:6px 10px; cursor:pointer; border-radius:4px; color:red;" class="menu-delete">🗑️ Delete Note</div>
    `;

    document.body.appendChild(menu);

    // Close menu on outside click
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);

    // Menu actions
    menu.querySelector('.menu-open').addEventListener('click', () => {
      note.style.display = 'flex';
      note.scrollIntoView({ behavior: 'smooth', block: 'center' });
      note.style.boxShadow = '0 0 0 3px #00aaff';
      setTimeout(() => note.style.boxShadow = '2px 3px 10px rgba(0,0,0,0.3)', 1000);
      closeMenu();
    });

    menu.querySelector('.menu-color').addEventListener('click', () => {
      const colorPicker = document.createElement('select');
      colorPicker.style.cssText = 'width:100%; padding:4px; margin-top:6px; border-radius:4px;';
      COLORS.forEach((color, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `Color ${idx + 1}`;
        if (note.style.backgroundColor === color) opt.selected = true;
        colorPicker.appendChild(opt);
      });

      colorPicker.addEventListener('change', () => {
        const idx = parseInt(colorPicker.value);
        note.style.backgroundColor = COLORS[idx];
        saveNotes();
      });

      menu.appendChild(colorPicker);
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

    menu.querySelector('.menu-delete').addEventListener('click', () => {
      if (confirm('Delete this note permanently?')) {
        note.remove();
        saveNotes();
        if (isPanelOpen) updatePanel();
      }
      closeMenu();
    });
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

  // Create floating ➕ and ▲ buttons
  const createFloatingControls = () => {
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483648',
      pointerEvents: 'auto',
      display: 'flex',
      gap: '8px'
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
      const note = createNote(null, null, null, null, null, null, '', nextColorIndex, false, 1.0);
      nextColorIndex = (nextColorIndex + 1) % COLORS.length;
      overlay.appendChild(note);
      saveNotes();
      saveGlobalState();
      if (isPanelOpen) updatePanel();
    });

    panelToggle.addEventListener('click', togglePanel);

    container.appendChild(addButton);
    container.appendChild(panelToggle);
    document.body.appendChild(container);
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
      zIndex: '2147483647',
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
          <button class="btn-minimize" style="background:none;border:none;font-size:16px;cursor:pointer;color:#555;" title="Minimize">_</button>
        </div>
      </div>
      <div class="sticky-note-content" contenteditable="true" style="flex:1;padding:10px;outline:none;overflow:auto;resize:none;background:transparent;user-select:text;cursor:text;border:none;${isCollapsed ? 'display:none;' : ''}"></div>
    `;

    const header = n.querySelector('.sticky-note-header');
    const titleEl = n.querySelector('.sticky-note-title');
    const contentEl = n.querySelector('.sticky-note-content');
    const toggleBtn = n.querySelector('.btn-toggle');
    const minimizeBtn = n.querySelector('.btn-minimize');

    // Load content if provided
    if (content) contentEl.innerHTML = content;
    else contentEl.innerHTML = '<p><br></p>';

    // Toggle collapse/expand
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

    // Minimize (hide) note
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      n.style.display = 'none';
      if (isPanelOpen) updatePanel();
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

    // Resizers (left, bottom, right)
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

    // Auto-save on edit
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

  // Save all notes to localStorage
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
    saveGlobalState(); // also saves nextColorIndex
  };

  // Load notes from localStorage
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
      .sticky-notes-panel { position:fixed; top:80px; right:20px; width:220px; max-height:70vh; background:#fafafa; border:1px solid #ddd; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.15); padding:0; overflow:hidden; z-index:2147483648; pointer-events:auto; display:none; font-size:13px; font-family:system-ui,sans-serif; }
    `;
    document.head.appendChild(style);
  };

  // Initialize everything
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

    // Always create one default note if none exist
    if (savedNotes.length === 0) {
      const note = createNote();
      overlay.appendChild(note);
      saveNotes();
    }

    if (isPanelOpen) updatePanel();
  };

  init();
})();
