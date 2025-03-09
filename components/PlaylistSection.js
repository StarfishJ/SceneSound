import { useState } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import { MusicalNoteIcon, TagIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function PlaylistSection({ playlist, labels, scenes }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [showSpotifyDialog, setShowSpotifyDialog] = useState(false);
  const [selectedSpotifyUrl, setSelectedSpotifyUrl] = useState(null);

  if (!playlist || playlist.length === 0) {
    return null;
  }

  const handleSpotifyClick = (e, spotifyUrl) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSpotifyUrl(spotifyUrl);
    setShowSpotifyDialog(true);
  };

  const handleSpotifyConfirm = () => {
    if (selectedSpotifyUrl) {
      window.open(selectedSpotifyUrl, '_blank');
    }
    setShowSpotifyDialog(false);
  };

  return (
    <div className="max-w-4xl mx-auto mt-12">
      {/* Spotify确认对话框 */}
      {showSpotifyDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              在Spotify中打开
            </h3>
            <p className="text-gray-600 mb-6">
              是否要在Spotify应用中打开并播放这首歌曲？
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowSpotifyDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSpotifyConfirm}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                打开Spotify
              </button>
            </div>
          </div>
        </div>
      )}

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
            <button
              onClick={(e) => handleSpotifyClick(e, track.spotify_url)}
              className="px-3 py-1 text-sm text-green-600 hover:text-green-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              在Spotify打开
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 