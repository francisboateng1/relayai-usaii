import React, { useState, useRef, useEffect } from 'react';
import { 
  Rocket, Loader2, CheckCircle2, ShieldAlert, Code, 
  FileText, Send, User, Sparkles, MessageSquare, 
  History, PlusCircle, Landmark, Award, Calendar, 
  Users, Zap 
} from 'lucide-react';
import { useChat } from './hooks/useChat';






const ChatInterface = ({ scaffoldId }) => {
    const { sendMessage, stop, isGenerating } = useChat(scaffoldId);
    const [input, setInput] = useState("");
const [activeScaffoldId, setActiveScaffoldId] = useState(null);
    const handleSend = async () => {
        if (!input.trim()) return;
        await sendMessage(input);
        setInput("");
    };

    return (
        <div className="chat-container" style={{ padding: '20px', border: '1px solid #ccc' }}>
            <h3>Copilot Chat Workspace</h3>
            <input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Ask follow up questions..." 
            />
            <button onClick={handleSend} disabled={isGenerating}>Send</button>

            {/* The Stop Button triggers if the model is processing */}
            {isGenerating && (
                <button onClick={stop} style={{ backgroundColor: 'red', color: 'white', marginLeft: '10px' }}>
                    Stop Generating
                </button>
            )}
        </div>
    );
};





