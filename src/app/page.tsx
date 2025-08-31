/**
 * Main page - redirects to new dev_plan_02 implementation
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new dev_plan_02 implementation
    router.push('/v2');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Redirecting to White Soul Tarot v2.0...
        </h1>
        <p className="text-gray-600">
          Loading the new advanced TTS pipeline with content-addressable caching
        </p>
      </div>
    </div>
  );
}