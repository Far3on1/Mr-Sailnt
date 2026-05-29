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
  where,
} from 'firebase/firestore';
import { db, auth } from './firebase';

// =================== SERVICES ===================
export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  vipPrice?: number;
  resellerPrice?: number;
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
  tier?: 'normal' | 'vip' | 'reseller';
  createdAt: unknown;
}

export const getAllUsers = async (): Promise<UserRecord[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => d.data() as UserRecord);
};

export const updateUserTier = async (uid: string, tier: 'normal' | 'vip' | 'reseller') => {
  return updateDoc(doc(db, 'users', uid), { tier });
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
  const q = query(collection(db, 'transactions'), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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
  targetNumber: string,
  whatsappNumber: string,
  senderPhone: string,
  receiptImage: string,
  paymentMethod: string,
  tier: 'normal' | 'vip' | 'reseller' = 'normal'
) => {
  let price = service.price;
  if (tier === 'vip') {
    price = service.vipPrice ?? service.price;
  } else if (tier === 'reseller') {
    price = service.resellerPrice ?? service.price;
  }

  await addDoc(collection(db, 'transactions'), {
    userId: uid,
    userEmail,
    displayName,
    type: 'purchase',
    amount: price,
    serviceId: service.id,
    serviceName: service.name,
    targetNumber,
    whatsappNumber,
    senderPhone,
    receiptImage,
    paymentMethod,
    status: 'pending',
    note: `شراء خدمة: ${service.name} (دفع مباشر)`,
    createdAt: serverTimestamp(),
  });

  // Send Telegram Notification via server-side /api/notify route
  try {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        userEmail,
        serviceName: service.name,
        servicePrice: price,
        targetNumber,
        whatsappNumber,
        paymentMethod,
        senderPhone,
        receiptImage,
      }),
    }).catch(err => console.error('[purchaseService] Failed to call /api/notify:', err));
  } catch (e) {
    console.error('[purchaseService] Error calling /api/notify:', e);
  }
};

export const getAllTransactions = async (): Promise<TransactionRecord[]> => {
  const snap = await getDocs(collection(db, 'transactions'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TransactionRecord))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

export const updateOrderStatus = async (txId: string, status: 'pending' | 'in_progress' | 'completed') => {
  await updateDoc(doc(db, 'transactions', txId), { status });
  try {
    const txSnap = await getDoc(doc(db, 'transactions', txId));
    if (txSnap.exists()) {
      const tx = txSnap.data();
      const userId = tx.userId;
      const serviceName = tx.serviceName || 'الخدمة المطلوبة';
      
      let title = 'تحديث حالة طلبك 🔔';
      let body = '';
      if (status === 'in_progress') {
        body = `بدأ العمل على طلبك لخدمة "${serviceName}"`;
      } else if (status === 'completed') {
        body = `تم تسليم طلبك لخدمة "${serviceName}" بنجاح! 🎉`;
      } else {
        body = `طلبك لخدمة "${serviceName}" قيد المراجعة الآن`;
      }

      await createNotification(userId, title, body);
    }
  } catch (err) {
    console.error('Error in status update notifications:', err);
  }
};

// Deliver a service result to the client (saves delivery note + marks completed + notifies client)
export const deliverService = async (txId: string, deliveryNote: string) => {
  // 1. Save delivery note and mark as completed
  await updateDoc(doc(db, 'transactions', txId), {
    deliveryNote,
    status: 'completed',
    deliveredAt: serverTimestamp(),
  });

  // 2. Fetch transaction to get userId and serviceName
  try {
    const txSnap = await getDoc(doc(db, 'transactions', txId));
    if (txSnap.exists()) {
      const tx = txSnap.data();
      const userId = tx.userId;
      const serviceName = tx.serviceName || 'الخدمة المطلوبة';
      // Create an in-app notification for the client
      await createNotification(
        userId,
        `✅ تم تسليم خدمة: ${serviceName}`,
        `بياناتك جاهزة! افتح لوحتك لمشاهدة التسليم.`
      );
    }
  } catch (err) {
    console.error('Error notifying client after delivery:', err);
  }
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
  try {
    const title = 'تم قبول شحن الرصيد ✅';
    const body = `تم إضافة مبلغ ${amount} ج.م إلى حسابك بنجاح!`;
    await createNotification(userId, title, body);
  } catch (err) {
    console.error('Error sending deposit approval notifications:', err);
  }
};

export const rejectDepositRequest = async (requestId: string) => {
  await updateDoc(doc(db, 'deposit_requests', requestId), { status: 'rejected' });
  try {
    const reqSnap = await getDoc(doc(db, 'deposit_requests', requestId));
    if (reqSnap.exists()) {
      const reqData = reqSnap.data();
      const userId = reqData.userId;
      const amount = reqData.amount;
      const title = 'تم رفض طلب الشحن ❌';
      const body = `تم رفض طلب شحن الرصيد الخاص بك بمبلغ ${amount} ج.م. يرجى مراجعة الدعم.`;
      await createNotification(userId, title, body);
    }
  } catch (err) {
    console.error('Error sending deposit rejection notifications:', err);
  }
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

// =================== TELEGRAM SECRETS ===================
export interface TelegramSecrets {
  telegramBotToken: string;
  telegramChatId: string;
}

export const getTelegramSecrets = async (): Promise<TelegramSecrets> => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'secrets'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        telegramBotToken: data.telegramBotToken || '',
        telegramChatId: data.telegramChatId || '',
      };
    }
  } catch (e) {
    console.error('Error fetching telegram secrets:', e);
  }
  return {
    telegramBotToken: '',
    telegramChatId: '',
  };
};

export const updateTelegramSecrets = async (secrets: TelegramSecrets) => {
  await setDoc(doc(db, 'settings', 'secrets'), secrets);
};

// =================== USER NOTIFICATIONS ===================

export interface UserNotification {
  id?: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
}

export const createNotification = async (userId: string, title: string, body: string) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      body,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error creating database notification:', err);
  }
};

export const getUserNotifications = async (userId: string): Promise<UserNotification[]> => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as UserNotification))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

export const markNotificationAsRead = async (notificationId: string) => {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
};




