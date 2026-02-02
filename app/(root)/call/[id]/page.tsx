'use client'

import { useEffect, useState } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { StreamProvider } from '@/video/StreamProvider';
import { useCall } from '@/video/useCall';
import { CallInterface } from '@/components/CallInterface';

export default function CallPage() {
  const params = useParams();
  const roomId = params.id as string
  const [showCall, setShowCall] = useState(true);

  const call = useCall(`chat-${roomId}`, showCall);

  if (!call) return <div>Loading call...</div>;

  return (
    <StreamProvider>
      {showCall && (
        <CallInterface
          roomId={roomId}
          onClose={() => setShowCall(false)}
        />
      )}
    </StreamProvider>
  );
}
