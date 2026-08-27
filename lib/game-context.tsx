'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { authService, db, type StarkUser } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

/* ------------------------------- Types ------------------------------- */

export type HobbyColor = 'indigo' | 'emerald' | 'blue'

export type Hobby = {
  id: string
  name: string
  icon: string // lucide icon key
  color: HobbyColor
}

export type Task = {
  id: string
  hobbyId: string
  label: string
  done: boolean
}

export type Expense = {
  id: string
  hobbyId: string
  amount: number
  note: string
  date: number
}

export type RewardEvent = {
  id: string
  kind: 'xp' | 'levelup'
  amount?: number
  level?: number
  message?: string
}

export type SpendMonth = {
  label: string
  amount: number
}

type State = {
  totalXp: number
  hobbies: Hobby[]
  tasks: Task[]
  expenses: Expense[]
  budget: number
  spendingHistory: SpendMonth[]
}

/* --------------------------- XP / Level math -------------------------- */

// XP required to advance FROM a given level to the next.
export function xpToNext(level: number) {
  return 100 + (level - 1) * 60
}

export function computeLevel(totalXp: number) {
  let level = 1
  let remaining = totalXp
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level)
    level += 1
  }
  return { level, xpInLevel: remaining, xpForLevel: xpToNext(level) }
}

/* ------------------------------ Empty state ---------------------------- */

const createEmptyState = (): State => ({
  totalXp: 0,
  hobbies: [],
  tasks: [],
  expenses: [],
  budget: 0,
  spendingHistory: [],
})

/* ------------------------------- Actions ------------------------------ */

type Action =
  | { type: 'AWARD_XP'; amount: number }
  | { type: 'ADD_HOBBY'; hobby: Hobby }
  | { type: 'EDIT_HOBBY'; id: string; name: string; color: HobbyColor; icon: string }
  | { type: 'DELETE_HOBBY'; id: string }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'TOGGLE_TASK'; id: string }
  | { type: 'ADD_EXPENSE'; expense: Expense }
  | { type: 'SET_BUDGET'; amount: number }
  | { type: 'RESET'; state: State }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'AWARD_XP':
      return { ...state, totalXp: Math.max(0, state.totalXp + action.amount) }
    case 'ADD_HOBBY':
      return { ...state, hobbies: [...state.hobbies, action.hobby] }
    case 'EDIT_HOBBY':
      return {
        ...state,
        hobbies: state.hobbies.map((h) =>
          h.id === action.id ? { ...h, name: action.name, color: action.color, icon: action.icon } : h,
        ),
      }
    case 'DELETE_HOBBY':
      return {
        ...state,
        hobbies: state.hobbies.filter((h) => h.id !== action.id),
        tasks: state.tasks.filter((t) => t.hobbyId !== action.id),
        expenses: state.expenses.filter((e) => e.hobbyId !== action.id),
      }
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] }
    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      }
    case 'ADD_EXPENSE':
      return { ...state, expenses: [action.expense, ...state.expenses] }
    case 'SET_BUDGET':
      return { ...state, budget: Math.max(0, action.amount) }
    case 'RESET':
      return action.state
    default:
      return state
  }
}

/* ------------------------------ Context ------------------------------- */

