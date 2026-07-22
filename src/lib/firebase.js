import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Firebase web config for project `defencegardenbooking` — the SAME project the
// booking app uses, so one Google account signs into both ERPs. These are PUBLIC
// client identifiers; the server secret lives in rgaccountbackend/secrets/.
const firebaseConfig = {
  apiKey: 'AIzaSyBKcYLCcg2STjyr5oGX3EoUTZA-NeavfwM',
  authDomain: 'defencegardenbooking.firebaseapp.com',
  projectId: 'defencegardenbooking',
  storageBucket: 'defencegardenbooking.firebasestorage.app',
  messagingSenderId: '860382390967',
  appId: '1:860382390967:web:8c1625a43fa58f95c2fb32',
  measurementId: 'G-NSNZYN1CKG',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Run the Google sign-in popup and return a Firebase ID token for the backend.
 * Firebase's own client session is discarded immediately — the app's session is
 * the backend-issued JWT pair, same as password login.
 */
export async function googleSignInForIdToken() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const idToken = await cred.user.getIdToken();
  await signOut(auth).catch(() => { /* local session cleanup only */ });
  return idToken;
}
