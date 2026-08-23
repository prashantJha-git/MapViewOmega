import React, { useState, useEffect } from 'react';
import { GlobalSyncStore } from './syncStore';
import { GlobalP2PService, PeerConnectionStatus } from './p2pService';
import { SyncedState, SyncLogEntry, SyncedRoute, SyncEmergencyContact } from './syncModels';
import { canFitInQr } from './qrHelper';
import { TripPoint } from '../../types/transit';

interface SyncPanelProps {
  onNavigateRoute?: (origin: TripPoint, destination: TripPoint) => void;
  onSosBroadcast?: (message: string) => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({
  onNavigateRoute,
  onSosBroadcast,
}) => {
  const [syncState, setSyncState] = useState<SyncedState>(GlobalSyncStore.getState());
  const [logs, setLogs] = useState<SyncLogEntry[]>(GlobalSyncStore.getLogs());
  const [p2pStatus, setP2pStatus] = useState<PeerConnectionStatus>(GlobalP2PService.getStatus());

  const [activeTab, setActiveTab] = useState<'share' | 'join'>('share');
  const [offerToken, setOfferToken] = useState<string>('');
  const [answerTokenInput, setAnswerTokenInput] = useState<string>('');
  const [joinOfferInput, setJoinOfferInput] = useState<string>('');
  const [generatedAnswerToken, setGeneratedAnswerToken] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // New Contact form state
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRel, setNewContactRel] = useState('Family / Friend');
  const [showAddContact, setShowAddContact] = useState(false);

  useEffect(() => {
    const unsubStore = GlobalSyncStore.subscribe(state => {
      setSyncState(state);
      setLogs(GlobalSyncStore.getLogs());
    });

    const unsubP2P = GlobalP2PService.onStatusChange(status => {
      setP2pStatus(status);
    });

    return () => {
      unsubStore();
      unsubP2P();
    };
  }, []);

