import { useState } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import { MusicalNoteIcon, TagIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function PlaylistSection({ playlist, labels, scenes }) {
  const [currentTrack, setCurrentTrack] = useState(null);

  if (!playlist || playlist.length === 0) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto mt-12">
      {/* 场景标签 */}
      {scenes && scenes.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">识别到的场景：</h3>
          <div className="flex flex-wrap gap-2">
            {scenes.map((scene, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {scene}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 播放器 */}
      {currentTrack && (
        <div className="mb-8 bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center gap-4 mb-4">
            <img
              src={currentTrack.album_image || '/default-album.jpg'}
              alt={currentTrack.name}
              className="w-16 h-16 rounded-lg shadow"
            />
            <div>
              <h3 className="font-semibold text-gray-900">{currentTrack.name}</h3>
              <p className="text-gray-600">{currentTrack.artist}</p>
            </div>
          </div>
          <AudioPlayer
            src={currentTrack.preview_url}
            showJumpControls={false}
            layout="stacked"
            customProgressBarSection={[]}
            customControlsSection={["MAIN_CONTROLS", "VOLUME_CONTROLS"]}
            autoPlayAfterSrcChange={false}
          />
        </div>
      )}

      {/* 播放列表 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">推荐的音乐</h2>
        <div className="space-y-4">
          {playlist.map((track, index) => (
            <div
              key={index}
              className={`flex items-center gap-4 p-3 rounded-lg transition-colors cursor-pointer
                ${currentTrack?.spotify_url === track.spotify_url
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-gray-50'
                }`}
              onClick={() => setCurrentTrack(track)}
            >
              <img
                src={track.album_image || '/default-album.jpg'}
                alt={track.name}
                className="w-12 h-12 rounded shadow"
              />
              <div className="flex-grow">
                <h3 className="font-medium text-gray-900">{track.name}</h3>
                <p className="text-sm text-gray-600">{track.artist}</p>
              </div>
              <a
                href={track.spotify_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-sm text-green-600 hover:text-green-700"
                onClick={(e) => e.stopPropagation()}
              >
                在 Spotify 上播放
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 