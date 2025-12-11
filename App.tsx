import React, { useState, useEffect } from 'react';
import { AppView, Roadmap, UserStats, StudentProfile, Note, Badge } from './types';
import { StorageService } from './services/storageService';
import RoadmapView from './components/RoadmapView';
import LiveTutor from './components/LiveTutor';
import TextTutor from './components/TextTutor';
import ExamView from './components/ExamView';
import NotebookView from './components/NotebookView';
import Onboarding from './components/Onboarding';
import GamificationBar from './components/GamificationBar';
import ConceptBuilder from './components/ConceptBuilder';

// --- Badge Definitions ---
const BADGES: Badge[] = [
    {
        id: 'first_step',
        icon: '🌱',
        name: 'First Step',
        description: 'Complete your first roadmap topic.',
        condition: (stats) => stats.completedNodes >= 1
    },
    {
        id: 'scholar',
        icon: '🦉',
        name: 'Scholar',
        description: 'Earn 500 XP.',
        condition: (stats) => stats.xp >= 500
    },
    {
        id: 'streak_master',
        icon: '🔥',
        name: 'On Fire',
        description: 'Reach a 3-day streak.',
        condition: (stats) => stats.streak >= 3
    },
    {
        id: 'dedicated',
        icon: '⏳',
        name: 'Dedicated',
        description: 'Study for more than 1 hour total.',
        condition: (stats) => stats.studyTimeSeconds >= 3600
    },
    {
        id: 'expert',
        icon: '👑',
        name: 'Topic Expert',
        description: 'Complete 10 topics.',
        condition: (stats) => stats.completedNodes >= 10
    },
    {
        id: 'deep_thinker',
        icon: '🧠',
        name: 'Deep Thinker',
        description: 'Earn 2000 XP through Socratic dialogue.',
        condition: (stats) => stats.xp >= 2000
    }
];

