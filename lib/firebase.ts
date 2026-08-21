import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'

export type StarkUser = {
  uid: string
  email: string
  displayName: string
}

type Listener = (user: StarkUser | null) => void

const AUTH_DELAY = 650 // simulate network latency for realistic UX

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => Boolean(value))

class MockAuth {
  private currentUser: StarkUser | null = null
  private listeners = new Set<Listener>()

  onAuthStateChanged(cb: Listener) {
    this.listeners.add(cb)
    cb(this.currentUser)
    return () => this.listeners.delete(cb)
  }

  private emit() {
    this.listeners.forEach((l) => l(this.currentUser))
  }

  private makeUser(email: string, displayName?: string): StarkUser {
    return {
      uid: `uid_${email.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      email,
      displayName: displayName || email.split('@')[0],
    }
  }

  createUserWithEmailAndPassword(email: string, password: string, displayName?: string) {
    return new Promise<StarkUser>((resolve, reject) => {
      setTimeout(() => {
        if (!email.includes('@')) return reject(new Error('Enter a valid email address.'))
        if (password.length < 6) return reject(new Error('Password must be at least 6 characters.'))
        this.currentUser = this.makeUser(email, displayName)
        this.emit()
        resolve(this.currentUser)
      }, AUTH_DELAY)
    })
  }

  signInWithEmailAndPassword(email: string, password: string) {
    return new Promise<StarkUser>((resolve, reject) => {
      setTimeout(() => {
        if (!email.includes('@')) return reject(new Error('Enter a valid email address.'))
        if (password.length < 6) return reject(new Error('Incorrect email or password.'))
        this.currentUser = this.makeUser(email)
        this.emit()
        resolve(this.currentUser)
      }, AUTH_DELAY)
    })
  }

  signOut() {
    return new Promise<void>((resolve) => {
      this.currentUser = null
      this.emit()
      resolve()
    })
  }
}

const firebaseApp = hasFirebaseConfig ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig)) : null
export { firebaseApp }
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null

class FirebaseAuthAdapter {
  private app = firebaseApp
  private auth = firebaseAuth

  private mapUser(user: User | null): StarkUser | null {
    if (!user) return null

    return {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
    }
  }

  onAuthStateChanged(cb: Listener) {
    if (!this.auth) return new MockAuth().onAuthStateChanged(cb)

    return onAuthStateChanged(this.auth, (user) => cb(this.mapUser(user)))
  }

  async createUserWithEmailAndPassword(email: string, password: string, displayName?: string) {
    if (!this.auth) {
      return new MockAuth().createUserWithEmailAndPassword(email, password, displayName)
    }

    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password)

    if (displayName?.trim()) {
      await updateProfile(userCredential.user, { displayName })
    }

    return this.mapUser(userCredential.user) as StarkUser
  }

  async signInWithEmailAndPassword(email: string, password: string) {
    if (!this.auth) {
      return new MockAuth().signInWithEmailAndPassword(email, password)
    }

    const userCredential = await signInWithEmailAndPassword(this.auth, email, password)
    return this.mapUser(userCredential.user) as StarkUser
  }

  async signOut() {
    if (!this.auth) {
      return new MockAuth().signOut()
    }

    await signOut(this.auth)
  }
}

export const authService = hasFirebaseConfig ? new FirebaseAuthAdapter() : new MockAuth()
export const mockAuth = authService
