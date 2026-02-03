'use client';

import { useCall, useCallStateHooks } from '@stream-io/video-react-sdk';

export function CallControls({ onLeave }: { onLeave: () => void }) {
  const call = useCall();

  const {
    useMicrophoneState,
    useCameraState,
    useScreenShareState,
  } = useCallStateHooks();

  const mic = useMicrophoneState();
  const cam = useCameraState();
  const screen = useScreenShareState();

  if (!call) return null;

  return (
    <div>
      <button onClick={() => mic.isEnabled ? call.microphone.disable() : call.microphone.enable()}>
        Mic
      </button>

      <button onClick={() => cam.isEnabled ? call.camera.disable() : call.camera.enable()}>
        Cam
      </button>

      <button onClick={() => screen.isEnabled ? call.screenShare.disable() : call.screenShare.enable()}>
        Screen
      </button>

      <button onClick={onLeave}>Leave</button>
    </div>
  );
}