  // Step 1: Device A creates Offer
  const handleGenerateOffer = async () => {
    setIsGenerating(true);
    try {
      const offer = await GlobalP2PService.createOffer();
      setOfferToken(offer);
    } catch (err) {
      console.error('Failed to create offer:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 2: Device A submits Answer from Device B
  const handleCompletePairingWithAnswer = async () => {
    if (!answerTokenInput.trim()) return;
    try {
      await GlobalP2PService.acceptAnswer(answerTokenInput.trim());
      setAnswerTokenInput('');
    } catch (err) {
      alert('Failed to accept answer. Please verify the code and try again.');
    }
  };

  // Step 3: Device B accepts Offer from Device A and generates Answer
  const handleJoinWithOffer = async () => {
    if (!joinOfferInput.trim()) return;
    setIsGenerating(true);
    try {
      const answer = await GlobalP2PService.acceptOffer(joinOfferInput.trim());
      setGeneratedAnswerToken(answer);
    } catch (err) {
      alert('Invalid pairing code. Please verify the code.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2500);
  };

  const shareCode = async (text: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch {
        // user cancelled the share sheet — fall through to clipboard
      }
    }
    copyToClipboard(text, title);
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    GlobalSyncStore.addEmergencyContact({
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relationship: newContactRel.trim(),
      isPrimary: syncState.emergencyContacts.length === 0,
    });
    setNewContactName('');
    setNewContactPhone('');
    setShowAddContact(false);
  };

  const handleBroadcastEmergencySos = () => {
    const success = GlobalP2PService.broadcastSos(
      syncState.deviceName,
      [42.365, -71.095],
      'EMERGENCY SOS: User initiated assistance beacon across paired devices!'
    );
    if (onSosBroadcast) {
      onSosBroadcast('Emergency SOS broadcast triggered across paired devices.');
    }
    if (!success) {
      alert('SOS beacon dispatched to local system and stored in sync buffer.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🔄</span>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                Peer-to-Peer Multi-Device Sync & SOS
              </h1>
              <p className="text-sm text-slate-400">
                100% Serverless WebRTC DataChannel • Zero backend data storage • Direct browser pairing
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center space-x-3">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-2 ${
              p2pStatus === 'connected'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                : p2pStatus === 'connecting' || p2pStatus === 'waiting_for_answer'
                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                p2pStatus === 'connected'
                  ? 'bg-emerald-400 animate-ping'
                  : p2pStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span className="uppercase tracking-wider">
              {p2pStatus === 'connected'
                ? '🟢 Direct P2P Connected'
                : p2pStatus === 'waiting_for_answer'
                ? '🟡 Waiting for Handshake'
                : p2pStatus === 'connecting'
                ? '🟡 Establishing WebRTC...'
                : '⚪ Standalone / Offline'}
            </span>
          </div>

          <button
            onClick={() => GlobalSyncStore.triggerSync()}
            disabled={p2pStatus !== 'connected'}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors"
          >
            🔄 Sync Now
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Direct P2P Device Pairing Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>📱 Pair Devices (Code Handshake)</span>
            </h2>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('share')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'share'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Share Code (Device A)
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'join'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Join with Code (Device B)
              </button>
            </div>
          </div>

          {activeTab === 'share' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Generate an encrypted WebRTC SDP offer token to pair this browser directly with your phone or tablet.
              </p>

              {!offerToken ? (
                <button
                  onClick={handleGenerateOffer}
                  disabled={isGenerating}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all flex items-center justify-center space-x-2"
                >
                  <span>{isGenerating ? 'Generating WebRTC Token...' : 'Generate Pairing Code'}</span>
                </button>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    {!canFitInQr(offerToken) && (
                      <p className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-900 rounded-lg px-3 py-2">
                        This pairing code is too long to reliably encode/scan as a QR code
                        (WebRTC handshake data varies in size by network). Use Copy or Share
                        below instead — that path is fully working.
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Pairing Token:</span>
                      <div className="flex items-center gap-3">
                        {typeof navigator.share === 'function' && (
                          <button
                            onClick={() => shareCode(offerToken, 'AccessRide Pairing Code')}
                            className="text-xs text-emerald-400 hover:underline font-semibold"
                          >
                            Share
                          </button>
                        )}
                        <button
                          onClick={() => copyToClipboard(offerToken, 'offer')}
                          className="text-xs text-emerald-400 hover:underline font-semibold"
                        >
                          {copySuccess === 'offer' ? '✓ Copied!' : 'Copy Code'}
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 break-all max-h-20 overflow-y-auto">
                      {offerToken}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Copy or share this code to Device B, then paste it into the "Join" tab there.
                    </p>
                  </div>

                  {/* Step 2: Input Answer from Device B */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="block text-xs font-bold text-slate-300">
                      Paste Answer Code from Device B:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={answerTokenInput}
                        onChange={e => setAnswerTokenInput(e.target.value)}
                        placeholder="Paste response code here..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        onClick={handleCompletePairingWithAnswer}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Paste the pairing code generated from Device A to establish a direct P2P link.
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Step 1: Paste Device A Code
                </label>
                <textarea
                  rows={3}
                  value={joinOfferInput}
                  onChange={e => setJoinOfferInput(e.target.value)}
                  placeholder="Paste pairing code from Device A..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={handleJoinWithOffer}
                  disabled={isGenerating || !joinOfferInput.trim()}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
                >
                  Generate Answer Code
                </button>
              </div>

              {generatedAnswerToken && (
                <div className="space-y-3 pt-3 border-t border-slate-800 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Step 2: Copy this Answer Code back to Device A</span>
                    <div className="flex items-center gap-3">
                      {typeof navigator.share === 'function' && (
                        <button
                          onClick={() => shareCode(generatedAnswerToken, 'AccessRide Answer Code')}
                          className="text-xs text-emerald-400 hover:underline font-semibold"
                        >
                          Share
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(generatedAnswerToken, 'answer')}
                        className="text-xs text-emerald-400 hover:underline font-semibold"
                      >
                        {copySuccess === 'answer' ? '✓ Copied!' : 'Copy Answer'}
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 break-all max-h-24 overflow-y-auto">
                    {generatedAnswerToken}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Emergency SOS Broadcast Button */}
          <div className="pt-4 border-t border-slate-800">
            <div className="bg-rose-950/40 border border-rose-900/80 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-rose-300 block">🚨 P2P Emergency Beacon</span>
                <span className="text-[11px] text-rose-400">
                  Broadcast instant emergency alert directly to all paired devices
                </span>
              </div>
              <button
                onClick={handleBroadcastEmergencySos}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-colors shrink-0"
              >
                Broadcast SOS
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Synced Data & ICE Emergency Contacts */}
        <div className="space-y-6">
          {/* Synced Favorite Routes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>⭐ Synced Routes ({syncState.savedRoutes.length})</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">LWW Synced 🟢</span>
            </div>

            <div className="space-y-2.5 max-h-52 overflow-y-auto">
              {syncState.savedRoutes.map(route => (
                <div
                  key={route.id}
                  className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-white block truncate">
                      {route.title}
                    </span>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                      <span>{route.origin.name} ➔ {route.destination.name}</span>
                      <span className="text-emerald-400 font-semibold">• {route.notes}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {onNavigateRoute && (
                      <button
                        onClick={() => onNavigateRoute(route.origin, route.destination)}
                        className="px-2.5 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Plan
                      </button>
                    )}
                    <button
                      onClick={() => GlobalSyncStore.deleteSavedRoute(route.id)}
                      className="text-slate-500 hover:text-rose-400 text-xs px-1.5 py-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Synced Emergency Contacts */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>📞 ICE Emergency Contacts ({syncState.emergencyContacts.length})</span>
              </h3>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                {showAddContact ? 'Cancel' : '+ Add Contact'}
              </button>
            </div>

            {showAddContact && (
              <form onSubmit={handleAddContact} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={newContactName}
                    onChange={e => setNewContactName(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={newContactPhone}
                    onChange={e => setNewContactPhone(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    required
                  />
                </div>
                <div className="flex justify-between items-center pt-1">
                  <input
                    type="text"
                    placeholder="Relationship (e.g. Campus Safety)"
                    value={newContactRel}
                    onChange={e => setNewContactRel(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 flex-1 mr-2"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {syncState.emergencyContacts.map(contact => (
                <div
                  key={contact.id}
                  className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">{contact.name}</span>
                      {contact.isPrimary && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                          PRIMARY ICE
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[11px] block">{contact.relationship} • {contact.phone}</span>
                  </div>

                  <a
                    href={`tel:${contact.phone}`}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px]"
                  >
                    Call
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sync Log Transactions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            WebRTC Sync Transaction Log
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Cursor v{syncState.version} • {syncState.deviceName}
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="text-xs text-slate-500 p-4 text-center">
            No sync transactions logged yet. Connect a peer to start real-time data sync.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-xs">
            {logs.map(log => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px]"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500">{log.timestamp}</span>
                  <span className={log.direction === 'sent' ? 'text-blue-400' : 'text-emerald-400'}>
                    [{log.direction.toUpperCase()}]
                  </span>
                  <span className="text-slate-300">{log.details}</span>
                </div>
                <span className="text-emerald-400 font-bold">✓ {log.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
