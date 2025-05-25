import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabase'; // Import your Supabase client
import { useAppStore, AppState } from '../store/useAppStore';

// Assume you have a Zustand store and hook for the current subnet ID
// Replace this with your actual hook.
// import { useAppStore } from '../store'; // Example import
const useCurrentSubnetId = (): string | null => {
  return useAppStore((state: AppState) => state.selectedSubnetId);
};

interface ChatMessage {
  id: string;
  sender: 'user' | 'ava' | 'system';
  text: string;
  error?: boolean;
}

// Removed the placeholder getAuthToken function

const AskAva: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: 'initial', sender: 'ava', text: "Hi! I'm Ava, your subnet assistant. Ask me anything about your validator, mempool, or subnet health." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentSubnetId = useCurrentSubnetId();

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), sender: 'user', text: message.trim() };
    setChatHistory(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);
    setError(null);

    if (!currentSubnetId) {
      const systemMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'system',
        text: 'Please select a subnet first to ask questions about it.',
        error: true,
      };
      setChatHistory(prev => [...prev, systemMessage]);
      setIsLoading(false);
      return;
    }

    let authToken: string | null = null;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('[AskAva] Error getting session or no session found:', sessionError);
        throw new Error('Authentication error: Could not retrieve session. Please log in again.');
      }
      authToken = session.access_token;
    } catch (authError: any) {
      const systemMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'system',
        text: authError.message || 'Authentication failed.',
        error: true,
      };
      setChatHistory(prev => [...prev, systemMessage]);
      setIsLoading(false);
      setError(authError.message || 'User not authenticated.');
      return;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/ask-ava', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ question: userMessage.text, subnetId: currentSubnetId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `API Error: ${response.status} ${response.statusText}`, details: response.statusText }));
        // Use errorData.details if available and errorData.error is generic, otherwise prioritize errorData.error
        const detailMessage = (errorData.details && errorData.details !== response.statusText) ? errorData.details : errorData.error;
        throw new Error(detailMessage || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const avaMessage: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ava', text: data.answer };
      setChatHistory(prev => [...prev, avaMessage]);

    } catch (err: any) {
      console.error("Failed to get response from Ava:", err);
      const errorMessageText = err.message || "Sorry, I couldn't get a response. Please try again.";
      setError(errorMessageText);
      const systemMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'system',
        text: errorMessageText,
        error: true,
      };
      setChatHistory(prev => [...prev, systemMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) { // When opening, reset error and ensure initial message is there
      setError(null);
      if (chatHistory.length === 0 || (chatHistory.length === 1 && chatHistory[0].id !== 'initial')) {
         setChatHistory([
           { id: 'initial', sender: 'ava', text: "Hi! I'm Ava, your subnet assistant. Ask me anything about your validator, mempool, or subnet health." }
         ]);
      }
    }
  };


  return (
    <>
      {/* Chat button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 bg-red-500 text-white p-4 rounded-full shadow-lg hover:bg-red-600 transition-colors duration-200 z-50"
        aria-label="Toggle Ask Ava chat"
      >
        {isOpen ? <X size={32} /> : (
          <img
            src="/Ava-Scope-Logo.png"
            alt="Ava Assistant"
            className="w-10 h-10 object-contain rounded-full"
          />
        )}
      </button>

      {/* Chat modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-full max-w-xl bg-slate-800 rounded-lg shadow-xl border border-slate-700 flex flex-col z-40 max-h-[80vh]">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <img
                src="/Ava-Scope-Logo.png"
                alt="Ava Assistant"
                className="w-10 h-10 object-contain rounded-full"
              />
              <h3 className="text-xl font-semibold text-slate-100">Ask Ava</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200"
              aria-label="Close chat"
            >
              <X size={24} />
            </button>
          </div>

          <div ref={chatContainerRef} className="p-4 flex-1 overflow-y-auto space-y-4">
            {chatHistory.map((chat) => (
              <div key={chat.id} className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 text-base md:text-lg ${
                    chat.sender === 'user' ? 'bg-red-500 text-white' :
                    chat.sender === 'ava' ? 'bg-slate-700 text-slate-200' :
                    'bg-yellow-600 text-yellow-50 w-full text-center' // System/Error messages
                  }`}
                >
                  {chat.sender === 'system' && chat.error && <AlertTriangle className="inline mr-2 mb-0.5" size={18} />}
                  {chat.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 text-slate-200 rounded-lg px-4 py-3 flex items-center text-base">
                  <Loader2 size={22} className="animate-spin mr-2" />
                  Ava is thinking...
                </div>
              </div>
            )}
          </div>
          
          {error && !isLoading && (
             <div className="p-3 px-4 border-t border-slate-700 text-red-400 text-sm">
                {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
            <div className="flex gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={currentSubnetId ? "Ask about your subnet..." : "Select a subnet first..."}
                className="flex-1 bg-slate-700 text-slate-100 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                disabled={isLoading || !currentSubnetId}
              />
              <button
                type="submit"
                className="bg-red-500 text-white px-5 py-3 rounded-md hover:bg-red-600 transition-colors duration-200 disabled:opacity-50"
                disabled={isLoading || !message.trim() || !currentSubnetId}
              >
                {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default AskAva;