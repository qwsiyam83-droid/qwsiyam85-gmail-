import React, { useState } from 'react';
import { Contact } from '../types/assistant';
import { deviceBridge } from '../services/deviceBridge';
import { Phone, UserPlus, Trash2, X, Users, Info } from 'lucide-react';

interface ContactManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactManagerModal: React.FC<ContactManagerModalProps> = ({ isOpen, onClose }) => {
  const [contacts, setContacts] = useState<Contact[]>(() => deviceBridge.getContacts());
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRel, setNewRel] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const added = deviceBridge.addContact({
      name: newName.trim(),
      phone: newPhone.trim(),
      relationship: newRel.trim() || undefined,
    });
    setContacts(deviceBridge.getContacts());
    setNewName('');
    setNewPhone('');
    setNewRel('');
  };

  const handleDelete = (id: string) => {
    deviceBridge.deleteContact(id);
    setContacts(deviceBridge.getContacts());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl relative text-slate-100 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Contacts & Phone Bridge</h3>
            <p className="text-xs text-slate-400">Used by Arushi for "Call Mom", "Call Rahul", etc.</p>
          </div>
        </div>

        <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-xs text-indigo-200 mb-4 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
          <div>
            <span className="font-semibold text-indigo-300">Try these voice tests:</span>
            <ul className="list-disc list-inside mt-1 text-slate-300 space-y-0.5">
              <li><strong>"Call Mom"</strong> or <strong>"Mummy ko call karo"</strong> → Calls +91 98765 43210</li>
              <li><strong>"Call Rahul"</strong> → Arushi detects two Rahuls and asks which one!</li>
              <li><strong>"Call Rahul Sharma"</strong> → Directly dials Rahul Sharma</li>
            </ul>
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-850/60 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-white truncate">{c.name}</span>
                  {c.relationship && (
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {c.relationship}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                  <Phone className="w-3 h-3 text-cyan-400" />
                  <span className="font-mono">{c.phone}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => deviceBridge.makeCall(c.phone)}
                  className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                  title="Test Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Contact Form */}
        <form onSubmit={handleAdd} className="pt-3 border-t border-slate-800 flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-300">Add Test Contact:</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Name (e.g. Boss)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              required
            />
            <input
              type="tel"
              placeholder="Phone (e.g. 9876543210)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              required
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tag (e.g. Work)"
                value={newRel}
                onChange={(e) => setNewRel(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shrink-0 flex items-center gap-1 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
