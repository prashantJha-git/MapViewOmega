import { SyncPayload } from './syncModels';

export type PeerConnectionStatus =
  | 'disconnected'
  | 'creating_offer'
  | 'waiting_for_answer'
  | 'connecting'
  | 'connected'
  | 'failed';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class P2PService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private status: PeerConnectionStatus = 'disconnected';
  private messageListeners: ((payload: SyncPayload) => void)[] = [];
  private statusListeners: ((status: PeerConnectionStatus) => void)[] = [];
  private sosListeners: ((sos: NonNullable<SyncPayload['emergencySos']>) => void)[] = [];

  public getStatus(): PeerConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'connected' && this.dataChannel?.readyState === 'open';
  }

  public onMessage(listener: (payload: SyncPayload) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }

  public onStatusChange(listener: (status: PeerConnectionStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  public onSosReceived(
    listener: (sos: NonNullable<SyncPayload['emergencySos']>) => void
  ): () => void {
    this.sosListeners.push(listener);
    return () => {
      this.sosListeners = this.sosListeners.filter(l => l !== listener);
    };
  }

  private setStatus(newStatus: PeerConnectionStatus) {
    this.status = newStatus;
    this.statusListeners.forEach(listener => listener(newStatus));
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      this.setStatus('connected');
      // Send handshake ping
      this.sendPayload({
        type: 'ping',
        cursor: Date.now(),
        timestamp: new Date().toISOString(),
        senderDeviceId: 'local_device',
        senderDeviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Phone' : 'Desktop Browser',
      });
    };

    channel.onclose = () => {
      this.setStatus('disconnected');
    };

    channel.onerror = () => {
      this.setStatus('failed');
    };

    channel.onmessage = event => {
      try {
        const payload: SyncPayload = JSON.parse(event.data);

        if (payload.type === 'sos_beacon' && payload.emergencySos) {
          this.sosListeners.forEach(l => l(payload.emergencySos!));
        }

        this.messageListeners.forEach(l => l(payload));
      } catch (err) {
        console.warn('Failed to parse incoming P2P payload:', err);
      }
    };
  }

  /**
   * Device A: Create SDP Offer for pairing
   */
  public async createOffer(): Promise<string> {
    this.close();
    this.setStatus('creating_offer');

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    // Create Data Channel
    const dc = pc.createDataChannel('accessride-p2p-sync', { ordered: true });
    this.setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete so all candidates are embedded in the offer
    await this.waitForIceGathering(pc);
    this.setStatus('waiting_for_answer');

    const offerObj = pc.localDescription;
    return btoa(JSON.stringify(offerObj));
  }

  /**
   * Device B: Accept Offer and Generate Answer
   */
  public async acceptOffer(offerTokenBase64: string): Promise<string> {
    this.close();
    this.setStatus('connecting');

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    pc.ondatachannel = event => {
      this.setupDataChannel(event.channel);
    };

    const offerObj: RTCSessionDescriptionInit = JSON.parse(atob(offerTokenBase64));
    await pc.setRemoteDescription(new RTCSessionDescription(offerObj));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait for ICE gathering
    await this.waitForIceGathering(pc);

    const answerObj = pc.localDescription;
    return btoa(JSON.stringify(answerObj));
  }

  /**
   * Device A: Accept Answer to complete direct WebRTC handshake
   */
  public async acceptAnswer(answerTokenBase64: string): Promise<void> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');

    this.setStatus('connecting');
    const answerObj: RTCSessionDescriptionInit = JSON.parse(atob(answerTokenBase64));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerObj));
  }

  /**
   * Send JSON sync payload over DataChannel
   */
  public sendPayload(payload: SyncPayload): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }
    this.dataChannel.send(JSON.stringify(payload));
    return true;
  }

  /**
   * Broadcast emergency SOS beacon over P2P DataChannel
   */
  public broadcastSos(
    senderName: string = 'User',
    location?: [number, number],
    message: string = 'Emergency SOS Alert Triggered!'
  ): boolean {
    return this.sendPayload({
      type: 'sos_beacon',
      cursor: Date.now(),
      timestamp: new Date().toISOString(),
      senderDeviceId: 'local_device',
      senderDeviceName: senderName,
      emergencySos: {
        location,
        timestamp: new Date().toLocaleTimeString(),
        message,
        senderName,
      },
    });
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);

      // 3.5 second safety timeout in case some STUN servers stall
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 3500);
    });
  }

  public close() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
    this.setStatus('disconnected');
  }
}

export const GlobalP2PService = new P2PService();
