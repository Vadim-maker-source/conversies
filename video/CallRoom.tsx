'use client';

import {
  StreamCall,
  SpeakerLayout,
  CallControls,
} from '@stream-io/video-react-sdk';
import { useCall } from './useCall';

type Props = {
  roomId: string;
  active: boolean;
};

export function CallRoom({ roomId, active }: Props) {
  const call = useCall(roomId, active);

  if (!call) return null;

  return (
    <StreamCall call={call}>
      <div className="flex h-full flex-col bg-black">
        <div className="flex-1">
          <SpeakerLayout />
        </div>

        <div className="border-t border-zinc-800 p-4">
          <CallControls />
        </div>
      </div>
    </StreamCall>
  );
}