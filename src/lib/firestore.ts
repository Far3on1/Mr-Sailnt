import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';

// =================== SERVICES ===================
export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  category?: string;
  createdAt: unknown;
}

export const getServices = async (): Promise<Service[]> => {
  const q = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
};

export const addService = async (data: Omit<Service, 'id' | 'createdAt'>) => {
  return addDoc(collection(db, 'services'), { ...data, createdAt: serverTimestamp() });
};

export const updateService = async (id: string, data: Partial<Service>) => {
  return updateDoc(doc(db, 'services', id), data);
};

export const deleteService = async (id: string) => {
  return deleteDoc(doc(db, 'services', id));
};

// =================== USERS ===================
export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  balance: number;
  role: string;
  createdAt: unknown;
}

export const getAllUsers = async (): Promise<UserRecord[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => d.data() as UserRecord);
};

export const getUserByEmail = async (email: string): Promise<UserRecord | null> => {
  const snap = await getDocs(collection(db, 'users'));
  const user = snap.docs.find(d => d.data().email === email);
  return user ? (user.data() as UserRecord) : null;
};

export const addBalanceToUser = async (uid: string, amount: number, note: string) => {
  await updateDoc(doc(db, 'users', uid), { balance: increment(amount) });
  await addDoc(collection(db, 'transactions'), {
    userId: uid,
    type: 'credit',
    amount,
    note,
    createdAt: serverTimestamp(),
  });
};

export const getUserTransactions = async (uid: string) => {
  const snap = await getDocs(collection(db, 'transactions'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((t: any) => t.userId === uid)
    .sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
};

// =================== PURCHASE ===================
export interface TransactionRecord {
  id: string;
  userId: string;
  userEmail?: string;
  displayName?: string;
  type: 'credit' | 'purchase';
  amount: number;
  serviceId?: string;
  serviceName?: string;
  targetNumber?: string;
  whatsappNumber?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  note: string;
  createdAt: any;
}

export const purchaseService = async (
  uid: string,
  userEmail: string,
  displayName: string,
  service: Service,
  userBalance: number,
  targetNumber: string,
  whatsappNumber: string
) => {
  if (userBalance < service.price) throw new Error('الرصيد غير كافٍ');
  await updateDoc(doc(db, 'users', uid), { balance: increment(-service.price) });
  await addDoc(collection(db, 'transactions'), {
    userId: uid,
    userEmail,
    displayName,
    type: 'purchase',
    amount: -service.price,
    serviceId: service.id,
    serviceName: service.name,
    targetNumber,
    whatsappNumber,
    status: 'pending',
    note: `شراء خدمة: ${service.name}`,
    createdAt: serverTimestamp(),
  });
};

export const getAllTransactions = async (): Promise<TransactionRecord[]> => {
  const snap = await getDocs(collection(db, 'transactions'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TransactionRecord))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

export const updateOrderStatus = async (txId: string, status: 'pending' | 'in_progress' | 'completed') => {
  await updateDoc(doc(db, 'transactions', txId), { status });
};

// =================== DEPOSIT REQUESTS ===================
export interface DepositRequest {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  amount: number;
  senderPhone: string;
  receiptImage: string; // Base64 representation
  status: 'pending' | 'approved' | 'rejected';
  method?: string; // 'orange_cash' | 'instapay'
  createdAt: any;
}

export const createDepositRequest = async (
  userId: string,
  userEmail: string,
  displayName: string,
  amount: number,
  senderPhone: string,
  receiptImage: string,
  method: string = 'orange_cash'
) => {
  await addDoc(collection(db, 'deposit_requests'), {
    userId,
    userEmail,
    displayName,
    amount,
    senderPhone,
    receiptImage,
    status: 'pending',
    method,
    createdAt: serverTimestamp(),
  });
};

export const getDepositRequests = async (): Promise<DepositRequest[]> => {
  const snap = await getDocs(collection(db, 'deposit_requests'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as DepositRequest))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

export const approveDepositRequest = async (requestId: string, userId: string, amount: number, userEmail: string) => {
  // Update request status
  await updateDoc(doc(db, 'deposit_requests', requestId), { status: 'approved' });
  // Add balance to user
  await updateDoc(doc(db, 'users', userId), { balance: increment(amount) });
  // Log credit transaction
  await addDoc(collection(db, 'transactions'), {
    userId,
    userEmail,
    type: 'credit',
    amount,
    note: `شحن رصيد مقبول`,
    createdAt: serverTimestamp(),
  });
};

export const rejectDepositRequest = async (requestId: string) => {
  await updateDoc(doc(db, 'deposit_requests', requestId), { status: 'rejected' });
};

// =================== PAYMENT SETTINGS ===================
export interface PaymentSettings {
  orangeCashNumber: string;
  instaPayNumber: string;
}

export const getPaymentSettings = async (): Promise<PaymentSettings> => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'payment'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        orangeCashNumber: data.orangeCashNumber || '01201426302',
        instaPayNumber: data.instaPayNumber || '01201426302',
      };
    }
  } catch (e) {
    console.error('Error fetching settings:', e);
  }
  return {
    orangeCashNumber: '01201426302',
    instaPayNumber: '01201426302',
  };
};

export const updatePaymentSettings = async (settings: PaymentSettings) => {
  await setDoc(doc(db, 'settings', 'payment'), settings);
};


