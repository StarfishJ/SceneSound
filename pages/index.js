import SceneAnalyzer from '../components/SceneAnalyzer';
import Head from 'next/head';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Head>
        <title>SceneSound - Music for Your Moments</title>
        <meta name="description" content="Upload images and get AI-recommended music playlists" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <SceneAnalyzer />
    </div>
  );
} 