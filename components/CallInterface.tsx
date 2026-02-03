'use client';

import {
  StreamCall,
  SpeakerLayout,
  Call,
  useStreamVideoClient,
} from '@stream-io/video-react-sdk';
import { useState } from 'react';
import { CallControls } from '@/video/CallControls';

type Props = {
  roomId: string;
};

export function CallInterface({ roomId }: Props) {
  const client = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);

  const joinCall = async () => {
    if (!client) return;

    const newCall = client.call('default', roomId);
    await newCall.join({ create: true });
    setCall(newCall);
  };

  if (!call) {
    return (
      <button onClick={joinCall}>
        Join call
      </button>
    );
  }

  return (
    <StreamCall call={call}>
      <SpeakerLayout />
      <CallControls onLeave={() => call.leave()} />
    </StreamCall>
  );
}
