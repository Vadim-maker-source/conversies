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
        {mic.enabled ? <Mic className='text-white' /> : <MicOff className='text-white' />}
      </button>

      <button onClick={toggleCamera}>
        {cam.enabled ? <Video className='text-white' /> : <VideoOff className='text-white' />}
      </button>

      <button onClick={toggleScreen}>
        {screen.enabled ? <ScreenShareOff className='text-white' /> : <ScreenShare className='text-white' />}
      </button>

      <button onClick={onLeave}>
        <PhoneOff className='text-white' />
      </button>
    </div>
  );
}
