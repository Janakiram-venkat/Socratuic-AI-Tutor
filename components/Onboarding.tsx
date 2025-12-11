import React, { useState } from 'react';
import { StudentProfile } from '../types';

interface Props {
  onComplete: (profile: StudentProfile) => void;
}

const Onboarding: React.FC<Props> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [educationLevel, setEducationLevel] = useState('High School');
  const [subjects, setSubjects] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete({
        name: name.trim(),
        educationLevel,
        subjects: subjects.split(',').map(s => s.trim()).filter(s => s)
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Left side - Decorative */}
      <div className="hidden lg:flex w-1/2 bg-blue-600 relative overflow-hidden items-center justify-center p-12 text-white">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
             <div className="absolute top-10 left-10 w-96 h-96 bg-white rounded-full blur-3xl mix-blend-overlay"></div>
             <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-500 rounded-full blur-3xl mix-blend-overlay"></div>
        </div>
        
        <div className="relative z-10 max-w-lg">
            <div className="mb-6 inline-flex p-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
                <span className="material-symbols-rounded text-4xl">school</span>
            </div>
            <h1 className="text-5xl font-extrabold mb-6 leading-tight">Your Personal <br/>AI Socratic Tutor.</h1>
            <p className="text-blue-100 text-lg leading-relaxed">
                Experience a new way of learning where the answer isn't given, it's discovered. 
                Personalized roadmaps, real-time voice conversations, and adaptive exams await you.
            </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full animate-fade-in">
            <div className="lg:hidden text-center mb-10">
                 <span className="material-symbols-rounded text-5xl text-blue-600 dark:text-blue-400 mb-2">school</span>
                 <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Socratic AI</h1>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Let's get started</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8">Tell us a bit about yourself to personalize your learning experience.</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">Your First Name</label>
                    <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 material-symbols-rounded text-[20px]">person</span>
                        <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        placeholder="e.g. Alex"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">Current Education Level</label>
                    <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 material-symbols-rounded text-[20px]">school</span>
                        <select
                        value={educationLevel}
                        onChange={(e) => setEducationLevel(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none transition-all cursor-pointer"
                        >
                        <option value="Middle School">Middle School</option>
                        <option value="High School">High School</option>
                        <option value="Undergraduate">Undergraduate</option>
                        <option value="Postgraduate">Postgraduate</option>
                        <option value="Lifelong Learner">Lifelong Learner</option>
                        </select>
                        <span className="absolute right-3 top-3 text-slate-400 material-symbols-rounded text-[20px] pointer-events-none">expand_more</span>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">Subjects of Interest</label>
                    <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 material-symbols-rounded text-[20px]">interests</span>
                        <input
                        type="text"
                        value={subjects}
                        onChange={(e) => setSubjects(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        placeholder="e.g. Math, Physics, History"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 active:scale-95 flex items-center justify-center group"
                >
                    Start Learning
                    <span className="material-symbols-rounded ml-2 transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>
                </form>
            </div>
            
            <p className="text-center text-xs text-slate-400 mt-6">
                By starting, you agree to become smarter every day.
            </p>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;