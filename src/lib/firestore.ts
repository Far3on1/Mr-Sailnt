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
  targetNumber: string,
  whatsappNumber: string,
  senderPhone: string,
  receiptImage: string,
  paymentMethod: string
) => {
  await addDoc(collection(db, 'transactions'), {
    userId: uid,
    userEmail,
    displayName,
    type: 'purchase',
    amount: service.price,
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

  // Send Telegram Notification to Admin via serverless route handler (bypasses CORS)
  try {
    const settings = await getPaymentSettings();
    if (settings.telegramBotToken && settings.telegramChatId) {
      const message = `🔔 طلب خدمة جديد!
👤 العميل: ${displayName} (${userEmail})
🛠 الخدمة: ${service.name}
💰 السعر: ${service.price} ج.م
🎯 الرقم المطلوب: ${targetNumber}
📞 واتساب للتواصل: ${whatsappNumber}
💵 طريقة الدفع: ${paymentMethod === 'orange_cash' ? 'فودافون/أورنج كاش' : 'انستاباي'}
📱 حساب المحول منه: ${senderPhone}`;

      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: settings.telegramBotToken,
          chatId: settings.telegramChatId,
          message: message,
          receiptImage: receiptImage,
        }),
      });

      if (!res.ok) {
        console.error('API route failed, sending text fallback...');
        await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: message + '\n\n⚠️ (فشل رفع الصورة إلى تليجرام، يرجى مراجعتها من لوحة الأدمن)',
          }),
        });
      }
    }

    // Send background Push Notification to Admin via Firebase Cloud Messaging
    try {
      const settings = await getPaymentSettings();
      if (settings.fcmServerKey) {
        const tokens = await getAdminPushTokens();
        if (tokens.length > 0) {
          await fetch('/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serverKey: settings.fcmServerKey,
              tokens: tokens,
              title: 'طلب خدمة جديد 🔔',
              body: `العميل ${displayName} طلب خدمة "${service.name}"`,
            }),
          });
        }
      }
    } catch (err) {
      console.error('Error triggering FCM push:', err);
    }
  } catch (e) {
    console.error('Error sending Telegram notification:', e);
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
      await triggerUserPushNotification(userId, title, body);
    }
  } catch (err) {
    console.error('Error in status update notifications:', err);
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
    await triggerUserPushNotification(userId, title, body);
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
      await triggerUserPushNotification(userId, title, body);
    }
  } catch (err) {
    console.error('Error sending deposit rejection notifications:', err);
  }
};

// =================== PAYMENT SETTINGS ===================
export interface PaymentSettings {
  orangeCashNumber: string;
  instaPayNumber: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  fcmServerKey?: string;
  fcmVapidKey?: string;
}

export const getPaymentSettings = async (): Promise<PaymentSettings> => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'payment'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        orangeCashNumber: data.orangeCashNumber || '01201426302',
        instaPayNumber: data.instaPayNumber || '01201426302',
        telegramBotToken: data.telegramBotToken || '',
        telegramChatId: data.telegramChatId || '',
        fcmServerKey: data.fcmServerKey || '',
        fcmVapidKey: data.fcmVapidKey || '',
      };
    }
  } catch (e) {
    console.error('Error fetching settings:', e);
  }
  return {
    orangeCashNumber: '01201426302',
    instaPayNumber: '01201426302',
    telegramBotToken: '',
    telegramChatId: '',
    fcmServerKey: '',
    fcmVapidKey: '',
  };
};

export const updatePaymentSettings = async (settings: PaymentSettings) => {
  await setDoc(doc(db, 'settings', 'payment'), settings);
};

// =================== ADMIN PUSH TOKENS ===================
export const saveAdminPushToken = async (adminUid: string, token: string) => {
  await setDoc(doc(db, 'admin_push_tokens', adminUid), {
    token,
    updatedAt: serverTimestamp(),
  });
};

export const getAdminPushTokens = async (): Promise<string[]> => {
  const snap = await getDocs(collection(db, 'admin_push_tokens'));
  return snap.docs.map(d => d.data().token).filter(t => !!t);
};

// =================== USER NOTIFICATIONS & PUSH TOKENS ===================

export interface UserNotification {
  id?: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
}

export const saveUserPushToken = async (userId: string, token: string) => {
  await setDoc(doc(db, 'user_push_tokens', userId), {
    token,
    updatedAt: serverTimestamp(),
  });
};

export const getUserPushTokens = async (userId: string): Promise<string[]> => {
  const snap = await getDoc(doc(db, 'user_push_tokens', userId));
  if (snap.exists() && snap.data()?.token) {
    return [snap.data().token];
  }
  return [];
};

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

export const triggerUserPushNotification = async (userId: string, title: string, body: string) => {
  try {
    const settings = await getPaymentSettings();
    if (settings.fcmServerKey) {
      const tokens = await getUserPushTokens(userId);
      if (tokens.length > 0) {
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverKey: settings.fcmServerKey,
            tokens: tokens,
            title: title,
            body: body,
            clickAction: '/dashboard',
          }),
        });
      }
    }
  } catch (err) {
    console.error('Error sending user push notification:', err);
  }
};