const App: React.FC = () => {
  const [stats, setStats] = useState<UserStats>(StorageService.getStats());
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>(StorageService.getRoadmaps());
  const [notes, setNotes] = useState<Note[]>(StorageService.getNotes());
  
  // Initialize profile and view state synchronously to prevent flicker
  const [profile, setProfile] = useState<StudentProfile | null>(() => StorageService.getProfile());
  const [view, setView] = useState<AppView>(() => {
      const savedProfile = StorageService.getProfile();
      return savedProfile ? AppView.DASHBOARD : AppView.ONBOARDING;
  });

  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(StorageService.getTheme() === 'dark');
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success'|'error'|'info'}[]>([]);
  const [unlockedBadge, setUnlockedBadge] = useState<Badge | null>(null);
  
  // Context passing from Notebook to Chat
  const [studyContext, setStudyContext] = useState<string | null>(null);

  // Study Timer - Updates Total and Daily stats
  useEffect(() => {
      if (view === AppView.ONBOARDING) return;

      const timer = setInterval(() => {
          const today = new Date().toISOString().split('T')[0];
          setStats(prev => ({
              ...prev,
              studyTimeSeconds: prev.studyTimeSeconds + 1,
              dailyStudyTime: {
                  ...prev.dailyStudyTime,
                  [today]: (prev.dailyStudyTime?.[today] || 0) + 1
              }
          }));
      }, 1000);
      return () => clearInterval(timer);
  }, [view]);

  // Badge Unlocking Logic
  useEffect(() => {
      if (view === AppView.ONBOARDING) return;
      
      let newBadges: string[] = [];
      BADGES.forEach(badge => {
          if (!stats.badges.includes(badge.id) && badge.condition(stats)) {
              newBadges.push(badge.id);
              // Trigger Celebration
              setUnlockedBadge(badge);
              playSuccessSound();
          }
      });

      if (newBadges.length > 0) {
          setStats(prev => ({
              ...prev,
              badges: [...prev.badges, ...newBadges]
          }));
      }
  }, [stats.xp, stats.completedNodes, stats.studyTimeSeconds, stats.streak, view]);

  // Persistence Effects
  useEffect(() => StorageService.saveStats(stats), [stats]);
  useEffect(() => StorageService.saveRoadmaps(roadmaps), [roadmaps]);
  useEffect(() => StorageService.saveNotes(notes), [notes]);
  useEffect(() => {
      if(profile) StorageService.saveProfile(profile);
  }, [profile]);

  // Handle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      StorageService.saveTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      StorageService.saveTheme('light');
    }
  }, [isDarkMode]);

  const showToast = (message: string, type: 'success'|'error'|'info' = 'info') => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
  };

  const playSuccessSound = () => {
      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
      } catch (e) {
          // Ignore audio errors
      }
  };

  const addXp = (amount: number = 10) => {
    setStats(prev => ({ ...prev, xp: prev.xp + amount }));
  };

  const handleToggleNode = (roadmapId: string, nodeId: string) => {
    setRoadmaps(prev => prev.map(rm => {
      if (rm.id !== roadmapId) return rm;
      return {
        ...rm,
        nodes: rm.nodes.map(node => {
          if (node.id === nodeId) {
            const newCompleted = !node.completed;
            if (newCompleted) {
              setStats(s => ({ ...s, completedNodes: s.completedNodes + 1, xp: s.xp + 50 }));
              showToast("Topic Completed! +50 XP", "success");
            } else {
              setStats(s => ({ ...s, completedNodes: s.completedNodes - 1, xp: s.xp - 50 }));
            }
            return { ...node, completed: newCompleted };
          }
          return node;
        })
      };
    }));
  };

  const handleAddRoadmap = (rm: Roadmap) => {
    setRoadmaps(prev => [...prev, rm]);
    showToast("Roadmap Generated Successfully", "success");
  };

  const handleCompleteOnboarding = (newProfile: StudentProfile) => {
      setProfile(newProfile);
      StorageService.saveProfile(newProfile);
      setView(AppView.DASHBOARD);
      showToast("Welcome to your learning journey!", "success");
  };

  const handleAddNote = (note: Note) => {
      setNotes(prev => [note, ...prev]);
      showToast("Note Created", "success");
  };
  
  const handleUpdateNote = (note: Note) => setNotes(prev => prev.map(n => n.id === note.id ? note : n));
  const handleDeleteNote = (id: string) => {
      setNotes(prev => prev.filter(n => n.id !== id));
      showToast("Note Deleted", "info");
  };

  const handleStudyNote = (content: string) => {
      setStudyContext(content);
      setView(AppView.TUTOR_TEXT);
      showToast("Note sent to AI Tutor", "success");
  };

  const renderContent = () => {
    switch (view) {
      case AppView.ONBOARDING:
        return <Onboarding onComplete={handleCompleteOnboarding} />;
      case AppView.DASHBOARD:
        return (
          <div className="p-10 max-w-6xl mx-auto animate-fade-in pb-20 overflow-y-auto h-full scroll-smooth">
            <header className="mb-10">
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                    Welcome back, <span className="text-blue-600 dark:text-blue-400">{profile?.name}</span>!
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400">
                    Ready to continue your {profile?.educationLevel} studies?
                </p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardCard 
                title="Live Voice Tutor" 
                icon="mic" 
                desc="Real-time conversation for deep dives."
                color="from-indigo-500 to-purple-600"
                onClick={() => setView(AppView.TUTOR_LIVE)}
                fullWidth
              />

              <DashboardCard 
                title="Concept Builder" 
                icon="account_tree" 
                desc="Build knowledge graphs collaboratively."
                color="from-pink-500 to-rose-600"
                onClick={() => setView(AppView.CONCEPT_BUILDER)}
              />

              <DashboardCard 
                title="Exam Mode" 
                icon="assignment" 
                desc="Generate tests from your notes."
                color="from-emerald-500 to-teal-600"
                onClick={() => setView(AppView.EXAM)}
              />

              <DashboardCard 
                title="Notebook" 
                icon="library_books" 
                desc="Rich text notes with sketching."
                color="from-orange-400 to-red-500"
                onClick={() => setView(AppView.NOTEBOOK)}
              />

              <DashboardCard 
                title="Text Chat" 
                icon="forum" 
                desc="Socratic guidance via text."
                onClick={() => setView(AppView.TUTOR_TEXT)}
                light
              />

              <DashboardCard 
                title="My Roadmaps" 
                icon="map" 
                desc="Track your learning paths."
                onClick={() => setView(AppView.ROADMAP)}
                light
              />
            </div>
          </div>
        );
      case AppView.ROADMAP:
        return (
          <RoadmapView 
            roadmaps={roadmaps}
            activeRoadmapId={activeRoadmapId}
            onAddRoadmap={handleAddRoadmap}
            onSelectRoadmap={setActiveRoadmapId}
            onToggleNode={handleToggleNode}
          />
        );
      case AppView.TUTOR_LIVE:
        return <LiveTutor onXpGain={() => addXp(20)} />;
      case AppView.TUTOR_TEXT:
        return (
            <div className="h-full max-w-5xl mx-auto p-4">
                 <TextTutor 
                    onXpGain={() => addXp(10)} 
                    profile={profile}
                    onSaveToNotes={handleAddNote}
                    initialContext={studyContext}
                    onClearContext={() => setStudyContext(null)}
                 />
            </div>
        );
      case AppView.CONCEPT_BUILDER:
        return <ConceptBuilder profile={profile} onXpGain={() => addXp(15)} />;
      case AppView.EXAM:
        return <ExamView onXpGain={addXp} profile={profile} />;
      case AppView.NOTEBOOK:
        return (
            <NotebookView 
                notes={notes} 
                onAddNote={handleAddNote}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
                onStudyNote={handleStudyNote}
            />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {view !== AppView.ONBOARDING && (
        <GamificationBar stats={stats} profile={profile} badges={BADGES} />
      )}
      
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar (Desktop) - Hide on Onboarding */}
        {view !== AppView.ONBOARDING && (
          <nav className="hidden md:flex flex-col w-20 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 py-6 items-center space-y-6 z-10 transition-colors shadow-sm">
             <NavButton view={AppView.DASHBOARD} current={view} icon="dashboard" onClick={setView} label="Dashboard" />
             <NavButton view={AppView.CONCEPT_BUILDER} current={view} icon="account_tree" onClick={setView} label="Concepts" />
             <NavButton view={AppView.ROADMAP} current={view} icon="map" onClick={setView} label="Roadmaps" />
             <NavButton view={AppView.EXAM} current={view} icon="assignment" onClick={setView} label="Exam" />
             <NavButton view={AppView.NOTEBOOK} current={view} icon="library_books" onClick={setView} label="Notebook" />
             <NavButton view={AppView.TUTOR_TEXT} current={view} icon="forum" onClick={setView} label="Chat" />
             <NavButton view={AppView.TUTOR_LIVE} current={view} icon="mic" onClick={setView} label="Live" />

             <div className="flex-1"></div>

             <button 
               onClick={() => setIsDarkMode(!isDarkMode)}
               className="p-3 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
               title="Toggle Dark Mode"
             >
                <span className="material-symbols-rounded">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
             </button>
          </nav>
        )}

        <main className="flex-1 overflow-hidden relative">
          {renderContent()}
          
          {/* Celebration Overlay */}
          {unlockedBadge && (
              <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setUnlockedBadge(null)}>
                  <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl transform scale-100 animate-pop max-w-sm w-full border-4 border-yellow-400 relative overflow-hidden">
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                          <div className="absolute top-0 left-1/2 w-4 h-4 bg-red-500 rounded-full animate-[confetti_2s_ease-out_infinite] delay-100"></div>
                          <div className="absolute top-0 left-1/4 w-4 h-4 bg-blue-500 rounded-full animate-[confetti_2.5s_ease-out_infinite] delay-300"></div>
                          <div className="absolute top-0 right-1/4 w-4 h-4 bg-green-500 rounded-full animate-[confetti_1.8s_ease-out_infinite] delay-500"></div>
                      </div>
                      
                      <div className="text-6xl mb-4 animate-bounce-slow">{unlockedBadge.icon}</div>
                      <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-wide">Unlocked!</h2>
                      <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-4 py-1 rounded-full text-xs font-bold inline-block mb-4">New Badge</div>
                      <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">{unlockedBadge.name}</h3>
                      <p className="text-slate-500 dark:text-slate-400 mb-6">{unlockedBadge.description}</p>
                      
                      <button 
                        onClick={() => setUnlockedBadge(null)}
                        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3 px-8 rounded-xl hover:scale-105 transition-transform"
                      >
                          Awesome!
                      </button>
                  </div>
              </div>
          )}

          {/* Global Toast Container */}
          <div className="absolute bottom-6 right-6 z-[100] flex flex-col space-y-2 pointer-events-none">
              {toasts.map(toast => (
                  <div 
                    key={toast.id} 
                    className={`px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-fade-in pointer-events-auto backdrop-blur-md ${
                        toast.type === 'success' ? 'bg-green-500/90 text-white' : 
                        toast.type === 'error' ? 'bg-red-500/90 text-white' : 
                        'bg-slate-800/90 text-white'
                    }`}
                  >
                      <span className="material-symbols-rounded text-lg">
                          {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
                      </span>
                      <span className="font-medium text-sm">{toast.message}</span>
                  </div>
              ))}
          </div>
        </main>
      </div>
    </div>
  );
};

