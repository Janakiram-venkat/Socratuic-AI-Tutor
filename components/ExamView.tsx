import React, { useState, useRef, useEffect } from 'react';
import { generateExam, evaluateExam } from '../services/geminiService';
import { Exam, ExamResult, StudentProfile } from '../types';

interface Props {
  onXpGain: (amount: number) => void;
  profile: StudentProfile | null;
}

const ExamView: React.FC<Props> = ({ onXpGain, profile }) => {
  const [step, setStep] = useState<'upload' | 'taking' | 'results'>('upload');
  const [notes, setNotes] = useState('');
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load progress on mount
  useEffect(() => {
    const savedState = localStorage.getItem('activeExam');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.exam && parsed.step) {
            setExam(parsed.exam);
            setAnswers(parsed.answers || {});
            setStep(parsed.step);
            setResult(parsed.result || null);
            setRestored(true);
            setTimeout(() => setRestored(false), 3000);
        }
      } catch (e) {
        console.error("Failed to restore exam", e);
        localStorage.removeItem('activeExam');
      }
    }
  }, []);

  // Save progress on change
  useEffect(() => {
    if (exam && (step === 'taking' || step === 'results')) {
      localStorage.setItem('activeExam', JSON.stringify({ exam, answers, step, result }));
    } else if (step === 'upload' && !exam) {
      localStorage.removeItem('activeExam');
    }
  }, [exam, answers, step, result]);

  const resetExam = () => {
      if (confirm("Are you sure? This will clear your current exam progress.")) {
          setStep('upload'); 
          setAnswers({}); 
          setExam(null); 
          setNotes(''); 
          setResult(null);
          localStorage.removeItem('activeExam');
      }
  };

  const handleGenerate = async (content: string, type: 'text' | 'image') => {
    setLoading(true);
    try {
      const newExam = await generateExam(content, type, profile || undefined);
      const initialAnswers: Record<string, string> = {};
      newExam.questions.forEach(q => {
          if (q.type === 'ordering' && q.options) {
              initialAnswers[q.id] = q.options.join(',');
          }
      });
      setAnswers(initialAnswers);
      setExam(newExam);
      setStep('taking');
      setResult(null);
    } catch (e) {
      alert("Failed to generate exam. Please try again with different content.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).replace('data:', '').replace(/^.+,/, '');
        handleGenerate(base64String, 'image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!exam) return;
    setLoading(true);
    try {
      const evalResult = await evaluateExam(exam, answers);
      setResult(evalResult);
      if (evalResult.score >= 70) {
        onXpGain(100); 
      } else {
        onXpGain(20); 
      }
      setStep('results');
    } catch (e) {
      alert("Evaluation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const moveOrderingItem = (qId: string, fromIndex: number, toIndex: number, currentOrder: string[]) => {
      if (toIndex < 0 || toIndex >= currentOrder.length) return;
      const newOrder = [...currentOrder];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);
      setAnswers(prev => ({ ...prev, [qId]: newOrder.join(',') }));
  };

  // Calculate Progress
  const answeredCount = Object.keys(answers).length;
  const totalCount = exam?.questions.length || 0;
  const progressPercent = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="animate-pulse font-medium text-lg">Thinking...</p>
      </div>
    );
  }

  return (
    <div className="h-full p-6 md:p-8 max-w-5xl mx-auto overflow-y-auto relative scroll-smooth">
      {/* Restore Notification */}
      {restored && (
          <div className="absolute top-4 right-8 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg shadow-lg animate-fade-in z-50 flex items-center">
              <span className="material-symbols-rounded mr-2 text-sm">restore</span>
              Session Restored
          </div>
      )}

      {step === 'upload' && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center mb-10 mt-8">
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-3">Exam Mode</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">Upload your notes or a photo of your textbook, and I'll create a tailored practice test just for you.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-transform hover:-translate-y-1">
              <div className="flex items-center space-x-3 mb-4">
                  <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg material-symbols-rounded">text_fields</span>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">From Text</h2>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your study notes here..."
                className="w-full h-48 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4 resize-none leading-relaxed"
              />
              <button
                onClick={() => handleGenerate(notes, 'text')}
                disabled={!notes.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/30"
              >
                Generate Quiz
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-transform hover:-translate-y-1">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-rounded text-4xl">add_a_photo</span>
              </div>
              <h2 className="text-xl font-bold mb-2 text-slate-800 dark:text-slate-100">From Image</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs">Take a picture of your textbook page or handwritten notes.</p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30"
              >
                Upload & Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'taking' && exam && (
        <div className="animate-fade-in max-w-3xl mx-auto pb-20">
          {/* Header & Progress */}
          <div className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur z-20 py-4 mb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-end mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{exam.topic}</h1>
                    <span className="text-sm text-slate-500 font-medium">Question {answeredCount} of {totalCount} answered</span>
                </div>
                <button onClick={resetExam} className="text-sm font-medium text-slate-400 hover:text-red-500 transition-colors px-3 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    Exit Exam
                </button>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
              </div>
          </div>

          <div className="space-y-8">
            {exam.questions.map((q, idx) => (
              <div key={q.id} className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md group">
                <div className="flex space-x-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold text-sm">
                        {idx + 1}
                    </span>
                    <div className="flex-1">
                        <h3 className="text-xl font-medium text-slate-800 dark:text-slate-100 mb-6 leading-relaxed">
                        {q.question}
                        </h3>

                        {q.type === 'multiple_choice' && q.options && (
                        <div className="grid grid-cols-1 gap-3">
                            {q.options.map((opt) => (
                            <label key={opt} className={`flex items-center space-x-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                answers[q.id] === opt 
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 ring-1 ring-blue-500' 
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}>
                                <input
                                type="radio"
                                name={q.id}
                                value={opt}
                                checked={answers[q.id] === opt}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-slate-700 dark:text-slate-200 text-lg">{opt}</span>
                            </label>
                            ))}
                        </div>
                        )}

                        {(q.type === 'short_answer' || q.type === 'fill_in_blank') && (
                        <input
                            type="text"
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Type your answer..."
                            className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-lg"
                        />
                        )}

                        {q.type === 'ordering' && q.options && (
                            <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Order</p>
                                {(() => {
                                    const currentOrder = answers[q.id] ? answers[q.id].split(',') : q.options;
                                    
                                    return currentOrder.map((item, index) => (
                                        <div key={item} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in">
                                            <span className="text-slate-700 dark:text-slate-200 font-medium">{item}</span>
                                            <div className="flex flex-col gap-1">
                                                <button 
                                                    onClick={() => moveOrderingItem(q.id, index, index - 1, currentOrder)}
                                                    disabled={index === 0}
                                                    className="text-slate-400 hover:text-blue-500 disabled:opacity-20 hover:bg-slate-100 rounded"
                                                ><span className="material-symbols-rounded">keyboard_arrow_up</span></button>
                                                <button 
                                                    onClick={() => moveOrderingItem(q.id, index, index + 1, currentOrder)}
                                                    disabled={index === currentOrder.length - 1}
                                                    className="text-slate-400 hover:text-blue-500 disabled:opacity-20 hover:bg-slate-100 rounded"
                                                ><span className="material-symbols-rounded">keyboard_arrow_down</span></button>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-end">
             <button
                onClick={handleSubmit}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-2xl shadow-xl shadow-green-600/20 transform transition hover:-translate-y-1 active:scale-95 text-lg"
              >
                Submit & Grade
              </button>
          </div>
        </div>
      )}

      {step === 'results' && result && (
        <div className="animate-fade-in max-w-3xl mx-auto pb-10">
          {/* Summary Card */}
          <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 mb-8 text-center relative overflow-hidden">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Exam Results</h2>
            <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-6 animate-pop">
              {result.score}%
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed mb-8">{result.feedback}</p>
            
            <button 
              onClick={resetExam}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Take Another Exam
            </button>
          </div>
            
          {/* Areas for Improvement */}
          {result.areasForImprovement && result.areasForImprovement.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl p-8 mb-8">
                  <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-4 flex items-center">
                      <span className="material-symbols-rounded mr-2">fitness_center</span>
                      Areas to Strengthen
                  </h3>
                  <ul className="space-y-3">
                      {result.areasForImprovement.map((area, i) => (
                          <li key={i} className="flex items-start text-orange-800 dark:text-orange-200">
                             <span className="mr-2">•</span>
                             {area}
                          </li>
                      ))}
                  </ul>
              </div>
          )}

          {/* Questions Breakdown */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Detailed Breakdown</h3>
            {result.corrections.map((corr, idx) => {
              const originalQuestion = exam?.questions.find(q => q.id === corr.questionId);
              return (
                <div key={corr.questionId} className={`p-6 rounded-2xl border relative overflow-hidden transition-all hover:shadow-md ${corr.isCorrect ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900' : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900'}`}>
                  
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Question {idx + 1}</span>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{originalQuestion?.question}</p>
                      </div>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-4 ${corr.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          <span className="material-symbols-rounded font-bold">{corr.isCorrect ? 'check' : 'close'}</span>
                      </div>
                  </div>

                  <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 mb-4">
                     <p className="text-xs font-bold uppercase text-slate-400 mb-1">Your Answer</p>
                     <p className={`font-medium ${corr.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {answers[corr.questionId]?.toString() || "No Answer"}
                     </p>
                  </div>
                  
                  <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Explanation: </span> 
                    {corr.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamView;