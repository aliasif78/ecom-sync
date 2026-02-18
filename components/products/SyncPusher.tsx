'use client';

// React
import { useEffect } from 'react';

// Next Js
import { useRouter } from 'next/navigation';

// Dependencies
import Pusher from 'pusher-js';

// Shadcn
import { toast } from 'sonner';

export default function SyncPusherHandler({ userId }: { userId: string }) {
  // Hooks
  const router = useRouter();

  // Effects
  useEffect(() => {
    // 1. Initialize Pusher
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! });

    // 2. Subscribe to the user's specific channel
    const channel = pusher.subscribe(userId);

    // 3. Listen for the 'sync-finished' event
    channel.bind('sync-finished', (data: { message: string }) => {
      toast.success(data.message);
      router.refresh(); // 🔥 This is the magic: Refresh the server components
    });

    return () => {
      pusher.unsubscribe(userId);
      pusher.disconnect();
    };
  }, [userId, router]);

  return null;
}
