import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendTextMessage, generateConceptMapUpdate } from '../services/geminiService';
import { ConceptMap, ChatMessage, StudentProfile, SocraticLevel, ConceptNode } from '../types';
import { FormattedText } from './FormattedText';

interface Props {
  profile: StudentProfile | null;
  onXpGain: () => void;
}

// Helper to get node dimensions based on text
const getNodeDimensions = (label: string) => {
    // More generous width for readability
    const width = Math.max(120, label.length * 9 + 30); 
    const height = 44;
    return { width, height };
};

// Calculate the intersection point between the line segment (from center to center) 
// and the rectangular boundary of the 'target' node.
const getIntersection = (
    from: { x: number, y: number },
    target: { x: number, y: number },
    targetWidth: number,
    targetHeight: number
) => {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    
    // Add small buffer so line doesn't barely touch, but arrow tip lands nicely
    // Also accounts for stroke width
    const w = targetWidth + 4; 
    const h = targetHeight + 4;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return target;

    // Slope
    const m = dy / dx;
    
    // Calculate intersection relative to target center
    let ix, iy;

    // Determine if we hit the vertical (side) or horizontal (top/bottom) face
    // Aspect ratio comparison handles the corner cases
    if (Math.abs(dx) * h > Math.abs(dy) * w) {
        // Hit vertical side
        ix = dx > 0 ? -w / 2 : w / 2;
        iy = m * ix;
    } else {
        // Hit horizontal side
        iy = dy > 0 ? -h / 2 : h / 2;
        ix = (dx !== 0) ? iy / m : 0;
    }

    // Return absolute coordinates
    return { x: target.x + ix, y: target.y + iy };
};

