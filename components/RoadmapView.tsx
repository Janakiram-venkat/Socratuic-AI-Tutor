import React, { useState } from 'react';
import { Roadmap } from '../types';
import { generateRoadmap } from '../services/geminiService';

interface Props {
  roadmaps: Roadmap[];
  activeRoadmapId: string | null;
  onAddRoadmap: (roadmap: Roadmap) => void;
  onSelectRoadmap: (id: string) => void;
  onToggleNode: (roadmapId: string, nodeId: string) => void;
}

const RoadmapView: React.FC<Props> = ({ 
  roadmaps, 
  activeRoadmapId, 
  onAddRoadmap, 
  onSelectRoadmap,
  onToggleNode 
}) => {
  const [topicInput, setTopicInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!topicInput.trim()) return;
    setLoading(true);
    try {
      const roadmap = await generateRoadmap(topicInput);
      onAddRoadmap(roadmap);
      onSelectRoadmap(roadmap.id);
      setTopicInput('');
    } catch (e) {
      alert("Failed to generate roadmap. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const activeRoadmap = roadmaps.find(r => r.id === activeRoadmapId);

  const calculateProgress = (rm: Roadmap) => {
      if (rm.nodes.length === 0) return 0;
      return (rm.nodes.filter(n => n.completed).length / rm.nodes.length) * 100;
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Sidebar List */}
      <div className="w-1/3 max-w-xs border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col transition-colors z-10">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
            <span className="material-symbols-rounded mr-2">school</span>
            My Paths
        </h2>
        <div className="flex space-x-2 mb-6">
          <input 
            type="text" 
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="New Topic (e.g., Physics)"
            className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button 
            onClick={handleCreate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center min-w-[40px]"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <span className="material-symbols-rounded">add</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {roadmaps.length === 0 && (
            <div className="text-center mt-10 p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                <p className="text-slate-400 text-sm">No roadmaps yet.</p>
                <p className="text-xs text-slate-400 mt-1">Create one to start learning!</p>
            </div>
          )}
          {roadmaps.map(rm => (
            <button
              key={rm.id}
              onClick={() => onSelectRoadmap(rm.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden group ${
                activeRoadmapId === rm.id 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' 
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex justify-between items-center mb-2 relative z-10">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{rm.topic}</h3>
                  {calculateProgress(rm) === 100 && <span className="text-green-500 material-symbols-rounded text-sm">check_circle</span>}
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 relative z-10">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${calculateProgress(rm)}%` }}
                ></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 p-8 overflow-y-auto bg-slate-50 dark:bg-slate-900 relative">
        {activeRoadmap ? (
          <div className="max-w-3xl mx-auto">
            <header className="mb-8">
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">{activeRoadmap.topic}</h1>
                <div className="flex items-center space-x-4">
                    <p className="text-slate-500 dark:text-slate-400 flex items-center">
                        <span className="material-symbols-rounded text-sm mr-1">auto_awesome</span>
                        AI Generated Roadmap
                    </p>
                    {calculateProgress(activeRoadmap) === 100 && (
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pop">
                            Completed
                        </span>
                    )}
                </div>
            </header>

            {/* Interactive Progress Bar */}
            <div className="mb-12 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 sticky top-0 z-20">
                <div className="flex justify-between text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                    <span>Progress</span>
                    <span>{Math.round(calculateProgress(activeRoadmap))}%</span>
                </div>
                <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-1000 ease-out relative"
                        style={{ width: `${calculateProgress(activeRoadmap)}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                    </div>
                </div>
            </div>

            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-slate-600 before:to-transparent pb-20">
              {activeRoadmap.nodes.map((node, idx) => {
                  const isCompleted = node.completed;
                  return (
                    <div key={node.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    {/* Icon */}
                    <div 
                        className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-all duration-300 cursor-pointer ${
                            isCompleted 
                            ? 'bg-green-500 border-white dark:border-slate-900 scale-110' 
                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                        }`}
                        onClick={() => onToggleNode(activeRoadmap.id, node.id)}
                    >
                        {isCompleted ? (
                            <span className="material-symbols-rounded text-white text-sm font-bold animate-pop">check</span>
                        ) : (
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{idx + 1}</span>
                        )}
                    </div>
                    
                    {/* Content Card */}
                    <div 
                        className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-xl border shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md ${
                            isCompleted
                            ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                        onClick={() => onToggleNode(activeRoadmap.id, node.id)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h3 className={`font-bold text-lg transition-colors ${isCompleted ? 'text-green-800 dark:text-green-300' : 'text-slate-800 dark:text-slate-100'}`}>
                                {node.title}
                            </h3>
                            <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                {isCompleted && <span className="material-symbols-rounded text-white text-sm">check</span>}
                            </div>
                        </div>
                        <p className={`text-sm leading-relaxed ${isCompleted ? 'text-green-700 dark:text-green-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {node.description}
                        </p>
                    </div>
                    </div>
                  );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <span className="material-symbols-rounded text-6xl mb-4 text-slate-300 dark:text-slate-600">map</span>
            <p className="text-xl font-medium">Select or create a roadmap to begin</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoadmapView;