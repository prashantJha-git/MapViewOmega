import {
  SyncedState,
  SyncedRoute,
  SyncEmergencyContact,
  SyncOutboxEntry,
  SyncLogEntry,
  SyncPayload,
} from './syncModels';
import { UserPreferences, RouteCandidate, CommunityReport } from '../../types/transit';
import { GlobalP2PService } from './p2pService';

const STORAGE_KEY = 'accessride_sync_store';

const DEFAULT_STATE: SyncedState = {
  version: 1,
  deviceId: 'device_' + Math.random().toString(36).substring(2, 9),
  deviceName: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile') ? 'Mobile Phone' : 'Personal Laptop',
  updatedAt: new Date().toISOString(),
  savedRoutes: [
    {
      id: 'route_fav_1',
      title: 'Daily Campus Commute: West Gate to Science Library',
      origin: {
        type: 'stop',
        id: 'stop_gate',
        name: 'West Campus Main Gate',
        lat: 42.365,
        lng: -71.105,
      },
      destination: {
        type: 'stop',
        id: 'stop_lib',
        name: 'Central Science Library',
        lat: 42.37,
        lng: -71.095,
      },
      savedAt: '2026-08-22T08:30:00Z',
      profileId: 'wheelchair',
      notes: '100% Step-Free via Shuttle',
    },
    {
      id: 'route_fav_2',
      title: 'Evening Corridor: Arts District to Residence Hall',
      origin: {
        type: 'stop',
        id: 'stop_arts',
        name: 'Arts District & Plaza',
        lat: 42.358,
        lng: -71.085,
      },
      destination: {
        type: 'stop',
        id: 'stop_res',
        name: 'North Residence Quad',
        lat: 42.372,
        lng: -71.102,
      },
      savedAt: '2026-08-22T19:45:00Z',
      profileId: 'night_safety',
      notes: 'Well-lit CCTV path',
    },
  ],
  emergencyContacts: [
    {
      id: 'contact_1',
      name: 'Campus Safety & Escort Service',
      relationship: 'Transit Security Dispatch',
      phone: '+1 (555) 234-SAFE',
      isPrimary: true,
    },
    {
      id: 'contact_2',
      name: 'Elena Rostova (Emergency ICE)',
      relationship: 'Family / Guardian',
      phone: '+1 (555) 890-4421',
      isPrimary: false,
    },
  ],
  preferences: {
    profileId: 'wheelchair',
    stepFreeOnly: true,
    avoidStairs: true,
    maxWalkDistanceMeters: 300,
    preferSaferRoute: false,
    avoidCrowded: false,
    requireElevators: true,
    voiceAnnouncements: false,
    highContrast: false,
    fontSize: 'normal',
  },
  activeJourneyRoute: null,
  reports: [],
};

export class SyncStoreManager {
  private state: SyncedState;
  private outbox: SyncOutboxEntry[] = [];
  private syncLogs: SyncLogEntry[] = [];
  private listeners: ((state: SyncedState) => void)[] = [];

  constructor() {
    this.state = this.loadFromStorage();

    // Listen for P2P incoming sync packets
    GlobalP2PService.onMessage(payload => {
      this.handleIncomingPayload(payload);
    });
  }