const useForceLayout = (
    nodes: ConceptNode[], 
    links: any[], 
    width: number, 
    height: number,
    draggedNodeId: string | null,
    dragPos: { x: number, y: number } | null
) => {
    const [animatedNodes, setAnimatedNodes] = useState<ConceptNode[]>([]);
    const requestRef = useRef<number>(0);
    const alphaRef = useRef<number>(1); 

    useEffect(() => {
        setAnimatedNodes(prev => {
            const next = [...prev];
            let hasChanges = false;

            nodes.forEach(n => {
                const existing = next.find(en => en.id === n.id);
                if (existing) {
                    if (existing.label !== n.label) {
                        existing.label = n.label;
                        hasChanges = true;
                    }
                } else {
                    // Smart Spawn: Position new node near its parent/connection
                    const connectedLink = links.find(l => l.target === n.label || l.source === n.label);
                    let initX = width / 2;
                    let initY = height / 2;

                    if (connectedLink) {
                        const peerLabel = connectedLink.source === n.label ? connectedLink.target : connectedLink.source;
                        const peer = next.find(p => p.label === peerLabel);
                        if (peer) {
                            // Spawn slightly offset from parent
                            const angle = Math.random() * Math.PI * 2;
                            initX = peer.x + Math.cos(angle) * 80;
                            initY = peer.y + Math.sin(angle) * 80;
                        }
                    } else {
                        // Random scatter near center if no connection found
                        initX = width / 2 + (Math.random() - 0.5) * 100;
                        initY = height / 2 + (Math.random() - 0.5) * 100;
                    }

                    next.push({ ...n, x: initX, y: initY, vx: 0, vy: 0 });
                    hasChanges = true;
                    alphaRef.current = 1; // Restart simulation
                }
            });
            return hasChanges ? next : prev;
        });
    }, [nodes, links, width, height]);

    const simulate = useCallback(() => {
        setAnimatedNodes(prevNodes => {
            const newNodes = prevNodes.map(n => ({ ...n }));
            // Parameters tuned for less overlap and clearer structure
            const k = 250; // Ideal distance (Increased to spread nodes)
            const center = { x: width / 2, y: height / 2 };
            
            // 1. Repulsion (Push apart)
            for (let i = 0; i < newNodes.length; i++) {
                const u = newNodes[i];
                for (let j = i + 1; j < newNodes.length; j++) {
                    const v = newNodes[j];
                    const dx = u.x - v.x;
                    const dy = u.y - v.y;
                    let distSq = dx * dx + dy * dy;
                    if (distSq === 0) distSq = 1;
                    const dist = Math.sqrt(distSq);
                    
                    // Repulsion - Stronger force to prevent clumps
                    const force = (k * k * 8) / distSq; 
                    
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (u.id !== draggedNodeId) { u.vx = (u.vx || 0) + fx * 0.05; u.vy = (u.vy || 0) + fy * 0.05; }
                    if (v.id !== draggedNodeId) { v.vx = (v.vx || 0) - fx * 0.05; v.vy = (v.vy || 0) - fy * 0.05; }
                }
                
                // Centering Force (Keep graph in view)
                if (u.id !== draggedNodeId) {
                    u.vx = (u.vx || 0) + (center.x - u.x) * 0.005;
                    u.vy = (u.vy || 0) + (center.y - u.y) * 0.005;
                }
            }

            // 2. Attraction (Pull connected nodes)
            links.forEach(link => {
                const source = newNodes.find(n => n.label === link.source);
                const target = newNodes.find(n => n.label === link.target);
                if (source && target) {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    // Spring force
                    const force = (dist - k) * 0.03; 
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (source.id !== draggedNodeId) { source.vx = (source.vx || 0) + fx; source.vy = (source.vy || 0) + fy; }
                    if (target.id !== draggedNodeId) { target.vx = (target.vx || 0) - fx; target.vy = (target.vy || 0) - fy; }
                }
            });

            // 3. Collision Resolution (Prevent Overlap) - Aggressive
            const padding = 30; // Increased padding
            for (let pass = 0; pass < 3; pass++) { // Multiple passes for stability
                for (let i = 0; i < newNodes.length; i++) {
                    const u = newNodes[i];
                    const dimU = getNodeDimensions(u.label);
                    
                    for (let j = i + 1; j < newNodes.length; j++) {
                        const v = newNodes[j];
                        const dimV = getNodeDimensions(v.label);

                        const dx = u.x - v.x;
                        const dy = u.y - v.y;
                        
                        const minW = (dimU.width + dimV.width) / 2 + padding; 
                        const minH = (dimU.height + dimV.height) / 2 + padding;

                        if (Math.abs(dx) < minW && Math.abs(dy) < minH) {
                            const overlapX = minW - Math.abs(dx);
                            const overlapY = minH - Math.abs(dy);

                            if (overlapX < overlapY) {
                                const sign = dx > 0 ? 1 : -1;
                                const push = overlapX / 2;
                                if (u.id !== draggedNodeId) u.x += sign * push;
                                if (v.id !== draggedNodeId) v.x -= sign * push;
                                // Kill velocity to stop bouncing
                                u.vx = (u.vx || 0) * 0.1;
                                v.vx = (v.vx || 0) * 0.1;
                            } else {
                                const sign = dy > 0 ? 1 : -1;
                                const push = overlapY / 2;
                                if (u.id !== draggedNodeId) u.y += sign * push;
                                if (v.id !== draggedNodeId) v.y -= sign * push;
                                u.vy = (u.vy || 0) * 0.1;
                                v.vy = (v.vy || 0) * 0.1;
                            }
                        }
                    }
                }
            }

            // 4. Update Position, Damping & Boundary Check
            const boundaryMargin = 60;
            return newNodes.map(n => {
                if (n.id === draggedNodeId && dragPos) {
                    return { ...n, x: dragPos.x, y: dragPos.y, vx: 0, vy: 0 };
                }

                let { vx, vy, x, y } = n;
                vx = (vx || 0) * 0.65; // Heavier damping
                vy = (vy || 0) * 0.65;

                const maxV = 8;
                vx = Math.max(-maxV, Math.min(maxV, vx));
                vy = Math.max(-maxV, Math.min(maxV, vy));

                // Stop small movements to prevent jitter
                if (Math.abs(vx) < 0.05) vx = 0;
                if (Math.abs(vy) < 0.05) vy = 0;

                x += vx;
                y += vy;

                // Keep inside view
                x = Math.max(boundaryMargin, Math.min(width - boundaryMargin, x));
                y = Math.max(boundaryMargin, Math.min(height - boundaryMargin, y));

                return { ...n, x, y, vx, vy };
            });
        });

        if (alphaRef.current > 0.01) {
            alphaRef.current *= 0.98;
            requestRef.current = requestAnimationFrame(simulate);
        } else {
            requestRef.current = requestAnimationFrame(simulate);
        }
    }, [links, width, height, draggedNodeId, dragPos]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(simulate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [simulate]);

    return animatedNodes;
};

// ... Rest of component ...
const ConceptBuilder: React.FC<Props> = ({ profile, onXpGain }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conceptMap, setConceptMap] = useState<ConceptMap>({ nodes: [], links: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{x: number, y: number} | null>(null);

  const animatedNodes = useForceLayout(
      conceptMap.nodes, 
      conceptMap.links, 
      containerRef.current?.clientWidth || 800, 
      containerRef.current?.clientHeight || 600,
      draggedNodeId,
      dragPos
  );

  useEffect(() => {
    setMessages([{
      id: 'init',
      role: 'model',
      text: `Welcome to the Concept Lab! Let's build a map together. Pick a topic (e.g., "Photosynthesis" or "Democracy") and I'll help you connect the dots.`,
      timestamp: Date.now()
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'user', 
        text: input,
        timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const responseText = await sendTextMessage(history, userMsg.text, undefined, SocraticLevel.MEDIUM, profile || undefined);
      
      const botMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: responseText || "Thinking...",
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, botMsg]);
      onXpGain();

      const lastContext = messages.slice(-6).map(m => `${m.role}: ${m.text}`).join('\n');
      const newUpdate = `${userMsg.role}: ${userMsg.text}\n${botMsg.role}: ${botMsg.text}`;
      
      const updatedMap = await generateConceptMapUpdate(lastContext + "\n" + newUpdate, conceptMap);
      setConceptMap(updatedMap);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      setDraggedNodeId(nodeId);
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (draggedNodeId && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
  };

  const handleMouseUp = () => {
      setDraggedNodeId(null);
      setDragPos(null);
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Left: Chat Panel */}
      <div className="w-1/3 min-w-[350px] flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-10 shadow-xl">
        <div className="p-4 bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <span className="material-symbols-rounded text-pink-500">account_tree</span>
            Socratic Builder
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scroll-smooth">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl max-w-[90%] text-sm shadow-sm leading-relaxed ${
                    msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                }`}>
                  <FormattedText text={msg.text} />
                </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1 border border-slate-200 dark:border-slate-700">
                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                 </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex gap-2 relative">
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Discuss a concept..."
                    className="flex-1 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                />
                <button 
                  onClick={handleSend} 
                  disabled={loading} 
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 transition-all shadow-md active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:active:scale-100"
                >
                    <span className="material-symbols-rounded">send</span>
                </button>
            </div>
        </div>
      </div>

      {/* Right: Graph Visualization */}
      <div 
        className="flex-1 relative bg-slate-100 dark:bg-slate-950 overflow-hidden cursor-default" 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
          {/* Subtle Grid */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{
              backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
              backgroundSize: '40px 40px'
          }}></div>

          <svg className="w-full h-full pointer-events-none">
            <defs>
                {/* 
                  RefX 12 aligns the TIP of the arrow (12, 4) with the end point of the line.
                  This makes the arrow touch the node exactly where the line ends.
                */}
                <marker id="arrowhead" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
                    <polygon points="0 0, 12 4, 0 8" className="fill-slate-400 dark:fill-slate-500" />
                </marker>
            </defs>

            {/* Links */}
            {conceptMap.links.map((link, i) => {
                const source = animatedNodes.find(n => n.label === link.source);
                const target = animatedNodes.find(n => n.label === link.target);
                if (!source || !target) return null;
                
                // Calculate dimensions for intersection
                const sDim = getNodeDimensions(source.label);
                const tDim = getNodeDimensions(target.label);

                // Calculate exact start and end points on the node boundaries
                // We calculate the point on Source heading towards Target, and point on Target heading from Source
                const start = getIntersection(target, source, sDim.width, sDim.height);
                const end = getIntersection(source, target, tDim.width, tDim.height);

                // Midpoint for label
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                
                return (
                    <g key={i}>
                        <line 
                            x1={start.x} y1={start.y} 
                            x2={end.x} y2={end.y} 
                            strokeWidth="2" 
                            className="stroke-slate-400 dark:stroke-slate-500 transition-all duration-300 opacity-80"
                            markerEnd="url(#arrowhead)"
                        />
                        {/* Link Label Background for readability */}
                        {link.label && (
                             <foreignObject x={midX - 50} y={midY - 12} width="100" height="24" className="overflow-visible pointer-events-none">
                                <div className="flex justify-center items-center h-full">
                                    <span className="bg-white/95 dark:bg-slate-900/95 text-[10px] font-bold text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-600 shadow-sm whitespace-nowrap z-10">
                                        {link.label}
                                    </span>
                                </div>
                            </foreignObject>
                        )}
                    </g>
                );
            })}

            {/* Nodes */}
            {animatedNodes.map((node, i) => {
                const isDragged = draggedNodeId === node.id;
                const { width, height } = getNodeDimensions(node.label);
                
                return (
                <g 
                    key={node.id} 
                    transform={`translate(${node.x},${node.y})`} 
                    className="pointer-events-auto cursor-grab active:cursor-grabbing transition-transform"
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                >
                    {/* Shadow for depth */}
                    <rect 
                        x={-width / 2} 
                        y={-height / 2 + 3} 
                        width={width} 
                        height={height} 
                        rx={22} 
                        className="fill-black/10 dark:fill-black/40"
                    />
                    
                    {/* Main Node Body */}
                    <rect 
                        x={-width / 2} 
                        y={-height / 2} 
                        width={width} 
                        height={height} 
                        rx={22} 
                        className={`transition-all duration-200 stroke-[2px] ${isDragged 
                            ? 'fill-white stroke-blue-500 dark:fill-slate-800 dark:stroke-blue-400 shadow-xl scale-105' 
                            : 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600 hover:stroke-blue-400'}`}
                    />

                    {/* Left Colored Dot (Decoration) */}
                    <circle cx={-width/2 + 20} cy={0} r="6" className="fill-blue-100 dark:fill-blue-900/60" />
                    <circle cx={-width/2 + 20} cy={0} r="2" className="fill-blue-500 dark:fill-blue-400" />
                    
                    {/* Node Label */}
                    <text 
                        textAnchor="middle" 
                        x={10} // Offset for dot
                        y={5} 
                        className="fill-slate-700 dark:fill-slate-200 text-xs font-bold pointer-events-none select-none tracking-wide"
                    >
                        {node.label}
                    </text>
                </g>
            )})}
          </svg>
      </div>
    </div>
  );
};

export default ConceptBuilder;