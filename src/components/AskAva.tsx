import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

const AskAva: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for future AI integration
    console.log('Question submitted:', message);
    setMessage('');
  };

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-colors duration-200 overflow-hidden"
      >
        <img
          src="https://images.pexels.com/photos/1858175/pexels-photo-1858175.jpeg?auto=compress&cs=tinysrgb&w=400"
          alt="Ava Assistant"
          className="w-6 h-6 object-cover rounded-full"
        />
      </button>

      {/* Chat modal */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <img
                src="https://images.pexels.com/photos/1858175/pexels-photo-1858175.jpeg?auto=compress&cs=tinysrgb&w=400"
                alt="Ava Assistant"
                className="w-8 h-8 object-cover rounded-full"
              />
              <h3 className="text-lg font-semibold text-slate-100">Ask Ava</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 h-96 overflow-y-auto">
            <div className="space-y-4">
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-300">Hi! I'm Ava, your subnet assistant. Ask me anything about your validator, mempool, or subnet health.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your question..."
                className="flex-1 bg-slate-700 text-slate-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="submit"
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors duration-200"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default AskAva;