import { useEffect, useRef, useState } from 'react';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';

export function useCall(roomId: string, enabled: boolean) {
  const client = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    if (!client || !enabled) return;

    const call = client.call('default', roomId);
    setCall(call);

    return () => {
      call.leave();
      setCall(null);
    };
  }, [client, roomId, enabled]);

  return call;
}

