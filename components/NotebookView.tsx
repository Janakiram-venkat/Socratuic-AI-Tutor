import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Note } from '../types';

interface Props {
  notes: Note[];
  onAddNote: (note: Note) => void;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onStudyNote?: (content: string) => void;
}

const COLORS = [
    { label: 'Yellow', value: '#fef08a' },
    { label: 'Green', value: '#bbf7d0' },
    { label: 'Blue', value: '#bfdbfe' },
    { label: 'Pink', value: '#fbcfe8' },
    { label: 'Purple', value: '#e9d5ff' },
    { label: 'Orange', value: '#fed7aa' },
];

const NotebookView: React.FC<Props> = ({ notes, onAddNote, onUpdateNote, onDeleteNote, onStudyNote }) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  // Advanced Features State
  const [showSketchPad, setShowSketchPad] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Table Config
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  // Sketch Config
  const [sketchDims, setSketchDims] = useState({ w: 500, h: 400 });
  const [previewDims, setPreviewDims] = useState<{ w: number, h: number } | null>(null);
  const resizeStartRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);
  const tempImageDataRef = useRef<ImageData | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Element Selection (Image/Table)
  const [selectedNode, setSelectedNode] = useState<HTMLElement | null>(null);
  
  // Find and Replace State
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  
  // Sorting & Preview State
  const [sortBy, setSortBy] = useState<'updated' | 'created'>('updated');
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Track active ID to determine when to reset editor state
  const prevActiveIdRef = useRef<string | null>(null);

  // Toolbar active states
  const [formats, setFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    listBullet: false,
    listNumber: false
  });

  const activeNote = notes.find(n => n.id === activeNoteId);

  // Initialize editor content only when switching notes
  useEffect(() => {
    if (activeNote) {
        if (activeNote.id !== prevActiveIdRef.current) {
            setEditingTitle(activeNote.title);
            if (editorRef.current && !isPreviewMode) {
                editorRef.current.innerHTML = activeNote.content;
            }
            prevActiveIdRef.current = activeNote.id;
            setSelectedNode(null); // Deselect on switch
        }
    } else {
        prevActiveIdRef.current = null;
        setEditingTitle('');
        if (editorRef.current && !isPreviewMode) editorRef.current.innerHTML = '';
        setSelectedNode(null);
    }
  }, [activeNoteId, activeNote, isPreviewMode]);

  const handleCreate = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    onAddNote(newNote);
    setActiveNoteId(newNote.id);
    setIsPreviewMode(false);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setEditingTitle(newTitle);
    if (activeNote) {
        onUpdateNote({
            ...activeNote,
            title: newTitle,
            updatedAt: Date.now()
        });
    }
  };

  const handleContentChange = () => {
    if (activeNote && editorRef.current) {
      onUpdateNote({
        ...activeNote,
        content: editorRef.current.innerHTML,
        title: editingTitle, 
        updatedAt: Date.now()
      });
    }
    checkFormatState();
  };

  const checkFormatState = () => {
      setFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          listBullet: document.queryCommandState('insertUnorderedList'),
          listNumber: document.queryCommandState('insertOrderedList'),
      });
  };

  // --- Rich Text Commands ---
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    checkFormatState();
    handleContentChange(); 
    if (showColorPicker) setShowColorPicker(false);
  };

  const insertCustomTable = () => {
      let tableHTML = `<table style="width:100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #cbd5e1;"><tbody>`;
      
      // Header Row
      tableHTML += `<tr>`;
      for(let c=0; c<tableCols; c++) {
          tableHTML += `<th style="border:1px solid #cbd5e1; padding:8px; background-color: #f1f5f9; text-align: left;">Header ${c+1}</th>`;
      }
      tableHTML += `</tr>`;

      // Data Rows
      for(let r=0; r<tableRows; r++) {
          tableHTML += `<tr>`;
          for(let c=0; c<tableCols; c++) {
             tableHTML += `<td style="border:1px solid #cbd5e1; padding:8px;">Cell</td>`;
          }
          tableHTML += `</tr>`;
      }
      tableHTML += `</tbody></table><p><br/></p>`;
      
      if (editorRef.current) {
          editorRef.current.focus();
          document.execCommand('insertHTML', false, tableHTML);
      }
      setShowTableModal(false);
      handleContentChange();
  };

  // --- Find and Replace Logic ---
  const handleFindNext = () => {
    if (!findText) return;
    const found = (window as any).find(findText, false, false, true, false, false, false);
    if (!found) {
        console.warn("Text not found");
    }
  };

  const handleReplace = () => {
      if (!findText) return;
      const selection = window.getSelection();
      if (selection && selection.toString().toLowerCase() === findText.toLowerCase()) {
          document.execCommand('insertText', false, replaceText);
          handleContentChange();
      } else {
          handleFindNext();
      }
  };

  const handleReplaceAll = () => {
      if (!findText || !editorRef.current) return;
      const regex = new RegExp(findText, 'g');
      const newContent = editorRef.current.innerHTML.replace(regex, replaceText);
      editorRef.current.innerHTML = newContent;
      handleContentChange();
  };

  // --- Sketch Pad Logic ---
  const startDrawing = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b82f6'; // Blue pen

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    canvasRef.current?.getContext('2d')?.closePath();
  };

  // --- Sketch Resize Logic (Modal) ---
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      resizeStartRef.current = {
          x: clientX,
          y: clientY,
          w: sketchDims.w,
          h: sketchDims.h
      };
      setPreviewDims({ w: sketchDims.w, h: sketchDims.h });
      
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.addEventListener('touchmove', handleResizeMove);
      document.addEventListener('touchend', handleResizeEnd);
  };
  
  const handleResizeMove = (e: MouseEvent | TouchEvent) => {
      if (!resizeStartRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
      const dx = clientX - resizeStartRef.current.x;
      const dy = clientY - resizeStartRef.current.y;
      
      setPreviewDims({
          w: Math.max(200, resizeStartRef.current.w + dx),
          h: Math.max(200, resizeStartRef.current.h + dy)
      });
  };
  
  const handleResizeEnd = () => {
      if (resizeStartRef.current && canvasRef.current && previewDims) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          const savedData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          if (savedData) {
              tempImageDataRef.current = savedData;
          }
          setSketchDims(previewDims);
      }
      setPreviewDims(null);
      resizeStartRef.current = null;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('touchmove', handleResizeMove);
      document.removeEventListener('touchend', handleResizeEnd);
  };

  useEffect(() => {
      if (tempImageDataRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.putImageData(tempImageDataRef.current, 0, 0);
          tempImageDataRef.current = null;
      }
  }, [sketchDims]);


  const saveSketch = () => {
     if (!canvasRef.current) return;
     const dataUrl = canvasRef.current.toDataURL();
     const imgHtml = `<img src="${dataUrl}" style="max-width:100%; border:1px solid #ddd; border-radius:8px; margin: 10px 0; display: block;" /><p><br/></p>`;
     
     if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, imgHtml);
     }
     setShowSketchPad(false);
     handleContentChange();
  };

  // --- Element Selection & Manipulation ---
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
        setSelectedNode(target);
    } else if (target.closest('table')) {
        setSelectedNode(target.closest('table') as HTMLElement);
    } else {
        // Only deselect if clicking outside controls
        if (selectedNode && !target.closest('.element-controls')) {
            setSelectedNode(null);
        }
    }
  };

  const handleImgResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedNode || selectedNode.tagName !== 'IMG') return;
    
    const img = selectedNode as HTMLImageElement;
    const startX = e.clientX;
    const startWidth = img.clientWidth;

    const onMove = (mv: MouseEvent) => {
        const newWidth = Math.max(50, startWidth + (mv.clientX - startX));
        img.style.width = `${newWidth}px`;
        img.style.height = 'auto';
    };

    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        handleContentChange(); // Save new dimensions
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const moveSelectedNode = (direction: 'up' | 'down') => {
      if (!selectedNode || !selectedNode.parentNode) return;
      const parent = selectedNode.parentNode;
      
      // Move logic tries to move the element past its siblings
      // Note: This relies on the DOM structure. If text is not wrapped in P tags, this might jump over text nodes.
      // But sketches and tables are inserted as blocks.
      
      if (direction === 'up') {
          const prev = selectedNode.previousElementSibling;
          if (prev) {
              parent.insertBefore(selectedNode, prev);
              selectedNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
              handleContentChange();
          }
      } else {
          const next = selectedNode.nextElementSibling;
          if (next) {
              parent.insertBefore(selectedNode, next.nextElementSibling);
              selectedNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
              handleContentChange();
          }
      }
      // Force overlay update implicitly via re-render or resize observer in ControlOverlay
  };

  const deleteSelectedNode = () => {
      if (!selectedNode) return;
      if (confirm("Delete this item?")) {
        selectedNode.remove();
        setSelectedNode(null);
        handleContentChange();
      }
  };

  const handleStudy = () => {
      if (onStudyNote && editorRef.current) {
          const content = editorRef.current.innerText; // Get plain text for AI
          onStudyNote(content);
      }
  };

  // Sort notes
  const sortedNotes = [...notes].sort((a, b) => {
      if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
      return b.createdAt - a.createdAt;
  });

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Sidebar List */}
      <div className="w-1/4 min-w-[250px] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col space-y-3 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-800 dark:text-white flex items-center">
                <span className="material-symbols-rounded mr-2">library_books</span>
                Notes
            </h2>
            <button 
                onClick={handleCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg shadow transition-all active:scale-95"
                title="Create New Note"
            >
                <span className="material-symbols-rounded text-sm">add</span>
            </button>
          </div>
          
          {/* Sort Control */}
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
             <span>Sort by:</span>
             <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
             >
                 <option value="updated">Last Updated</option>
                 <option value="created">Date Created</option>
             </select>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedNotes.length === 0 && (
            <div className="text-center mt-10 opacity-50">
                <span className="material-symbols-rounded text-4xl mb-2">note_add</span>
                <p className="text-sm">Create your first note</p>
            </div>
          )}
          {sortedNotes.map(note => (
            <div 
              key={note.id}
              onClick={() => setActiveNoteId(note.id)}
              className={`group p-3 rounded-lg cursor-pointer transition-all border ${
                activeNoteId === note.id 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm' 
                : 'hover:bg-slate-50 dark:hover:bg-slate-700 border-transparent'
              }`}
            >
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm">{note.title || "Untitled"}</h3>
              <div className="flex justify-between items-center mt-1">
                 <span className="text-[10px] text-slate-400">
                    {new Date(note.updatedAt).toLocaleDateString()}
                 </span>
                 <button
                    onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); if(activeNoteId === note.id) setActiveNoteId(null); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                  >
                    <span className="material-symbols-rounded text-sm">delete</span>
                  </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative">
        {activeNote ? (
          <>
            {/* Toolbar */}
            <div className={`p-2 border-b border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800 shadow-sm z-10 transition-all ${isPreviewMode ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center gap-1 flex-wrap w-full pb-1">
                    <input 
                        value={editingTitle}
                        onChange={handleTitleChange}
                        disabled={isPreviewMode}
                        className="bg-transparent font-bold text-lg text-slate-800 dark:text-white focus:outline-none px-2 mr-4 min-w-[200px]"
                        placeholder="Title"
                    />
                    
                    <button 
                        onClick={handleStudy}
                        className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity mr-4 shadow-sm"
                    >
                        <span className="material-symbols-rounded text-sm">auto_awesome</span>
                        <span>Ask AI</span>
                    </button>

                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-2"></div>
                    
                    <ToolbarBtn icon="format_bold" onAction={() => execCmd('bold')} isActive={formats.bold} title="Bold" />
                    <ToolbarBtn icon="format_italic" onAction={() => execCmd('italic')} isActive={formats.italic} title="Italic" />
                    <ToolbarBtn icon="format_underlined" onAction={() => execCmd('underline')} isActive={formats.underline} title="Underline" />
                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-2"></div>
                    
                    <ToolbarBtn icon="format_list_bulleted" onAction={() => execCmd('insertUnorderedList')} isActive={formats.listBullet} title="Bullet List" />
                    <ToolbarBtn icon="format_list_numbered" onAction={() => execCmd('insertOrderedList')} isActive={formats.listNumber} title="Numbered List" />
                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-2"></div>

                    {/* Highlighter */}
                    <div 
                        className="relative group"
                        onMouseEnter={() => setShowColorPicker(true)}
                        onMouseLeave={() => setShowColorPicker(false)}
                    >
                        <ToolbarBtn icon="ink_highlighter" onAction={() => execCmd('hiliteColor', '#fef08a')} title="Highlight" isActive={showColorPicker} />
                        {showColorPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 flex space-x-1 z-50 animate-fade-in w-max">
                                {COLORS.map(c => (
                                    <button 
                                        key={c.value} 
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => execCmd('hiliteColor', c.value)}
                                        className="w-6 h-6 rounded-full border border-slate-200 hover:scale-125 transition-transform"
                                        style={{ backgroundColor: c.value }}
                                        title={c.label}
                                    />
                                ))}
                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                <button 
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('hiliteColor', 'transparent')}
                                    className="flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                                    title="No Color"
                                >
                                    <span className="material-symbols-rounded text-sm">format_color_reset</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <ToolbarBtn icon="table" onAction={() => setShowTableModal(true)} title="Insert Custom Table" />
                    <ToolbarBtn icon="draw" onAction={() => setShowSketchPad(true)} title="Draw Sketch" />
                    
                    <div className="flex-1"></div>
                    
                    {/* Preview Toggle */}
                    <div className="pointer-events-auto">
                        <button 
                            onClick={() => setIsPreviewMode(!isPreviewMode)}
                            className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${isPreviewMode ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                            <span className="material-symbols-rounded text-sm">{isPreviewMode ? 'edit' : 'visibility'}</span>
                            <span>{isPreviewMode ? 'Edit' : 'Preview'}</span>
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2"></div>

                    <ToolbarBtn 
                        icon="find_replace" 
                        onAction={() => setShowFindReplace(!showFindReplace)} 
                        isActive={showFindReplace} 
                        title="Find & Replace" 
                    />
                </div>

                {/* Find & Replace Bar */}
                {showFindReplace && !isPreviewMode && (
                    <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 animate-fade-in bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                        <span className="text-xs font-bold text-slate-500 uppercase">Find:</span>
                        <input 
                            value={findText} 
                            onChange={(e) => setFindText(e.target.value)} 
                            className="px-2 py-1 text-sm border rounded bg-white text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-1 focus:ring-blue-500"
                            placeholder="Text to find..."
                        />
                        <button onClick={handleFindNext} className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 px-2 py-1 rounded">Next</button>
                        
                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-2"></div>
                        
                        <span className="text-xs font-bold text-slate-500 uppercase">Replace:</span>
                        <input 
                            value={replaceText} 
                            onChange={(e) => setReplaceText(e.target.value)} 
                            className="px-2 py-1 text-sm border rounded bg-white text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-1 focus:ring-blue-500"
                            placeholder="Replacement..."
                        />
                        <button onClick={handleReplace} className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 px-2 py-1 rounded">Replace</button>
                        <button onClick={handleReplaceAll} className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 px-2 py-1 rounded">All</button>
                        
                        <button onClick={() => setShowFindReplace(false)} className="ml-auto text-slate-400 hover:text-red-500">
                            <span className="material-symbols-rounded text-sm">close</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900 relative">
               {isPreviewMode ? (
                   <div 
                     className="editor-content max-w-3xl mx-auto text-slate-800 dark:text-slate-200 leading-relaxed text-lg"
                     dangerouslySetInnerHTML={{ __html: activeNote.content }}
                   />
               ) : (
                  <>
                    <div
                        ref={editorRef}
                        contentEditable
                        onInput={handleContentChange}
                        onKeyUp={checkFormatState}
                        onMouseUp={checkFormatState}
                        onClick={(e) => {
                             if (!selectedNode) editorRef.current?.focus();
                             handleEditorClick(e);
                        }}
                        className="editor-content outline-none max-w-3xl mx-auto text-slate-800 dark:text-slate-200 leading-relaxed text-lg min-h-[500px]"
                        data-placeholder="Start typing your notes here..."
                    />
                    
                    {/* Element Controls Overlay (Move/Resize/Delete) */}
                    {selectedNode && editorRef.current && (
                        <ElementControlOverlay 
                            element={selectedNode}
                            parent={editorRef.current}
                            onResizeStart={handleImgResizeMouseDown}
                            onMove={moveSelectedNode}
                            onDelete={deleteSelectedNode}
                        />
                    )}
                  </>
               )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900">
             <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-rounded text-5xl text-slate-400 dark:text-slate-600">edit_note</span>
             </div>
             <p className="text-lg font-medium">Select a note to view or edit</p>
          </div>
        )}

        {/* Table Builder Modal */}
        {showTableModal && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-80">
                    <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white flex items-center">
                        <span className="material-symbols-rounded mr-2">table</span> Insert Table
                    </h3>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Rows</label>
                            <input 
                                type="number" 
                                min="1" max="20"
                                value={tableRows}
                                onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                                className="w-full border rounded px-3 py-2 bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Columns</label>
                            <input 
                                type="number" 
                                min="1" max="10"
                                value={tableCols}
                                onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                                className="w-full border rounded px-3 py-2 bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setShowTableModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                        <button onClick={insertCustomTable} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Insert</button>
                    </div>
                </div>
            </div>
        )}

        {/* Sketch Pad Modal (Resizable) */}
        {showSketchPad && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-w-[95vw] max-h-[95vh]">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                            <span className="material-symbols-rounded mr-2">draw</span> Sketch Pad
                        </h3>
                        <div className="flex items-center space-x-4">
                             <div className="flex items-center space-x-1 text-xs text-slate-400">
                                <span>{previewDims ? previewDims.w : sketchDims.w}px</span>
                                <span>×</span>
                                <span>{previewDims ? previewDims.h : sketchDims.h}px</span>
                             </div>
                             <button onClick={() => setShowSketchPad(false)} className="text-slate-500 hover:text-red-500">
                                <span className="material-symbols-rounded">close</span>
                             </button>
                        </div>
                    </div>
                    
                    {/* Resizable Container */}
                    <div 
                        className="relative border border-slate-300 dark:border-slate-600 rounded bg-slate-100 dark:bg-slate-900/50 overflow-hidden shadow-inner flex-shrink-0"
                        style={{ 
                            width: previewDims ? previewDims.w : sketchDims.w, 
                            height: previewDims ? previewDims.h : sketchDims.h,
                            cursor: 'default' 
                        }}
                    >
                        <canvas 
                            ref={canvasRef}
                            width={previewDims ? previewDims.w : sketchDims.w}
                            height={previewDims ? previewDims.h : sketchDims.h}
                            className="bg-white cursor-crosshair touch-none w-full h-full block"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                        />
                        
                        {/* Resize Handle */}
                        <div 
                            onMouseDown={handleResizeStart}
                            onTouchStart={handleResizeStart}
                            className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 text-white flex items-center justify-center cursor-nwse-resize rounded-tl opacity-70 hover:opacity-100 z-10"
                        >
                            <span className="material-symbols-rounded text-sm">drag_handle</span>
                        </div>
                    </div>

                    <div className="flex justify-between mt-4">
                        <div className="text-xs text-slate-400 flex items-center">
                            <span className="material-symbols-rounded text-sm mr-1">info</span>
                            Drag corner to resize
                        </div>
                        <div className="space-x-2">
                            <button 
                                onClick={() => {
                                    const ctx = canvasRef.current?.getContext('2d');
                                    ctx?.clearRect(0, 0, sketchDims.w, sketchDims.h);
                                }}
                                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                Clear
                            </button>
                            <button 
                                onClick={saveSketch}
                                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                            >
                                Insert Sketch
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const ToolbarBtn = ({ icon, onAction, title, isActive = false }: { icon: string, onAction: () => void, title: string, isActive?: boolean }) => (
    <button 
        onMouseDown={(e) => {
            e.preventDefault(); 
            onAction();
        }}
        title={title}
        className={`p-2 rounded transition-colors flex-shrink-0 ${
            isActive 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' 
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
    >
        <span className="material-symbols-rounded text-[20px]">{icon}</span>
    </button>
);

// Advanced Overlay to move, delete, and resize content elements (Images/Tables)
const ElementControlOverlay = ({ 
    element, 
    parent, 
    onResizeStart,
    onMove,
    onDelete
}: { 
    element: HTMLElement, 
    parent: HTMLElement, 
    onResizeStart?: (e: React.MouseEvent) => void,
    onMove: (dir: 'up' | 'down') => void,
    onDelete: () => void
}) => {
    const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });

    const update = useCallback(() => {
        setRect({
            top: element.offsetTop,
            left: element.offsetLeft,
            width: element.offsetWidth,
            height: element.offsetHeight
        });
    }, [element]);

    useEffect(() => {
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        window.addEventListener('resize', update);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [element, update]);

    const isImg = element.tagName === 'IMG';

    return (
        <div 
            className="absolute border-2 border-blue-500 pointer-events-none element-controls transition-all duration-75 rounded-sm"
            style={{ 
                top: rect.top, 
                left: rect.left, 
                width: rect.width, 
                height: rect.height,
                zIndex: 50
            }}
        >
            {/* Action Toolbar */}
            <div className="absolute -top-12 right-0 flex space-x-1 pointer-events-auto bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-lg p-1 animate-pop">
                <button 
                    onMouseDown={(e) => { e.preventDefault(); onMove('up'); }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                    title="Move Up"
                >
                    <span className="material-symbols-rounded text-lg">arrow_upward</span>
                </button>
                <button 
                    onMouseDown={(e) => { e.preventDefault(); onMove('down'); }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                    title="Move Down"
                >
                    <span className="material-symbols-rounded text-lg">arrow_downward</span>
                </button>
                <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <button 
                    onMouseDown={(e) => { e.preventDefault(); onDelete(); }}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500"
                    title="Delete"
                >
                    <span className="material-symbols-rounded text-lg">delete</span>
                </button>
            </div>

            {/* Resize Handle (Images Only) */}
            {isImg && onResizeStart && (
                <div 
                    className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-nwse-resize pointer-events-auto shadow-sm border border-white"
                    onMouseDown={onResizeStart}
                />
            )}
            
            {/* Tag Label */}
            <div className="absolute -bottom-6 left-0 text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider opacity-80">
                {element.tagName}
            </div>
        </div>
    );
};

export default NotebookView;