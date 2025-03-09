# SceneSound

A web application that analyzes images and text to recommend music based on the detected scenes.

## Deployment Information

- Frontend: Deployed on Vercel (https://scene-sound.vercel.app)
- Backend: Deployed on Fly.io (https://scenesound-backend.fly.dev)
- Database: None (Stateless application)

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_BACKEND_URL=https://scenesound-backend.fly.dev
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### Backend
The backend service is configured to run on Fly.io with the following specifications:
- Memory: 1GB RAM
- CPU: 1 shared CPU
- Region: Tokyo (nrt)

## Development

1. Clone the repository
```bash
git clone [your-repository-url]
cd SceneSound
```

2. Install dependencies:
```bash
npm install  # Frontend dependencies
cd python_service && pip install -r requirements.txt  # Backend dependencies
```

3. Set up environment variables
- Copy `.env.example` to `.env`
- Fill in the required API keys and configuration:
  - Spotify API credentials

4. Run the development servers:
```bash
npm run dev  # Frontend
python python_service/app.py  # Backend
```

## Deployment

### Frontend
```bash
npm run build
npm run start
```

### Backend
```bash
fly deploy
```

## Features
- Image scene analysis
- Text-based scene matching
- Music recommendations based on scenes
- Spotify preview playback
- Responsive design for mobile and desktop
- Image upload and preview
- Real-time playlist recommendations

## Technologies
- Frontend: Next.js, React
- Backend: Python, Flask
- Deployment: Vercel (Frontend), Fly.io (Backend)
- APIs: Spotify Web API
- File Processing: Multer

## API Key Setup

### Spotify API
1. Visit Spotify Developer Dashboard
2. Create a new application
3. Obtain Client ID and Client Secret

## Usage Instructions

1. Visit the website homepage
2. Click the upload button to select an image or enter text
3. Wait for the system to analyze and generate recommended playlists
4. View the recommended music list

## Important Notes

- Image upload size limit: 5MB
- Ensure all environment variables are correctly configured
- Stable internet connection required for API access
- Image compression is automatically applied when needed
- Both image and text inputs can be used together

## Troubleshooting

If you encounter issues with Git permissions, follow these steps:

1. Close all running development servers and IDE instances.
2. Run the following command in PowerShell as an administrator:
```powershell
Remove-Item -Path ".next" -Recurse -Force
```
3. Rebuild the project:
```bash
npm run build
```
4. Update the `.gitignore` file with the following content:
```
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```
5. Commit and push the changes:
```bash
git add .
git commit -m "Update gitignore and clean build files"
git push
```