type GameContextValue = {
  user: StarkUser | null
  authLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>

  totalXp: number
  level: number
  xpInLevel: number
  xpForLevel: number

  hobbies: Hobby[]
  tasks: Task[]
  expenses: Expense[]
  budget: number
  spendingHistory: SpendMonth[]

  rewards: RewardEvent[]
  awardXp: (amount: number, message?: string) => void
  addHobby: (data: Omit<Hobby, 'id'>) => void
  editHobby: (id: string, name: string, color: HobbyColor, icon: string) => void
  deleteHobby: (id: string) => void
  addTask: (hobbyId: string, label: string) => void
  toggleTask: (id: string) => void
  addExpense: (hobbyId: string, amount: number, note: string) => void
  setBudget: (amount: number) => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, createEmptyState())
  const [user, setUser] = useState<StarkUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [rewards, setRewards] = useState<RewardEvent[]>([])
  // Guards the save effect below from firing with the empty default state
  // before the initial Firestore load for this user has resolved — otherwise
  // a merge write of empty arrays/zeros can clobber the user's real data.
  const [loadedUid, setLoadedUid] = useState<string | null>(null)

  useEffect(() => {
    const unsub = authService.onAuthStateChanged((u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return () => {
      unsub()
    }
  }, [])

  useEffect(() => {
    if (!user || !db) {
      dispatch({ type: 'RESET', state: createEmptyState() })
      setRewards([])
      setLoadedUid(null)
      return
    }

    const uid = user.uid
    const firestore = db
    let cancelled = false

    async function loadUserState() {
      const snapshot = await getDoc(doc(firestore, 'users', uid))
      if (cancelled) return

      if (snapshot.exists()) {
        dispatch({ type: 'RESET', state: { ...createEmptyState(), ...(snapshot.data() as Partial<State>) } })
      } else {
        dispatch({ type: 'RESET', state: createEmptyState() })
      }
      setRewards([])
      setLoadedUid(uid)
    }

    loadUserState().catch(() => {
      if (!cancelled) {
        dispatch({ type: 'RESET', state: createEmptyState() })
        setRewards([])
        setLoadedUid(uid)
      }
    })

    return () => {
      cancelled = true
    }
  }, [user?.uid])

  useEffect(() => {
    if (!user || !db || loadedUid !== user.uid) return

    const uid = user.uid
    const email = user.email.trim().toLowerCase()
    const firestore = db

    const saveUserState = async () => {
      await setDoc(doc(firestore, 'users', uid), { ...state, email }, { merge: true })
    }

    saveUserState().catch((error) => {
      console.error('Error saving user state to Firestore:', error)
    })
  }, [state, user?.uid, loadedUid])

  const { level, xpInLevel, xpForLevel } = useMemo(
    () => computeLevel(state.totalXp),
    [state.totalXp],
  )

  const pushReward = useCallback((event: Omit<RewardEvent, 'id'>) => {
    const id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setRewards((prev) => [...prev, { ...event, id }])
    setTimeout(() => {
      setRewards((prev) => prev.filter((r) => r.id !== id))
    }, 2600)
  }, [])

  const awardXp = useCallback(
    (amount: number, message?: string) => {
      const before = computeLevel(state.totalXp).level
      const after = computeLevel(state.totalXp + amount).level
      dispatch({ type: 'AWARD_XP', amount })
      if (amount > 0) pushReward({ kind: 'xp', amount, message })
      if (after > before) {
        pushReward({ kind: 'levelup', level: after })
      }
    },
    [state.totalXp, pushReward],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    await authService.signInWithEmailAndPassword(email, password)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    await authService.createUserWithEmailAndPassword(email, password, name)
    dispatch({ type: 'RESET', state: createEmptyState() })
    setRewards([])
  }, [])

  const signOut = useCallback(async () => {
    await authService.signOut()
    dispatch({ type: 'RESET', state: createEmptyState() })
    setRewards([])
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle()
  }, [])

  const addHobby = useCallback(
    (data: Omit<Hobby, 'id'>) => {
      dispatch({ type: 'ADD_HOBBY', hobby: { ...data, id: `h_${Date.now()}` } })
      awardXp(15, 'Nuevo hobby desbloqueado')
    },
    [awardXp],
  )

  const editHobby = useCallback(
    (id: string, name: string, color: HobbyColor, icon: string) =>
      dispatch({ type: 'EDIT_HOBBY', id, name, color, icon }),
    [],
  )

  const deleteHobby = useCallback((id: string) => dispatch({ type: 'DELETE_HOBBY', id }), [])

  const addTask = useCallback((hobbyId: string, label: string) => {
    dispatch({
      type: 'ADD_TASK',
      task: { id: `t_${Date.now()}`, hobbyId, label, done: false },
    })
  }, [])

  const toggleTask = useCallback(
    (id: string) => {
      const task = state.tasks.find((t) => t.id === id)
      dispatch({ type: 'TOGGLE_TASK', id })
      if (task && !task.done) {
        awardXp(10, `+ ${task.label}`)
      }
    },
    [state.tasks, awardXp],
  )

  const addExpense = useCallback(
    (hobbyId: string, amount: number, note: string) => {
      dispatch({
        type: 'ADD_EXPENSE',
        expense: { id: `e_${Date.now()}`, hobbyId, amount, note, date: Date.now() },
      })
      awardXp(5, 'Gasto registrado')
    },
    [awardXp],
  )

  const setBudget = useCallback((amount: number) => dispatch({ type: 'SET_BUDGET', amount }), [])

  const value: GameContextValue = {
    user,
    authLoading,
    signIn,
    register,
    signInWithGoogle,
    signOut,
    totalXp: state.totalXp,
    level,
    xpInLevel,
    xpForLevel,
    hobbies: state.hobbies,
    tasks: state.tasks,
    expenses: state.expenses,
    budget: state.budget,
    spendingHistory: state.spendingHistory,
    rewards,
    awardXp,
    addHobby,
    editHobby,
    deleteHobby,
    addTask,
    toggleTask,
    addExpense,
    setBudget,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
