import { UserStats, Roadmap, Note, ChatSession, StudentProfile, StudentMemory } from '../types';

const KEYS = {
  STATS: 'socratic_stats',
  ROADMAPS: 'socratic_roadmaps',
  NOTES: 'socratic_notes',
  PROFILE: 'socratic_profile',
  CHATS: 'socratic_chats',
  THEME: 'socratic_theme',
  MEMORY: 'socratic_memory'
};

/**
 * A persistent local storage service acting as a database for the user.
 */
export class StorageService {
  
  // --- Profile ---
  static saveProfile(profile: StudentProfile) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  }

  static getProfile(): StudentProfile | null {
    const data = localStorage.getItem(KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  }

  // --- Student Memory (Socratic Memory Bank) ---
  static saveMemory(memory: StudentMemory) {
    localStorage.setItem(KEYS.MEMORY, JSON.stringify(memory));
  }

  static getMemory(): StudentMemory {
    const data = localStorage.getItem(KEYS.MEMORY);
    return data ? JSON.parse(data) : { misconceptions: [], strengths: [] };
  }

  static addMisconception(concept: string) {
    const mem = this.getMemory();
    if (!mem.misconceptions.includes(concept)) {
      mem.misconceptions.push(concept);
      this.saveMemory(mem);
    }
  }

  // --- Stats & Streak Logic ---
  static saveStats(stats: UserStats) {
    localStorage.setItem(KEYS.STATS, JSON.stringify(stats));
  }

  static getStats(): UserStats {
    const data = localStorage.getItem(KEYS.STATS);
    let stats: UserStats;
    
    if (data) {
        stats = JSON.parse(data);
        if (!stats.badges) stats.badges = [];
        if (!stats.dailyStudyTime) stats.dailyStudyTime = {};
    } else {
        stats = {
          xp: 0,
          streak: 1,
          lastLoginDate: new Date().toISOString().split('T')[0],
          completedNodes: 0,
          studyTimeSeconds: 0,
          dailyStudyTime: {},
          badges: []
        };
    }

    // Check Streak Logic on Load
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = stats.lastLoginDate;

    if (lastLogin !== today) {
        const lastDate = new Date(lastLogin);
        const currentDate = new Date(today);
        const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 1) {
            // Consecutive day
            stats.streak += 1;
        } else if (diffDays > 1) {
            // Missed a day
            stats.streak = 1;
        }
        // If diffDays is 0 (same day), do nothing

        stats.lastLoginDate = today;
        this.saveStats(stats);
    }

    return stats;
  }

  // --- Roadmaps ---
  static saveRoadmaps(roadmaps: Roadmap[]) {
    localStorage.setItem(KEYS.ROADMAPS, JSON.stringify(roadmaps));
  }

  static getRoadmaps(): Roadmap[] {
    const data = localStorage.getItem(KEYS.ROADMAPS);
    return data ? JSON.parse(data) : [];
  }

  // --- Notes ---
  static saveNotes(notes: Note[]) {
    localStorage.setItem(KEYS.NOTES, JSON.stringify(notes));
  }

  static getNotes(): Note[] {
    const data = localStorage.getItem(KEYS.NOTES);
    return data ? JSON.parse(data) : [];
  }

  // --- Chat History ---
  static saveChatSessions(sessions: ChatSession[]) {
    localStorage.setItem(KEYS.CHATS, JSON.stringify(sessions));
  }

  static getChatSessions(): ChatSession[] {
    const data = localStorage.getItem(KEYS.CHATS);
    return data ? JSON.parse(data) : [];
  }

  static createNewChatSession(): string {
      const sessions = this.getChatSessions();
      const newId = crypto.randomUUID();
      const newSession: ChatSession = {
          id: newId,
          title: 'New Chat',
          messages: [],
          lastUpdated: Date.now()
      };
      sessions.unshift(newSession);
      this.saveChatSessions(sessions);
      return newId;
  }

  static deleteChatSession(sessionId: string) {
      let sessions = this.getChatSessions();
      sessions = sessions.filter(s => s.id !== sessionId);
      this.saveChatSessions(sessions);
  }

  static saveCurrentChat(messages: any[], sessionId: string) {
    const sessions = this.getChatSessions();
    const existingIndex = sessions.findIndex(s => s.id === sessionId);
    
    // Create a title based on first user message if available
    let title = "New Chat";
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) title = firstUserMsg.text.substring(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');

    const newSession: ChatSession = {
        id: sessionId,
        title,
        messages,
        lastUpdated: Date.now()
    };

    if (existingIndex >= 0) {
        sessions[existingIndex] = newSession;
    } else {
        sessions.push(newSession);
    }
    this.saveChatSessions(sessions);
  }

  // --- Theme ---
  static getTheme(): 'dark' | 'light' {
    return (localStorage.getItem(KEYS.THEME) as 'dark' | 'light') || 'light';
  }

  static saveTheme(theme: 'dark' | 'light') {
    localStorage.setItem(KEYS.THEME, theme);
  }
}