import {
  TripPoint,
  ProfileId,
  UserPreferences,
  RouteCandidate,
  CommunityReport,
} from '../../types/transit';

export interface SyncedRoute {
  id: string;
  title: string;
  origin: TripPoint;
  destination: TripPoint;
  savedAt: string;
  profileId: ProfileId;
  notes?: string;
}

export interface SyncEmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

export interface SyncedState {
  version: number;
  deviceId: string;
  deviceName: string;
  updatedAt: string;
  savedRoutes: SyncedRoute[];
  emergencyContacts: SyncEmergencyContact[];
  preferences: UserPreferences;
  activeJourneyRoute: RouteCandidate | null;
  reports: CommunityReport[];
}

export interface SyncOutboxEntry {
  id: string;
  entityType: 'route' | 'contact' | 'preference' | 'journey' | 'report' | 'sos';
  operation: 'insert' | 'update' | 'delete';
  payloadJson: string;
  createdAt: string;
  isSynced: boolean;
}

export interface SyncPayload {
  type: 'sync_full' | 'sync_delta' | 'sos_beacon' | 'ping' | 'pong';
  cursor: number;
  timestamp: string;
  senderDeviceId: string;
  senderDeviceName: string;
  data?: Partial<SyncedState>;
  emergencySos?: {
    location?: [number, number];
    timestamp: string;
    message: string;
    senderName: string;
  };
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  peerId: string;
  direction: 'sent' | 'received';
  action: 'offer' | 'answer' | 'full_sync' | 'delta_sync' | 'sos_beacon';
  details: string;
  status: 'success' | 'pending' | 'failed';
}
