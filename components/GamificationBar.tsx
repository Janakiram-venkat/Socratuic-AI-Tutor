import React, { useEffect, useState } from 'react';
import { UserStats, StudentProfile, Badge } from '../types';

interface Props {
  stats: UserStats;
  profile: StudentProfile | null;
  badges: Badge[];
}

const GamificationBar: React.FC<Props> = ({ stats, profile, badges }) => {
  const [showProfile, setShowProfile] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showStreakTooltip, setShowStreakTooltip] = useState(false);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
  };

  const formatDetailedTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h} hrs ${m} mins`;
  }

  // Generate mini calendar days for tooltip
  const getStreakDays = () => {
      const days = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          days.push({
              day: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
              active: i < stats.streak // Simplified visual logic
          });
      }
      return days;
  };

  // Generate chart data for last 7 days
  const getChartData = () => {
      const days = [];
      const today = new Date();
      let maxVal = 0;
      
      for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const val = stats.dailyStudyTime?.[dateStr] || 0;
          if (val > maxVal) maxVal = val;
          
          days.push({
              label: d.toLocaleDateString('en-US', { weekday: 'short' }),
              value: val,
              date: dateStr
          });
      }
      return { days, maxVal: maxVal || 1 }; // Avoid divide by zero
  };

  return (
    <>
      <div className="flex items-center space-x-6 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 shadow-sm transition-colors overflow-x-auto relative z-30 min-h-[70px]">
        
        {/* Streak Item */}
        <div 
            className="flex items-center space-x-3 group relative cursor-pointer"
            onMouseEnter={() => setShowStreakTooltip(true)}
            onMouseLeave={() => setShowStreakTooltip(false)}
        >
          <div className="relative">
              <span className="text-3xl filter drop-shadow-md animate-bounce-slow inline-block origin-bottom transform group-hover:scale-110 transition-transform">🔥</span>
              <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Streak</span>
            <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 dark:from-orange-400 dark:to-red-500">
                {stats.streak} Days
            </span>
          </div>

          {/* Streak Tooltip */}
          {showStreakTooltip && (
              <div className="absolute top-12 left-0 z-50 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-48 animate-fade-in">
                  <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Last 7 Days</p>
                  <div className="flex justify-between">
                      {getStreakDays().map((d, idx) => (
                          <div key={idx} className="flex flex-col items-center">
                              <div className={`w-4 h-4 rounded-full mb-1 ${d.active ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                              <span className="text-[10px] text-slate-400">{d.day}</span>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>

        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>

        <div className="flex items-center space-x-3">
          <span className="text-3xl filter drop-shadow-md">⚡</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">XP</span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400">{stats.xp} PTS</span>
          </div>
        </div>

        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>

        <div className="flex items-center space-x-3">
          <span className="text-3xl filter drop-shadow-md">🎓</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mastered</span>
            <span className="text-lg font-black text-green-600 dark:text-green-400">{stats.completedNodes} Topics</span>
          </div>
        </div>

        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 ml-auto hidden md:block"></div>

        {/* Statistics Button */}
        <button 
            onClick={() => setShowStatsModal(true)}
            className="hidden md:flex items-center space-x-3 ml-auto hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-xl transition-colors group"
            title="View Statistics"
        >
          <div className="relative">
              <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform block">📊</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stats</span>
            <span className="text-lg font-mono font-bold text-slate-700 dark:text-slate-300">
                View
            </span>
          </div>
        </button>

        <button 
            onClick={() => setShowProfile(true)}
            className="ml-4 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xl border-4 border-white dark:border-slate-800 shadow-lg hover:scale-105 transition-transform"
            title="View Profile"
        >
            {profile ? profile.name.charAt(0).toUpperCase() : '?'}
        </button>
      </div>

      {/* Stats Modal */}
      {showStatsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden transform scale-100 transition-all">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <span className="material-symbols-rounded text-blue-500">monitoring</span>
                          Study Statistics
                      </h2>
                      <button onClick={() => setShowStatsModal(false)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-full p-2 shadow-sm hover:shadow-md transition-all">
                          <span className="material-symbols-rounded">close</span>
                      </button>
                  </div>
                  
                  <div className="p-8">
                      <div className="flex justify-between items-end mb-8">
                          <div>
                              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Study Time</p>
                              <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{formatDetailedTime(stats.studyTimeSeconds)}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-xs text-slate-400">Keep it up!</p>
                          </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-700/30 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50">
                          <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-6 flex items-center gap-2">
                              <span className="material-symbols-rounded text-sm">bar_chart</span>
                              Daily Activity (Last 7 Days)
                          </h4>
                          
                          {/* CSS Bar Chart */}
                          <div className="flex items-end justify-between h-40 gap-2">
                              {(() => {
                                  const { days, maxVal } = getChartData();
                                  return days.map((d, i) => (
                                      <div key={i} className="flex flex-col items-center flex-1 group relative">
                                          {/* Tooltip */}
                                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10">
                                              {formatTime(d.value)}
                                          </div>
                                          
                                          {/* Bar */}
                                          <div 
                                            className="w-full bg-blue-200 dark:bg-blue-900/40 rounded-t-md relative overflow-hidden transition-all duration-500 ease-out hover:bg-blue-300 dark:hover:bg-blue-800/60"
                                            style={{ height: `${(d.value / maxVal) * 100}%`, minHeight: '4px' }}
                                          >
                                              <div className="absolute bottom-0 left-0 w-full bg-blue-500 opacity-20 h-full"></div>
                                          </div>
                                          
                                          {/* Label */}
                                          <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{d.label}</span>
                                      </div>
                                  ));
                              })()}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto transform scale-100 transition-all">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 rounded-t-3xl">
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white">Student Profile</h2>
                      <button onClick={() => setShowProfile(false)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-full p-2 shadow-sm hover:shadow-md transition-all">
                          <span className="material-symbols-rounded">close</span>
                      </button>
                  </div>
                  
                  <div className="p-8">
                      <div className="flex items-center space-x-6 mb-10">
                          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-4xl font-bold shadow-xl ring-4 ring-blue-50 dark:ring-blue-900/20">
                              {profile?.name.charAt(0)}
                          </div>
                          <div>
                              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{profile?.name}</h3>
                              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">{profile?.educationLevel} Student</p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                  {profile?.subjects.map(s => (
                                      <span key={s} className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide">
                                          {s}
                                      </span>
                                  ))}
                              </div>
                          </div>
                      </div>

                      <div className="mb-10">
                          <h4 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-4 flex items-center">
                              <span className="material-symbols-rounded mr-2">emoji_events</span>
                              Achievements & Badges
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {badges.map(badge => {
                                  const isUnlocked = stats.badges.includes(badge.id);
                                  return (
                                      <div 
                                        key={badge.id}
                                        className={`p-4 rounded-2xl border flex flex-col items-center text-center transition-all duration-300 ${
                                            isUnlocked 
                                            ? 'bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/10 dark:to-slate-800 border-yellow-200 dark:border-yellow-700 shadow-md transform hover:-translate-y-1' 
                                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 opacity-50 grayscale hover:opacity-70'
                                        }`}
                                      >
                                          <div className={`text-4xl mb-3 ${isUnlocked ? 'animate-pop' : ''}`}>{badge.icon}</div>
                                          <p className={`font-bold text-sm ${isUnlocked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>{badge.name}</p>
                                          <p className="text-[10px] text-slate-400 mt-1 leading-tight">{badge.description}</p>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-700/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center space-x-2 mb-1">
                                  <span className="material-symbols-rounded text-slate-400">timer</span>
                                  <p className="text-slate-500 text-xs uppercase font-bold tracking-wider">Total Study Time</p>
                              </div>
                              <p className="text-2xl font-mono font-bold text-slate-800 dark:text-white">{formatTime(stats.studyTimeSeconds)}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center space-x-2 mb-1">
                                  <span className="material-symbols-rounded text-slate-400">check_circle</span>
                                  <p className="text-slate-500 text-xs uppercase font-bold tracking-wider">Topics Mastered</p>
                              </div>
                              <p className="text-2xl font-mono font-bold text-slate-800 dark:text-white">{stats.completedNodes}</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default GamificationBar;