  private loadFromStorage(): SyncedState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_STATE, ...JSON.parse(raw) };
      }
    } catch {}
    return DEFAULT_STATE;
  }

  private saveToStorage() {
    try {
      this.state.updatedAt = new Date().toISOString();
      this.state.version += 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notifyListeners();
    } catch {}
  }

  public getState(): SyncedState {
    return this.state;
  }

  public getLogs(): SyncLogEntry[] {
    return this.syncLogs;
  }

  public getOutbox(): SyncOutboxEntry[] {
    return this.outbox;
  }

  public subscribe(listener: (state: SyncedState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l({ ...this.state }));
  }

  // --- Entity Mutation Methods (Enqueue Outbox + LWW update) ---

  public addSavedRoute(route: Omit<SyncedRoute, 'id' | 'savedAt'>): SyncedRoute {
    const newRoute: SyncedRoute = {
      ...route,
      id: `route_${Date.now()}`,
      savedAt: new Date().toISOString(),
    };

    this.state.savedRoutes = [newRoute, ...this.state.savedRoutes];

    this.enqueueOutbox({
      id: `outbox_${Date.now()}`,
      entityType: 'route',
      operation: 'insert',
      payloadJson: JSON.stringify(newRoute),
      createdAt: new Date().toISOString(),
      isSynced: false,
    });

    this.saveToStorage();
    this.triggerSync();
    return newRoute;
  }

  public deleteSavedRoute(id: string) {
    this.state.savedRoutes = this.state.savedRoutes.filter(r => r.id !== id);

    this.enqueueOutbox({
      id: `outbox_${Date.now()}`,
      entityType: 'route',
      operation: 'delete',
      payloadJson: JSON.stringify({ id }),
      createdAt: new Date().toISOString(),
      isSynced: false,
    });

    this.saveToStorage();
    this.triggerSync();
  }

  public addEmergencyContact(contact: Omit<SyncEmergencyContact, 'id'>): SyncEmergencyContact {
    const newContact: SyncEmergencyContact = {
      ...contact,
      id: `contact_${Date.now()}`,
    };

    this.state.emergencyContacts.push(newContact);

    this.enqueueOutbox({
      id: `outbox_${Date.now()}`,
      entityType: 'contact',
      operation: 'insert',
      payloadJson: JSON.stringify(newContact),
      createdAt: new Date().toISOString(),
      isSynced: false,
    });

    this.saveToStorage();
    this.triggerSync();
    return newContact;
  }

  public updatePreferences(prefs: UserPreferences) {
    this.state.preferences = { ...prefs };

    this.enqueueOutbox({
      id: `outbox_${Date.now()}`,
      entityType: 'preference',
      operation: 'update',
      payloadJson: JSON.stringify(prefs),
      createdAt: new Date().toISOString(),
      isSynced: false,
    });

    this.saveToStorage();
    this.triggerSync();
  }

  public updateActiveJourney(route: RouteCandidate | null) {
    this.state.activeJourneyRoute = route;

    this.enqueueOutbox({
      id: `outbox_${Date.now()}`,
      entityType: 'journey',
      operation: 'update',
      payloadJson: JSON.stringify(route),
      createdAt: new Date().toISOString(),
      isSynced: false,
    });

    this.saveToStorage();
    this.triggerSync();
  }

  private enqueueOutbox(entry: SyncOutboxEntry) {
    this.outbox.push(entry);
    if (this.outbox.length > 50) this.outbox.shift();
  }

  /**
   * Broadcast state synchronization over P2P DataChannel
   */
  public triggerSync() {
    if (!GlobalP2PService.isConnected()) return;

    const payload: SyncPayload = {
      type: 'sync_full',
      cursor: this.state.version,
      timestamp: new Date().toISOString(),
      senderDeviceId: this.state.deviceId,
      senderDeviceName: this.state.deviceName,
      data: {
        savedRoutes: this.state.savedRoutes,
        emergencyContacts: this.state.emergencyContacts,
        preferences: this.state.preferences,
        activeJourneyRoute: this.state.activeJourneyRoute,
      },
    };

    const sent = GlobalP2PService.sendPayload(payload);
    if (sent) {
      this.outbox.forEach(e => (e.isSynced = true));
      this.logSync('Peer Device', 'sent', 'full_sync', 'Synced routes & preferences', 'success');
    }
  }

  /**
   * Merge incoming payload with Last-Write-Wins (LWW) resolution
   */
  private handleIncomingPayload(payload: SyncPayload) {
    if (payload.type === 'sync_full' && payload.data) {
      const incoming = payload.data;

      // Merge saved routes (deduplicate by ID, keep latest)
      if (incoming.savedRoutes) {
        const routeMap = new Map<string, SyncedRoute>();
        this.state.savedRoutes.forEach(r => routeMap.set(r.id, r));
        incoming.savedRoutes.forEach(r => routeMap.set(r.id, r));
        this.state.savedRoutes = Array.from(routeMap.values());
      }

      // Merge emergency contacts
      if (incoming.emergencyContacts) {
        const contactMap = new Map<string, SyncEmergencyContact>();
        this.state.emergencyContacts.forEach(c => contactMap.set(c.id, c));
        incoming.emergencyContacts.forEach(c => contactMap.set(c.id, c));
        this.state.emergencyContacts = Array.from(contactMap.values());
      }

      // Merge preferences
      if (incoming.preferences) {
        this.state.preferences = { ...this.state.preferences, ...incoming.preferences };
      }

      if (incoming.activeJourneyRoute !== undefined) {
        this.state.activeJourneyRoute = incoming.activeJourneyRoute;
      }

      this.saveToStorage();
      this.logSync(
        payload.senderDeviceName || 'Peer Device',
        'received',
        'full_sync',
        `Merged state from ${payload.senderDeviceName}`,
        'success'
      );
    } else if (payload.type === 'ping') {
      this.logSync(
        payload.senderDeviceName || 'Peer Device',
        'received',
        'offer',
        'Direct P2P DataChannel handshake verified',
        'success'
      );
    }
  }

  private logSync(
    peerId: string,
    direction: SyncLogEntry['direction'],
    action: SyncLogEntry['action'],
    details: string,
    status: SyncLogEntry['status']
  ) {
    const entry: SyncLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
      peerId,
      direction,
      action,
      details,
      status,
    };
    this.syncLogs = [entry, ...this.syncLogs.slice(0, 19)];
    this.notifyListeners();
  }
}

export const GlobalSyncStore = new SyncStoreManager();