// --- Sub Components ---

const NavButton = ({ view, current, icon, onClick, label }: any) => (
    <button 
        onClick={() => onClick(view)}
        className={`p-3 rounded-xl transition-all group relative flex justify-center items-center w-full overflow-hidden ${current === view ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
        title={label}
    >
        <span className="material-symbols-rounded text-2xl overflow-hidden whitespace-nowrap">{icon}</span>
        {/* Tooltip */}
        <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {label}
        </span>
    </button>
);

const DashboardCard = ({ title, icon, desc, color, onClick, fullWidth, light }: any) => (
    <div 
        onClick={onClick}
        className={`rounded-2xl p-8 shadow-lg cursor-pointer hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden ${
            light 
            ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 hover:shadow-xl' 
            : `bg-gradient-to-br ${color} text-white`
        } ${fullWidth ? 'col-span-1 md:col-span-2 lg:col-span-1' : ''}`}
    >
        <div className={`text-5xl mb-4 ${light ? 'text-slate-300 group-hover:text-blue-500 transition-colors' : 'text-white/80'} overflow-hidden`}>
            <span className="material-symbols-rounded block" style={{ fontSize: '48px' }}>{icon}</span>
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${light ? 'text-slate-800 dark:text-white' : 'text-white'}`}>{title}</h2>
        <p className={`${light ? 'text-slate-500 dark:text-slate-400' : 'text-white/80'}`}>{desc}</p>
        
        {/* Decoration */}
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500"></div>
    </div>
);

export default App;