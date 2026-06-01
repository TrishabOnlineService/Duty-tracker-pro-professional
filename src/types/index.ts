export type DutyStatus = 'Present' | 'Half Day' | 'Leave' | 'Sick' | 'Holiday' | 'Off';

export interface AttendanceEntry {
  t: DutyStatus;
  ot?: string;
  lt?: string;
  shift?: 'Morning' | 'Evening' | 'Night';
}

export interface AdvanceEntry {
  amt: number;
  date: string;
  by?: string;
  note?: string;
  key?: string;
}

export interface AppConfig {
  cur: string;
  sal: number;
  otr: number;
  food: number;
  pf: number;
  target: number;
}

export interface UserProfile {
  name: string;
  img: string;
  email: string;
}

export interface SubscriptionHistory {
  amount: number;
  currency: string;
  date: number;
  method: string;
  orderId?: string;
  plan?: string;
  txid?: string;
}

export interface RewardState {
  telegram_joined: number;
  whatsapp_joined: number;
  reward_claimed: number;
  reward_expiry_date: number | null;
  claimed_at?: number;
}

export interface PaymentRequest {
  key?: string;
  uid: string;
  plan: string;
  amount: number;
  currency: string;
  txid: string;
  screenshot: string;
  status: 'pending' | 'approved';
  createdAt: number;
  planDays: number;
  activated?: boolean;
  activatedAt?: number;
}

export interface Country {
  n: string;
  c: string;
}

export interface AppState {
  uid: string | null;
  data: Record<string, AttendanceEntry>;
  adv: Record<string, AdvanceEntry>;
  sub: number;
  conf: AppConfig;
  profile: UserProfile;
  profBase64: string | null;
  refCode: string;
  history: Record<string, SubscriptionHistory>;
  checkin: { time: string; timestamp: number; date: string } | null;
  checkout: { time: string; timestamp: number; date: string } | null;
  reward: RewardState;
  pin: string;
  updateActionTaken: boolean;
  binanceRequests: Record<string, PaymentRequest>;
  selectedPlan: 'monthly' | '6months' | 'yearly';
}
