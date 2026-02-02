// types/livekit.d.ts
declare module 'livekit-client' {
    export interface LocalParticipant {
      trackPublications: Map<string, LocalTrackPublication>;
      getTrackPublication(sid: string): LocalTrackPublication | undefined;
      stopScreenShare(): void;
      startScreenShare(stream: MediaStream): Promise<void>;
      publishTrack(track: MediaStreamTrack, options?: {
        name?: string;
        source?: Track.Source;
        simulcast?: boolean;
      }): Promise<LocalTrackPublication>;
      unpublishTrack(track: MediaStreamTrack, stopOnUnpublish?: boolean): Promise<void>;
    }
  
    export interface TrackPublication {
      track: Track | undefined;
      trackName: string;
      trackSid: string;
      kind: Track.Kind;
      isMuted: boolean;
      isEnabled: boolean;
      isSubscribed: boolean;
      isSimulcasted: boolean;
      mediaStream?: MediaStream;
    }
  
    export interface LocalTrackPublication extends TrackPublication {
      setMuted(muted: boolean): void;
      setEnabled(enabled: boolean): void;
    }
  
    export interface RemoteParticipant {
      trackPublications: Map<string, RemoteTrackPublication>;
      getTrackPublication(sid: string): RemoteTrackPublication | undefined;
      identity: string;
    }
  
    export interface RemoteTrackPublication extends TrackPublication {
      setSubscribed(subscribed: boolean): void;
    }
  }