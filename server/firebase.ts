import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const REALTIME_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://iot-scanner-a05cb-default-rtdb.asia-southeast1.firebasedatabase.app';

function getFirebaseCredentials(): ServiceAccount {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    console.log('Firebase: Using credentials from environment variables');
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  }

  const possiblePaths = [
    join(process.cwd(), 'server', 'firebase-credentials.json'),
    join(process.cwd(), 'firebase-credentials.json'),
    'server/firebase-credentials.json',
    'firebase-credentials.json',
  ];

  for (const credentialsPath of possiblePaths) {
    if (existsSync(credentialsPath)) {
      try {
        const content = readFileSync(credentialsPath, 'utf8');
        const parsed = JSON.parse(content);
        console.log(`Firebase: Using credentials from ${credentialsPath}`);
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        };
      } catch (error) {
        console.error(`Failed to read ${credentialsPath}:`, error);
      }
    }
  }

  console.error(`
====================================
Firebase Configuration Required
====================================

To connect to your Firebase Realtime Database, you have two options:

OPTION 1: Add credentials file (Recommended for development)
------------------------------------------------------------
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key" 
3. Save the downloaded JSON file as: server/firebase-credentials.json

OPTION 2: Use environment variables (Recommended for production)
----------------------------------------------------------------
Set these in Replit Secrets:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL  
- FIREBASE_PRIVATE_KEY

====================================
`);
  throw new Error('Firebase credentials not found. Please add firebase-credentials.json to the server folder or set environment variables.');
}

const credentials = getFirebaseCredentials();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: credentials.projectId,
      clientEmail: credentials.clientEmail,
      privateKey: credentials.privateKey,
    }),
    databaseURL: REALTIME_DATABASE_URL,
  });
}

export const db = admin.database();
export const firestoreDb = admin.firestore();
export default admin;
