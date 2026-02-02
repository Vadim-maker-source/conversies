'use client';

import { Call } from '@stream-io/video-react-sdk';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
} from 'lucide-react';

export function CallControls({
  call,
  onLeave,
}: {
  call: Call;
  onLeave: () => void;
}) {
  const mic = call.microphone;
  const cam = call.camera;
  const screen = call.screenShare;

  const toggleMic = async () => {
    mic.enabled ? mic.disable() : mic.enable();
  };

  const toggleCamera = async () => {
    cam.enabled ? cam.disable() : cam.enable();
  };

  const toggleScreen = async () => {
    screen.enabled ? screen.disable() : screen.enable();
  };

  return (
    <div className="flex items-center justify-center gap-4 py-4 bg-black/80">
      <button onClick={toggleMic}>
        {mic.enabled ? <Mic /> : <MicOff />}
      </button>

      <button onClick={toggleCamera}>
        {cam.enabled ? <Video /> : <VideoOff />}
      </button>

      <button onClick={toggleScreen}>
        {screen.enabled ? <ScreenShareOff /> : <ScreenShare />}
      </button>

      <button onClick={onLeave}>
        <PhoneOff />
      </button>
    </div>
  );
}
