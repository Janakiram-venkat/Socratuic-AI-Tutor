import React, { useState, useRef, useEffect } from 'react';
import { sendTextMessage, playTextToSpeech } from '../services/geminiService';
import { StorageService } from '../services/storageService';
import { ChatMessage, SocraticLevel, StudentProfile, Note, ChatSession } from '../types';
import { FormattedText } from './FormattedText';

interface Props {
  onXpGain: () => void;
  profile: StudentProfile | null;
  onSaveToNotes: (note: Note) => void;
  initialContext?: string | null;
  onClearContext?: () => void;
}

const TextTutor: React.FC<Props> = ({ onXpGain, profile, onSaveToNotes, initialContext, onClearContext }) => {
  // State for session management
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<SocraticLevel>(SocraticLevel.MEDIUM);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  
  // Formatting State
  const [formats, setFormats] = useState({ bold: false, italic: false });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize: Load sessions
  useEffect(() => {
    const loadedSessions = StorageService.getChatSessions();
    const sorted = loadedSessions.sort((a, b) => b.lastUpdated - a.lastUpdated);
    setSessions(sorted);
    
    if (sorted.length > 0) {
        // Load most recent
        const recent = sorted[0];
        setCurrentSessionId(recent.id);
        setMessages(recent.messages);
    } else {
        // Create first session
        const newId = StorageService.createNewChatSession();
        setSessions(StorageService.getChatSessions());
        setCurrentSessionId(newId);
        setMessages([{ 
            id: 'init', 
            role: 'model', 
            text: `Hello ${profile?.name || 'there'}! I am your Socratic Tutor. What topic shall we explore today?`,
            timestamp: Date.now()
        }]);
    }
  }, []); // Run once on mount

  // Handle Initial Context from Notebook
  useEffect(() => {
    if (initialContext && currentSessionId) {
        // Create a new session if specific context is passed to ensure clean slate contextually
        if (messages.length > 5) {
            createNewSession();
        }

        // Programmatically send the message
        setTimeout(() => {
            const contextMsg = `I need help understanding these notes:\n\n${initialContext}`;
            handleSend(contextMsg);
            if (onClearContext) onClearContext();
        }, 500);
    }
  }, [initialContext, currentSessionId]);

  // Switch Session
  const switchSession = (sessionId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
          setCurrentSessionId(sessionId);
          setMessages(session.messages);
          setShowHistory(false); // Close sidebar on mobile
      }
  };

  // Create New Session
  const createNewSession = (skipSave = false) => {
      // If we are creating a new session from an existing valid one, save the progress first
      if (!skipSave && currentSessionId && messages.length > 0) {
           StorageService.saveCurrentChat(messages, currentSessionId);
      }

      const newId = StorageService.createNewChatSession();
      const newInitMsg: ChatMessage = { 
        id: `init-${newId}`, 
        role: 'model', 
        text: `Starting a fresh session. What's on your mind?`,
        timestamp: Date.now()
      };
      
      setCurrentSessionId(newId);
      setMessages([newInitMsg]);
      setSessions(StorageService.getChatSessions().sort((a,b) => b.lastUpdated - a.lastUpdated)); // Refresh list
      setShowHistory(false);
  };
  
  // Delete Session
  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      e.preventDefault(); // Prevent accidental selection
      
      if (confirm("Delete this chat?")) {
          // 1. Delete from storage
          StorageService.deleteChatSession(sessionId);
          
          // 2. Update local state immediately for responsiveness
          const updatedSessions = sessions.filter(s => s.id !== sessionId);
          setSessions(updatedSessions);
          
          // 3. If we deleted the active session, we need to navigate
          if (sessionId === currentSessionId) {
              if (updatedSessions.length > 0) {
                  // Switch to the most recent remaining session
                  const nextSession = updatedSessions[0];
                  setCurrentSessionId(nextSession.id);
                  setMessages(nextSession.messages);
              } else {
                  // If no sessions left, create a new one (skipping save of the deleted one)
                  createNewSession(true);
              }
          }
      }
  };

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // Persist Current Chat
  useEffect(() => {
     if (messages.length > 0 && currentSessionId) {
         // Only save if the session actually exists in our list (prevents saving deleted sessions if race condition occurs)
         // Note: We skip this check for new sessions as they are added to list via createNewSession or saveCurrentChat logic
         StorageService.saveCurrentChat(messages, currentSessionId);
         
         // Update the local list title without reloading everything
         setSessions(prev => prev.map(s => {
             if (s.id === currentSessionId) {
                 // Update title dynamically based on first user message
                 let title = s.title;
                 const firstUserMsg = messages.find(m => m.role === 'user');
                 if (firstUserMsg && (s.title === 'New Chat' || !s.title)) {
                     title = firstUserMsg.text.substring(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
                 }
                 return { ...s, messages, title, lastUpdated: Date.now() };
             }
             return s;
         }).sort((a, b) => b.lastUpdated - a.lastUpdated));
     }
  }, [messages, currentSessionId]);

  const getInputContent = () => {
      if (!inputRef.current) return '';
      return inputRef.current.innerText;
  };

  const handleSend = async (manualText?: string) => {
    const text = manualText || getInputContent();
    if (!text.trim() && !selectedImage) return;
    
    const userMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'user', 
        text: text,
        image: selectedImage || undefined,
        timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    
    // Clear Input
    if (inputRef.current) inputRef.current.innerHTML = '';
    setInputText('');
    setSelectedImage(null);
    setLoading(true);

    try {
      // For simplified history, we construct the prompt with text history + current multimodal message
      const history = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }] // Simplified text history
      }));

      const responseText = await sendTextMessage(history, userMsg.text, userMsg.image, level, profile || undefined);
      
      const botMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: responseText || "I'm thinking...",
        timestamp: Date.now() 
      };
      
      setMessages(prev => [...prev, botMsg]);
      onXpGain(); 

    } catch (e) {
      setMessages(prev => [...prev, { id: 'err', role: 'model', text: "I encountered an error. Please try again.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              setSelectedImage(base64);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveNote = (text: string) => {
    try {
        onSaveToNotes({
            id: crypto.randomUUID(),
            title: `Chat Note - ${new Date().toLocaleTimeString()}`,
            content: `<p><strong>Saved from Chat:</strong></p><blockquote>${text.replace(/\n/g, '<br/>')}</blockquote>`,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        
        const toast = document.createElement('div');
        toast.textContent = "✅ Saved to Notebook";
        toast.className = "fixed bottom-20 right-10 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in z-50";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
        
    } catch(e) {
        console.error(e);
        alert("Failed to save note.");
    }
  };

  // --- Formatting Helpers ---
  const checkFormatState = () => {
      setFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
      });
  };

  const execCmd = (command: string, value?: string) => {
      document.execCommand(command, false, value);
      if (inputRef.current) inputRef.current.focus();
      checkFormatState();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
      }
      checkFormatState(); // Check on keypress (e.g. arrow keys)
  };
  
  const handleInput = () => {
      if (inputRef.current) setInputText(inputRef.current.innerText);
  };

  return (
    <div className="flex h-full bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
      
      {/* History Sidebar */}
      <div className={`${showHistory ? 'w-64' : 'w-0'} transition-all duration-300 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">History</span>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-rounded">close_fullscreen</span>
              </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map(s => (
                  <div 
                    key={s.id}
                    onClick={() => switchSession(s.id)}
                    className={`group p-3 rounded-lg cursor-pointer text-sm truncate flex justify-between items-center ${currentSessionId === s.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                  >
                      <span className="truncate flex-1">{s.title || 'New Chat'}</span>
                      <button 
                        onClick={(e) => deleteSession(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 ml-2 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                        title="Delete Chat"
                      >
                          <span className="material-symbols-rounded text-[18px]">delete</span>
                      </button>
                  </div>
              ))}
          </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center space-x-2">
                <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
                    title="Toggle History"
                >
                    <span className="material-symbols-rounded">dock_to_right</span>
                </button>
                <span className="material-symbols-rounded text-blue-600 dark:text-blue-400">forum</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider hidden sm:inline">Chat Session</span>
            </div>
            
            {/* Right Controls */}
            <div className="flex items-center space-x-4">
                <button 
                    type="button"
                    onClick={() => createNewSession(false)} 
                    className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <span className="material-symbols-rounded text-sm mr-1">add_circle</span> New Chat
                </button>
                <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline font-medium">Mode:</span>
                    <select 
                        value={level}
                        onChange={(e) => setLevel(e.target.value as SocraticLevel)}
                        className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer min-w-[140px]"
                    >
                        <option value={SocraticLevel.EASY}>Easy (Guided)</option>
                        <option value={SocraticLevel.MEDIUM}>Medium (Standard)</option>
                        <option value={SocraticLevel.HARD}>Hard (Deep Dive)</option>
                        <option value={SocraticLevel.RESEARCH}>Research (Curiosity)</option>
                        <option value={SocraticLevel.EMOTION_ADAPTIVE}>Emotion Adaptive</option>
                        <option value={SocraticLevel.DECOMPOSITION}>Task Decomposition</option>
                        <option value={SocraticLevel.WRONG_FIRST}>Wrong Answers First</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
            {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                className={`max-w-[85%] p-4 rounded-2xl shadow-sm relative group transition-all ${
                    msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                }`}
                >
                {/* Image Rendering */}
                {msg.image && (
                    <div className="mb-3">
                        <img src={`data:image/jpeg;base64,${msg.image}`} alt="Uploaded content" className="max-w-full h-auto rounded-lg max-h-60 object-contain bg-black/20" />
                    </div>
                )}
                
                <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                    <FormattedText text={msg.text} />
                </div>
                
                {msg.role === 'model' && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex space-x-4 justify-end">
                        <button 
                            onClick={() => playTextToSpeech(msg.text)}
                            className="text-xs flex items-center space-x-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Listen"
                        >
                            <span className="material-symbols-rounded text-lg">volume_up</span>
                        </button>

                        <button 
                            onClick={() => handleSaveNote(msg.text)}
                            className="text-xs flex items-center space-x-1 text-slate-400 hover:text-green-600 dark:hover:text-green-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Save to Notes"
                        >
                            <span className="material-symbols-rounded text-lg">bookmark_add</span>
                        </button>
                    </div>
                )}
                </div>
            </div>
            ))}
            {loading && (
            <div className="flex justify-start animate-fade-in">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl rounded-bl-none flex space-x-2 items-center shadow-sm">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                </div>
            </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
            <div className="relative max-w-4xl mx-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                
                {/* Image Preview */}
                {selectedImage && (
                    <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 animate-pop">
                        <div className="relative">
                            <img src={`data:image/jpeg;base64,${selectedImage}`} alt="Preview" className="h-20 w-auto rounded" />
                            <button 
                                onClick={() => setSelectedImage(null)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                            >
                                <span className="material-symbols-rounded text-[14px]">close</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Toolbar */}
                <div className="flex items-center px-2 pt-2 pb-1 border-b border-slate-100 dark:border-slate-700/50 gap-1">
                     <button 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => execCmd('bold')} 
                        className={`p-1.5 rounded transition-colors ${formats.bold ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`} 
                        title="Bold"
                     >
                        <span className="material-symbols-rounded text-[18px]">format_bold</span>
                     </button>
                     <button 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => execCmd('italic')} 
                        className={`p-1.5 rounded transition-colors ${formats.italic ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`} 
                        title="Italic"
                     >
                        <span className="material-symbols-rounded text-[18px]">format_italic</span>
                     </button>
                     
                     <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                     <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Upload Image">
                        <span className="material-symbols-rounded text-[18px]">add_a_photo</span>
                     </button>
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageSelect}
                     />
                </div>

                <div className="flex items-end p-2">
                    <div
                        ref={inputRef}
                        contentEditable
                        onKeyDown={handleKeyDown}
                        onInput={handleInput}
                        onMouseUp={checkFormatState}
                        onClick={checkFormatState}
                        className="flex-1 max-h-40 min-h-[44px] bg-transparent border-none focus:outline-none text-slate-800 dark:text-white overflow-y-auto py-2 px-2 editor-content"
                        data-placeholder="Ask a question..."
                        role="textbox"
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!inputText.trim() && !selectedImage}
                        className="ml-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition-all shadow-md active:scale-95 flex-shrink-0"
                    >
                        <span className="material-symbols-rounded">send</span>
                    </button>
                </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
                {level === SocraticLevel.RESEARCH ? 'Research Mode Active: I will provide detailed insights and sources.' : 
                 level === SocraticLevel.EMOTION_ADAPTIVE ? 'Adaptive Mode: I will adjust my tone based on your feelings.' :
                 'Socratic Mode Active: I will guide you, not give answers.'}
            </p>
        </div>
      </div>
    </div>
  );
};

export default TextTutor;