function App() {
  // --- Sidebar & General State ---
  const [historyList, setHistoryList] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Controls the generation form type ('MICRO_SAAS' or 'OPPORTUNITY')
  const [selectedMode, setSelectedMode] = useState('MICRO_SAAS');

  // --- Generation & Loaded Data State ---
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [scaffoldData, setScaffoldData] = useState(null);
  const [scaffoldId, setScaffoldId] = useState(null); 
  const [activeTab, setActiveTab] = useState('specs'); // Tabs for the right-side panels

  // --- Opportunity Persona State ---
  const [oppInputMode, setOppInputMode] = useState('prompt'); // 'prompt' or 'form'
  const [personaForm, setPersonaForm] = useState({
    role: '',
    skills: '',
    interests: '',
    experience: 'Student / Beginner'
  });

  // --- Chat Copilot State ---
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // --- Dynamic UI Theming based on active data or selected mode ---
  const activeViewMode = scaffoldData ? scaffoldData.scaffold_type : selectedMode;
  const isOpportunity = activeViewMode === 'OPPORTUNITY';
  
  const themeColor = isOpportunity ? 'from-emerald-600 to-teal-700' : 'from-indigo-600 to-blue-700';
  const accentBadge = isOpportunity ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-indigo-100 text-indigo-800 border-indigo-200';
  const buttonColor = isOpportunity ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700';

const abortControllerRef = useRef(null);
  // --- Lifecycle Hooks ---
  useEffect(() => {
    fetchHistoryList();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // --- API Handlers ---
  const fetchHistoryList = async () => {
    try {
      const response = await fetch('https://relayai-usaii.vercel.app/api/conversations');
      const resData = await response.json();
      if (resData.success) {
        setHistoryList(resData.data);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const handleLoadStoredWorkspace = async (savedScaffoldId) => {
    setLoading(true);
    try {
      const dataRes = await fetch(`https://relayai-usaii.vercel.app/api/scaffolds/${savedScaffoldId}`);
      const dataJson = await dataRes.json();
      
      const historyRes = await fetch(`https://relayai-usaii.vercel.app/api/conversations/${savedScaffoldId}/history`);
      const historyJson = await historyRes.json();

      if (dataJson.success && historyJson.success) {
        setScaffoldId(savedScaffoldId);
        setScaffoldData(dataJson.data);
        setChatHistory(historyJson.messages);
        setActiveTab('specs'); // Reset tabs on load
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error("Error loading workspace:", err);
    } finally {
      setLoading(false);
    }
  };


// Create the stop function
const handleStopGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        // Assuming you have a setChatLoading(false) to reset your UI
        // setChatLoading(false); 
    }
};







  const handleStartFreshWorkspace = () => {
    setScaffoldData(null);
    setScaffoldId(null);
    setChatHistory([]);
    setPrompt('');
    setPersonaForm({ role: '', skills: '', interests: '', experience: 'Student / Beginner' });
    setActiveTab('specs');
  };

  const handlePersonaChange = (e) => {
    setPersonaForm({ ...personaForm, [e.target.name]: e.target.value });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();

    // Construct the final payload based on the selected mode and input method
    let finalPrompt = prompt;
    if (selectedMode === 'OPPORTUNITY' && oppInputMode === 'form') {
      if (!personaForm.role.trim() || !personaForm.skills.trim()) return;
      finalPrompt = `Find tailored opportunities for the following persona:\nRole/Status: ${personaForm.role}\nTechnical Skills: ${personaForm.skills}\nInterests: ${personaForm.interests}\nExperience Level: ${personaForm.experience}`;
    } else {
      if (!prompt.trim()) return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://relayai-usaii.vercel.app/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: finalPrompt, mode: selectedMode })
      });
      const result = await response.json();
      if (result.success) {
        setScaffoldData(result.data);
        setScaffoldId(result.scaffoldId);
        
        // Dynamic initial welcome message based on mode
        const welcomeMessage = result.data.scaffold_type === 'OPPORTUNITY' 
          ? `I've initialized your Opportunity Workspace for "${result.data.title}". Let me know if you want to refine your pitch or breakdown any specific criteria.`
          : `I've initialized the Micro SaaS scaffold for "${result.data.title}". What specific adjustments would you like to make to this architecture?`;
          
        setChatHistory([{ role: 'model', message_text: welcomeMessage }]);
        fetchHistoryList();
      }
    } catch (error) {
      console.error("Generation logic failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !scaffoldId) return;
abortControllerRef.current = new AbortController();
    const newUserMsg = { role: 'user', message_text: chatMessage };
    setChatHistory(prev => [...prev, newUserMsg]);
    setChatMessage('');
    setChatLoading(true);

    try {
      const response = await fetch(`https://relayai-usaii.vercel.app/api/scaffolds/${scaffoldId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: newUserMsg.message_text }),
        signal: abortControllerRef.current.signal
      });
      const result = await response.json();
      
      if (result.success) {
        setChatHistory(prev => [...prev, { role: 'model', message_text: result.reply }]);
        setScaffoldData(result.updatedData);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Chat generation was aborted.");
        setChatHistory(prev => [...prev, { role: 'model', message_text: "Generation stopped." }]);
      } else {
        console.error("Chat sync exception:", error);
        setChatHistory(prev => [...prev, { role: 'model', message_text: "⚠️ Connection error. Could not sync updates." }]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans antialiased overflow-hidden">
      
      {/* =========================================
          LEFT SIDEBAR: DASHBOARD LOGS
          ========================================= */}
      <aside 
        className={`fixed lg:relative top-0 left-0 h-full bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 flex-shrink-0 z-40 transition-transform duration-300 w-72 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:w-0 lg:border-none lg:overflow-hidden'}`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between min-w-[18rem]">
          <div className="flex items-center gap-2 font-bold tracking-wide text-sm text-white">
            <History className="h-4 w-4 text-indigo-400" />
            <span>Workspace Logs</span>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={handleStartFreshWorkspace}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Start New Session Workspace"
            >
              <PlusCircle className="h-5 w-5" />
            </button>
            {/* MOBILE CLOSE BUTTON */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 lg:hidden"
              title="Close Sidebar"
            >
              <span className="text-xl leading-none">&times;</span> {/* Or import X from lucide-react */}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-w-[18rem]">
          {historyList.length === 0 ? (
            <div className="text-xs text-slate-500 p-4 text-center italic">No saved workspaces recorded yet.</div>
          ) : (
            historyList.map((folder) => {
              const isSelected = folder.scaffold_id === scaffoldId;
              const isOpp = folder.scaffold_type === 'OPPORTUNITY';
              return (
                <button
                  key={folder.scaffold_id}
                  onClick={() => {
                    handleLoadStoredWorkspace(folder.scaffold_id);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false); // Auto-close on mobile after selecting
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 border text-xs group ${
                    isSelected ? 'bg-slate-800 border-indigo-500 text-white shadow-inner' : 'bg-slate-900/40 border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <span className="font-semibold truncate max-w-full text-slate-200 group-hover:text-white">{folder.title}</span>
                  <span className={`w-fit px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isOpp ? 'bg-emerald-950 text-emerald-400 border-emerald-900' : 'bg-indigo-950 text-indigo-400 border-indigo-900'}`}>
                    {folder.scaffold_type}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>
      {/* =========================================
          MAIN INTERACTIVE WORKSPACE
          ========================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* TOP HEADER */}
        <header className={`bg-gradient-to-r flex-shrink-0 ${themeColor} text-white py-5 px-8 shadow-md transition-colors duration-500 flex items-center`}>
  {/* Always show toggle button on mobile, show on desktop only if closed */}
  <button 
    onClick={() => setIsSidebarOpen(true)} 
    className={`mr-4 p-2 hover:bg-white/10 rounded-lg transition-colors ${isSidebarOpen ? 'hidden lg:hidden' : 'block'}`}
  >
    <History className="h-5 w-5" />
  </button>
          <div className="flex-1 flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <Rocket className="h-6 w-6 text-cyan-400 animate-pulse" />
              <h1 className="text-xl font-bold tracking-tight">Universal Zero-to-One Scaffold</h1>
            </div>
            {scaffoldData && (
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${accentBadge} uppercase shadow-sm bg-white`}>
                Mode: {scaffoldData.scaffold_type}
              </span>
            )}
          </div>
        </header>

        {/* SCROLLABLE MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50">
          
          {/* STATE 1: EMPTY / GENERATION FORM */}
          {!scaffoldData && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Main Mode Toggle Tabs */}
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 mb-6 shadow-sm">
                <button 
                  onClick={() => setSelectedMode('MICRO_SAAS')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${selectedMode === 'MICRO_SAAS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Micro SaaS Architecture
                </button>
                <button 
                  onClick={() => setSelectedMode('OPPORTUNITY')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${selectedMode === 'OPPORTUNITY' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Opportunity & Grant Engine
                </button>
              </div>

              {/* Hero & Form Block */}
              <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mt-8 text-center">
                <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-6">
                  <Sparkles className={`h-10 w-10 ${selectedMode === 'OPPORTUNITY' ? 'text-emerald-500' : 'text-indigo-500'}`} />
                </div>
                
                <h2 className="text-2xl font-bold mb-3 text-slate-800">
                  {selectedMode === 'MICRO_SAAS' ? 'Launch a New Technical Strategy' : 'Discover Tailored Opportunities'}
                </h2>
                
                <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-2xl mx-auto">
                  {selectedMode === 'MICRO_SAAS' 
                    ? 'Input a raw software architecture vision or business logic to generate your complete backend and structural workspace.' 
                    : 'Provide your profile or prompt to discover tailored educational grants, hackathons, technical fellowships, and funding programs.'}
                </p>

                {/* Sub-toggle: Freeform vs Persona Form (Opportunity Mode Only) */}
                {selectedMode === 'OPPORTUNITY' && (
                  <div className="flex justify-center items-center gap-6 mb-8 p-2 bg-slate-50/80 rounded-lg w-fit mx-auto border border-slate-200 shadow-inner">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors">
                      <input 
                        type="radio" 
                        checked={oppInputMode === 'prompt'} 
                        onChange={() => setOppInputMode('prompt')} 
                        className="text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      Freeform Prompt
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors">
                      <input 
                        type="radio" 
                        checked={oppInputMode === 'form'} 
                        onChange={() => setOppInputMode('form')} 
                        className="text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      Persona Builder
                    </label>
                  </div>
                )}

                {/* Input Form Submission */}
                <form onSubmit={handleGenerate} className="space-y-6 max-w-3xl mx-auto">
                  
                  {selectedMode === 'OPPORTUNITY' && oppInputMode === 'form' ? (
                    // --- PERSONA BUILDER FORM ---
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left bg-slate-50 p-6 md:p-8 rounded-xl border border-slate-200 shadow-inner">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Current Role / Status <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          name="role" 
                          value={personaForm.role} 
                          onChange={handlePersonaChange} 
                          placeholder="e.g., Level 100 Computer Science Student, Full Stack Intern" 
                          className="w-full p-3.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all shadow-sm" 
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Technical Skills / Stack <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          name="skills" 
                          value={personaForm.skills} 
                          onChange={handlePersonaChange} 
                          placeholder="e.g., C++, React, Node.js, PostgreSQL, UI/UX" 
                          className="w-full p-3.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all shadow-sm" 
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Core Interests / Goals</label>
                        <input 
                          type="text" 
                          name="interests" 
                          value={personaForm.interests} 
                          onChange={handlePersonaChange} 
                          placeholder="e.g., AI Hackathons, Open Source, EdTech" 
                          className="w-full p-3.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all shadow-sm" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Experience Level</label>
                        <select 
                          name="experience" 
                          value={personaForm.experience} 
                          onChange={handlePersonaChange} 
                          className="w-full p-3.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all shadow-sm cursor-pointer"
                        >
                          <option value="Student / Beginner">Student / Beginner</option>
                          <option value="Junior / Intermediate">Junior / Intermediate</option>
                          <option value="Senior / Advanced">Senior / Advanced</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    // --- FREEFORM PROMPT TEXTAREA ---
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={selectedMode === 'OPPORTUNITY' 
                        ? "e.g., I'm a computer engineering student in Ghana looking for global AI hackathons and technical fellowships to build my proof of work..." 
                        : "e.g., I want to build a platform to automate selling mobile data bundles using an African payment gateway integration..."}
                      className={`w-full min-h-[160px] p-5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 bg-white font-mono shadow-inner resize-y transition-all ${selectedMode === 'OPPORTUNITY' ? 'focus:ring-emerald-500' : 'focus:ring-indigo-500'}`}
                      required
                    />
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-4 px-6 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
                  >
                    {loading ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Compiling Workspace Data...</>
                    ) : (
                      <><Code className="h-5 w-5" /> Initialize {selectedMode === 'MICRO_SAAS' ? 'Architecture' : 'Opportunity Engine'}</>
                    )}
                  </button>
                </form>
              </section>
            </div>
          )}

          {/* STATE 2: POPULATED DATA PANELS */}
          {scaffoldData && (
            <div className="space-y-6 max-w-[90rem] mx-auto animate-fadeIn pb-12">
              
              {/* Universal Header Block for active data */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start sm:items-center flex-col sm:flex-row gap-6">
                <div className={`p-4 rounded-full flex-shrink-0 w-fit ${isOpportunity ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  <Rocket className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{scaffoldData.title}</h2>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-4xl">{scaffoldData.high_level_overview}</p>
                </div>
              </div>

              {/* DYNAMIC CONDITIONAL LAYOUTS */}
              {isOpportunity ? (
                
                /* =========================================
                   LAYOUT A: OPPORTUNITY & GRANT VIEW
                   ========================================= */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Snapshot Table & Requirements */}
                  <div className="lg:col-span-5 space-y-6 flex flex-col">
                    
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-emerald-500" /> The Snapshot
                      </h3>
                      <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                        <table className="w-full text-left border-collapse text-xs">
                          <tbody>
                            <tr className="border-b border-slate-100">
                              <td className="p-3 font-bold text-slate-500 bg-slate-100/60 w-1/3 flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-slate-400" /> Provider</td>
                              <td className="p-3 font-semibold text-slate-800">{scaffoldData.provider || 'Not Specified'}</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="p-3 font-bold text-slate-500 bg-slate-100/60 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-slate-400" /> Funding</td>
                              <td className="p-3 font-mono font-bold text-emerald-700">{scaffoldData.funding_amount || 'Variable / Unstated'}</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="p-3 font-bold text-slate-500 bg-slate-100/60 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Deadline</td>
                              <td className="p-3 font-semibold text-red-600 font-mono">{scaffoldData.deadline || 'Rolling / TBD'}</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="p-3 font-bold text-slate-500 bg-slate-100/60 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-400" /> Target</td>
                              <td className="p-3 text-slate-700 leading-tight">{scaffoldData.target_audience || 'Open to all applicable'}</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-bold text-slate-500 bg-slate-100/60 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> Effort Level</td>
                              <td className="p-3 font-medium text-slate-700">{scaffoldData.effort_level || 'Medium'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-teal-500" /> Core Requirements
                      </h3>
                      <ul className="space-y-2.5">
                        {scaffoldData.core_requirements?.length > 0 ? (
                          scaffoldData.core_requirements.map((req, i) => (
                            <li key={i} className="text-xs text-slate-700 flex items-start gap-2 bg-slate-50 p-2.5 border border-slate-100 rounded-lg shadow-sm">
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0"></span>
                              <span className="leading-relaxed">{req}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-slate-400 italic p-2">No static requirements parsed. Request details in chat.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Right Column: Tabbed Eligibility & Playbook */}
                  <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[500px]">
                    <div className="flex border-b border-slate-200 bg-slate-50 rounded-t-lg overflow-hidden flex-shrink-0">
                      <button onClick={() => setActiveTab('specs')} className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'specs' ? 'bg-white border-t-2 border-emerald-600 text-slate-900 shadow-sm z-10' : 'text-slate-400 hover:text-slate-600 border-t-2 border-transparent hover:bg-slate-100/50'}`}>
                        <CheckCircle2 className="h-4 w-4" /> Eligibility Blueprint
                      </button>
                      <button onClick={() => setActiveTab('risks')} className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'risks' ? 'bg-white border-t-2 border-emerald-600 text-slate-900 shadow-sm z-10' : 'text-slate-400 hover:text-slate-600 border-t-2 border-transparent hover:bg-slate-100/50'}`}>
                        <Rocket className="h-4 w-4" /> Action Playbook
                      </button>
                    </div>

                    <div className="p-5 flex-1 overflow-y-auto bg-slate-50/50">
                      {activeTab === 'specs' ? (
                        <div className="space-y-4">
                          {scaffoldData.eligibility_blueprint?.length > 0 ? (
                            scaffoldData.eligibility_blueprint.map((criterion, idx) => (
                              <div key={idx} className="p-4 border border-slate-200/60 rounded-xl bg-white shadow-sm flex gap-3.5 items-start">
                                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 mt-0.5 border border-emerald-100">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <div>
                                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{criterion.criterion_label || 'Parameter'}</h4>
                                  <p className="text-sm text-slate-800 font-semibold mt-1 leading-relaxed">{criterion.structured_content || criterion}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500 italic text-center py-8">Eligibility blueprint not mapped. Ask Copilot to generate it.</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4 pr-1">
                          {scaffoldData.action_playbook?.length > 0 ? (
                            scaffoldData.action_playbook.map((step, idx) => (
                              <div key={idx} className="p-4 border border-emerald-100 rounded-xl bg-gradient-to-br from-white to-emerald-50/30 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors">
                                <div className="absolute top-0 right-0 p-3 text-4xl font-black text-emerald-50/50 select-none group-hover:text-emerald-50 transition-colors">
                                  {idx + 1}
                                </div>
                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 z-10 relative">
                                  <Sparkles className="h-4 w-4 text-emerald-500" /> {step.phase_title || step.task_name}
                                </h4>
                                <p className="text-xs text-slate-700 mt-2.5 leading-relaxed font-medium z-10 relative">{step.action_item || step.action_description}</p>
                                {step.technical_dependency && (
                                  <div className="mt-3 text-[10px] font-mono bg-emerald-50 border border-emerald-100 text-emerald-800 rounded px-2.5 py-1 w-fit z-10 relative">
                                    Strategic Focus: {step.technical_dependency}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500 italic text-center py-8">Action playbook not mapped. Ask Copilot to break down the timeline.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              ) : (

                /* =========================================
                   LAYOUT B: MICRO SAAS ARCHITECTURE VIEW
                   ========================================= */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Milestones Panel */}
                  <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[500px] flex flex-col">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2 flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-indigo-500" /> Engineering Playbook
                    </h3>
                    <div className="space-y-3 overflow-y-auto pr-2 flex-1 scroll-smooth">
                      {scaffoldData.milestone_tasks?.length > 0 ? (
                        scaffoldData.milestone_tasks.map((task, index) => (
                          <div key={index} className="p-4 border border-slate-100 rounded-lg bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                                {task.phase_title || `Phase ${task.phase_number}`}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 max-w-[150px] truncate" title={task.technical_dependency}>
                                Dep: {task.technical_dependency}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{task.task_name}</h4>
                            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{task.action_item}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">No milestones defined yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Tabbed Specs & Risks Panel */}
                  <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
                    <div className="flex border-b border-slate-200 bg-slate-50 rounded-t-lg overflow-hidden flex-shrink-0">
                      <button onClick={() => setActiveTab('specs')} className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'specs' ? 'bg-white border-t-2 border-indigo-600 text-slate-900 shadow-sm z-10' : 'text-slate-400 hover:text-slate-600 border-t-2 border-transparent hover:bg-slate-100/50'}`}>
                        <FileText className="h-4 w-4" /> Core Blueprints
                      </button>
                      <button onClick={() => setActiveTab('risks')} className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'risks' ? 'bg-white border-t-2 border-red-500 text-slate-900 shadow-sm z-10' : 'text-slate-400 hover:text-slate-600 border-t-2 border-transparent hover:bg-slate-100/50'}`}>
                        <ShieldAlert className="h-4 w-4" /> Mitigation Risks
                      </button>
                    </div>
                    
                    <div className="p-5 flex-1 overflow-y-auto bg-slate-50/50">
                      {activeTab === 'specs' ? (
                        <div className="space-y-6">
                          {scaffoldData.blueprint_specs?.length > 0 ? (
                            scaffoldData.blueprint_specs.map((spec, idx) => (
                              <div key={idx} className="space-y-2">
                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-indigo-500"></span> {spec.spec_label}
                                </h4>
                                <pre className="text-xs bg-slate-900 text-green-400 p-4 rounded-xl overflow-x-auto font-mono leading-relaxed shadow-inner">
                                  {spec.structured_content}
                                </pre>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500 italic text-center py-8">Technical specs not generated. Check prompt detail.</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {scaffoldData.structural_risks?.length > 0 ? (
                            scaffoldData.structural_risks.map((risk, idx) => (
                              <div key={idx} className="p-4 border border-red-200 rounded-xl bg-red-50 shadow-sm">
                                <h4 className="text-sm font-bold text-red-900 flex items-center gap-2">
                                  <ShieldAlert className="h-4 w-4 text-red-600" /> {risk.risk_title}
                                </h4>
                                <p className="text-sm text-slate-700 mt-2 leading-relaxed">{risk.risk_description}</p>
                                <div className="mt-3 text-xs bg-white border border-red-100 p-3 rounded-lg text-slate-800 font-medium shadow-sm">
                                  <span className="text-red-600 font-bold uppercase tracking-wide">Mitigation:</span> {risk.mitigation_protocol}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500 italic text-center py-8">No structural risks detected.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================
                  UNIVERSAL CHAT COPILOT
                  ========================================= */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                
                <div className={`p-4 border-b border-slate-200 flex items-center gap-2 ${isOpportunity ? 'bg-emerald-50/80' : 'bg-indigo-50/80'}`}>
                  <MessageSquare className={`h-5 w-5 ${isOpportunity ? 'text-emerald-600' : 'text-indigo-600'}`} />
                  <h3 className="font-bold text-slate-800 text-sm">Scaffold Copilot Sync</h3>
                  <span className="ml-auto text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    Engine Live
                  </span>
                </div>
                
                <div className="p-6 h-[320px] overflow-y-auto space-y-4 bg-slate-50/50 scroll-smooth">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                      Start typing to modify your workspace data...
                    </div>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : (isOpportunity ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white')}`}>
                          {msg.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                        </div>
                        <div className={`max-w-[80%] p-3.5 text-sm rounded-2xl leading-relaxed ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none shadow-md' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'}`}>
                          {msg.message_text}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="flex gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${isOpportunity ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'}`}>
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl rounded-tl-none shadow-sm flex gap-1.5 items-center">
                        <div className="h-2 w-2 bg-slate-300 rounded-full animate-bounce"></div>
                        <div className="h-2 w-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                        <div className="h-2 w-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-slate-200 flex gap-3">
                  <input
    type="text"
    value={chatMessage}
    onChange={(e) => setChatMessage(e.target.value)}
    placeholder={isOpportunity ? "Ask for essay tips, recommender strategies..." : "Modify database tables..."}
    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
    disabled={chatLoading}
  />

{!chatLoading ? (
<button
      type="submit"
      disabled={!chatMessage.trim()}
      className={`px-5 py-3 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-md ${buttonColor}`}
    >
      <Send className="h-4 w-4" />
    </button>

):(


  <button
      type="button" // Important: type="button" prevents it from submitting the form
      onClick={handleStopGeneration}
      className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md"
    >
      {/* If you have a Square or Stop/X icon from lucide-react, use it here instead of Send! */}
      <span>Stop</span> 
    </button>


)}


                </form>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;