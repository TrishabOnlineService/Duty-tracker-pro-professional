import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { AdService } from './services/AdService';
import { countries, filterCountries } from './utils/countries';
import { legalTexts } from './utils/legalTexts';
import {
  AppState,
  AttendanceEntry,
  AdvanceEntry,
  AppConfig,
  UserProfile,
  SubscriptionHistory,
  PaymentRequest,
  DutyStatus,
  Country
} from './types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// Configurations
const RZP_KEY = "rzp_live_Rz7kQ4RAloCWGp";
const IMG_API_KEY = "c762b5315ee9263c36ed04156b0ff758";
const PAYPAL_MONTHLY_URL = "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-88K63194J33940531NHJKNBY";
const PAYPAL_YEARLY_URL = "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-8DG31605KT644052BNHJKOTQ";

export default function App() {
  // State variables for application
  const [uid, setUid] = useState<string | null>(() => localStorage.getItem('dt_id'));
  const [data, setData] = useState<Record<string, AttendanceEntry>>({});
  const [adv, setAdv] = useState<Record<string, AdvanceEntry>>({});
  const [sub, setSub] = useState<number>(0);
  const [conf, setConf] = useState<AppConfig>({ cur: '₹', sal: 0, otr: 0, food: 0, pf: 0, target: 0 });
  const [profile, setProfile] = useState<UserProfile>({ name: '', img: '', email: '' });
  const [profBase64, setProfBase64] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string>('');
  const [historyList, setHistoryList] = useState<SubscriptionHistory[]>([]);
  const [checkin, setCheckin] = useState<{ time: string; timestamp: number; date: string } | null>(null);
  const [checkout, setCheckout] = useState<{ time: string; timestamp: number; date: string } | null>(null);
  const [reward, setReward] = useState({ telegram_joined: 0, whatsapp_joined: 0, reward_claimed: 0 });
  const [binanceRequests, setBinanceRequests] = useState<PaymentRequest[]>([]);
  const [priceConfig, setPriceConfig] = useState({
    razorpay: { monthly: 5, sixmonths: 20, yearly: 50 },
    paypal: { monthly: 1, yearly: 5 }
  });

  // UI Control states
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'reports' | 'graph' | 'advance' | 'settings' | 'history' | 'refer' | 'payments' | 'help' | 'feedback' | 'about' | 'legal'>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'dark');
  const [showModal, setShowModal] = useState<string | null>(null); // 'attendance' | 'binance' | 'confirm' | 'reward' | 'pin' | 'update' | 'maintenance' | 'legal_text'
  const [legalType, setLegalType] = useState<string>('privacy');
  
  // Forms states
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authCountry, setAuthCountry] = useState<Country>({ n: "India", c: "+91" });
  const [authPin, setAuthPin] = useState('');
  const [authPinConfirm, setAuthPinConfirm] = useState('');
  
  // Country searchable states
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryModal, setShowCountryModal] = useState<'login' | 'signup' | null>(null);

  // PWA Support States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Attendance Entry states
  const [selDate, setSelDate] = useState<string>('');
  const [selStatus, setSelStatus] = useState<DutyStatus>('Present');
  const [inpOt, setInpOt] = useState('');
  const [inpLate, setInpLate] = useState('');
  const [inpShift, setInpShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');

  // Advance Entry states
  const [advAmt, setAdvAmt] = useState('');
  const [advDate, setAdvDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [advBy, setAdvBy] = useState('');
  const [advNote, setAdvNote] = useState('');

  // Target goal update
  const [targetGoalInput, setTargetGoalInput] = useState('');

  // Report dates
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const [reportHtml, setReportHtml] = useState<React.ReactElement | null>(null);

  // PIN lock system
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinMode, setPinMode] = useState<'verify' | 'set' | 'change'>('verify');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinBlockedUntil, setPinBlockedUntil] = useState<number | null>(() => {
    const val = localStorage.getItem('pin_blocked_until');
    return val ? parseInt(val) : null;
  });
  const [pinBlockTimeRemaining, setPinBlockTimeRemaining] = useState<number>(0);
  const [savedPinInDb, setSavedPinInDb] = useState('');

  // Inactivity auto-lock
  const [autoLockMinutes, setAutoLockMinutes] = useState(() => parseInt(localStorage.getItem('auto_lock_minutes') || '5'));

  // Binance payment state
  const [binancePlan, setBinancePlan] = useState<'monthly' | '6months' | 'yearly'>('monthly');
  const [binanceTx, setBinanceTx] = useState('');
  const [binanceImageFile, setBinanceImageFile] = useState<File | null>(null);
  const [binancePreviewUrl, setBinancePreviewUrl] = useState('');

  // Feedback, referral input
  const [fbText, setFbText] = useState('');
  const [friendRefCode, setFriendRefCode] = useState('');

  // System states
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("We're currently performing scheduled maintenance to improve your experience.");
  const [maintenanceTime, setMaintenanceTime] = useState("Approximately 30 minutes");
  const [forceUpdateConfig, setForceUpdateConfig] = useState({ status: false, title: "Update Available!", message: "A new version is available.", telegramLink: "https://telegram.me/DutyTrackerProapp", downloadLink: "https://dutytracker-admin.vercel.app/" });

  // Confirmation Callback
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDesc, setConfirmDesc] = useState('');
  const [confirmCallback, setConfirmCallback] = useState<() => void>(() => {});

  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Refs for visuals
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<any>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const isPremiumUser = sub > Date.now();

  // Load and subscribe config
  useEffect(() => {
    // Config: Maintenance
    db.ref('config/maintenance').on('value', (snap) => {
      setIsMaintenance(snap.val() || false);
    });
    db.ref('config/maintenanceMessage').on('value', (snap) => {
      setMaintenanceMsg(snap.val() || "We're performing scheduled maintenance.");
    });
    db.ref('config/maintenanceTime').on('value', (snap) => {
      setMaintenanceTime(snap.val() || "Approximately 30 minutes");
    });
    // Pricing config
    db.ref('config/prices').on('value', (snap) => {
      const p = snap.val();
      if (p) {
        setPriceConfig({
          razorpay: {
            monthly: p.razorpay_monthly || 5,
            sixmonths: p.razorpay_6months || 20,
            yearly: p.razorpay_yearly || 50
          },
          paypal: {
            monthly: p.paypal_monthly || 1,
            yearly: p.paypal_yearly || 5
          }
        });
      }
    });

    // Forced update config
    db.ref('config/forcedUpdate').on('value', (snap) => {
      const val = snap.val();
      if (val) {
        setForceUpdateConfig(prev => ({ ...prev, ...val }));
      }
    });
  }, []);

  // Listen for PWA invitation to install
  useEffect(() => {
    const handleBeforePrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforePrompt);

    // If app is already started in standalone (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setShowInstallBanner(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
  }, []);

  const handlePwaInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setShowInstallBanner(false);
          setDeferredPrompt(null);
          showToast("Thank you for installing Duty Tracker Pro!");
        }
      } catch (err) {
        console.error("Installation error:", err);
      }
    } else {
      // Manual prompt steps for iOS Safari and other browsers
      showModalPwaInfo();
    }
  };

  const showModalPwaInfo = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
       alert("📲 INSTALL ROOTED PROTOCOL:\n\n1. Tap the Share button at the bottom of Safari.\n2. Scroll down & select 'Add to Home Screen'.\n3. Start using premium tracker!");
    } else {
       alert("📲 PWA INSTALL PILOT:\n\n1. Click the Browser options (3-dots list) on top right.\n2. Select 'Install app' or 'Add to Home Screen'.\n3. Launch from your home screen directly!");
    }
  };

  // Dynamic Body spacing controller depending on authentication state
  useEffect(() => {
    if (!uid) {
      document.body.style.height = 'auto';
      document.body.style.minHeight = '100vh';
      document.body.style.paddingBottom = '0px';
      document.body.style.overflowY = 'auto';
    } else {
      document.body.style.height = '100vh';
      document.body.style.paddingBottom = 'var(--nav-height)';
      document.body.style.overflowY = 'hidden';
    }
    return () => {
      document.body.style.height = '';
      document.body.style.minHeight = '';
      document.body.style.paddingBottom = '';
      document.body.style.overflowY = '';
    };
  }, [uid]);

  // Ads service listener
  useEffect(() => {
    AdService.updateAds(isPremiumUser);
  }, [sub]);

  // Sync user profile data once authenticated
  useEffect(() => {
    if (!uid) return;

    const userRef = db.ref('u/' + uid);
    userRef.on('value', (snap) => {
      const val = snap.val() || {};
      setData(val.att || {});
      setAdv(val.adv || {});
      setConf(val.conf || { cur: '₹', sal: 0, otr: 0, food: 0, pf: 0, target: 0 });
      setProfile(val.profile || { name: 'User', img: '', email: '' });
      setSub(val.subExp || Date.now() + (3 * 86400000));
      setRefCode(val.refCode || '');
      setSavedPinInDb(val.pin || '');
      setCheckin(val.checkin || null);
      setCheckout(val.checkout || null);
      setReward(val.reward || { telegram_joined: 0, whatsapp_joined: 0, reward_claimed: 0 });

      // Subscription History
      const hlist: SubscriptionHistory[] = [];
      if (val.history) {
        for (let k in val.history) {
          hlist.push({ ...val.history[k] });
        }
        hlist.reverse();
      }
      setHistoryList(hlist);
    });

    // Binance requests sync
    db.ref(`binance_payments/${uid}`).on('value', (snap) => {
      const val = snap.val() || {};
      const reqList: PaymentRequest[] = [];
      for (let key in val) {
        reqList.push({ ...val[key], key });
      }
      reqList.reverse();
      setBinanceRequests(reqList);

      // Trigger automatic activation check for any approved payments
      for (let req of reqList) {
        if (req.status === 'approved' && !req.activated) {
          activateApprovedBinance(req);
        }
      }
    });

    return () => {
      userRef.off();
      db.ref(`binance_payments/${uid}`).off();
    };
  }, [uid]);

  // Activate Binance Sub
  const activateApprovedBinance = async (req: PaymentRequest) => {
    if (!uid || !req.key) return;
    const computedExp = Date.now() + (req.planDays * 24 * 60 * 60 * 1000);
    const updates: Record<string, any> = {};
    updates[`u/${uid}/subExp`] = computedExp;
    updates[`binance_payments/${uid}/${req.key}/activated`] = true;
    updates[`binance_payments/${uid}/${req.key}/activatedAt`] = Date.now();
    updates[`u/${uid}/history/${req.key}`] = {
      amount: req.amount,
      currency: req.currency,
      date: Date.now(),
      method: "Binance USDT",
      txid: req.txid
    };

    await db.ref().update(updates);
    showToast(`🎉 Binance plan ${req.plan} Activated!`);
  };

  // Activity lock listener
  useEffect(() => {
    if (!uid) return;

    const autoLockMs = autoLockMinutes * 60 * 1000;
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (savedPinInDb && pinVerified) {
          setPinVerified(false);
          setPinMode('verify');
          setCurrentView('home');
          showToast("🔒 App auto-locked due to inactivity.");
        }
      }, autoLockMs);
    };

    const handleInput = () => resetTimer();
    window.addEventListener('touchstart', handleInput, { passive: true });
    window.addEventListener('click', handleInput, { passive: true });
    window.addEventListener('keydown', handleInput, { passive: true });

    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('touchstart', handleInput);
      window.removeEventListener('click', handleInput);
      window.removeEventListener('keydown', handleInput);
    };
  }, [uid, pinVerified, savedPinInDb, autoLockMinutes]);

  // PIN lockout ticker
  useEffect(() => {
    if (!pinBlockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((pinBlockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setPinBlockedUntil(null);
        localStorage.removeItem('pin_blocked_until');
        setPinBlockTimeRemaining(0);
        setPinAttempts(0);
        clearInterval(interval);
      } else {
        setPinBlockTimeRemaining(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pinBlockedUntil]);

  // Chart Rendering
  useEffect(() => {
    if (currentView !== 'graph' || !chartRef.current || !isPremiumUser) return;

    // Build the last 30 days labels and data
    const labels: string[] = [];
    const points: number[] = [];
    const dateToday = new Date();

    for (let i = 29; i >= 0; i--) {
      const refDate = new Date();
      refDate.setDate(dateToday.getDate() - i);
      const iso = refDate.toISOString().split('T')[0];
      labels.push(refDate.getDate().toString());

      const dEntry = data[iso];
      let h = 0;
      if (dEntry) {
        if (dEntry.t === 'Present') h = 8;
        else if (dEntry.t === 'Half Day') h = 4;
        if (dEntry.ot) h += parseFloat(dEntry.ot);
      }
      points.push(h);
    }

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Hours Worked',
          data: points,
          borderColor: '#4361ee',
          backgroundColor: 'rgba(67, 97, 238, 0.1)',
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [currentView, data, isPremiumUser]);

  // Auto show reward modal if applicable
  useEffect(() => {
    if (uid && reward.reward_claimed === 0 && isPremiumUser) {
      const showTimer = setTimeout(() => {
        setShowModal('reward');
      }, 3000);
      return () => clearTimeout(showTimer);
    }
  }, [uid, reward, isPremiumUser]);

  // Auth operations
  const handleLogin = async () => {
    if (authPhone.length < 5) return showToast("Invalid Phone Number");
    if (authPin.length !== 4) return showToast("Enter a 4-digit PIN");

    const fullId = authCountry.c + authPhone;
    db.ref(`u/${fullId}/profile/name`).once('value', (snap) => {
      if (!snap.exists()) {
        showToast("Account not found. Please sign up.");
        return;
      }
      db.ref(`u/${fullId}/pin`).once('value', (pinSnap) => {
        if (pinSnap.val() !== authPin) {
          showToast("❌ Incorrect PIN");
        } else {
          localStorage.setItem('dt_id', fullId);
          setUid(fullId);
          setPinVerified(true);
          showToast(`Welcome back!`);
        }
      });
    });
  };

  const handleSignup = () => {
    const cleanName = authName.trim();
    const cleanEmail = authEmail.trim();

    if (cleanName.length < 2) return showToast("Enter Valid Name");
    if (!cleanEmail.includes('@')) return showToast("Enter Valid Email");
    if (authPhone.length < 5) return showToast("Invalid Phone Number");
    if (authPin.length !== 4) return showToast("PIN must be 4 digits");
    if (authPin !== authPinConfirm) return showToast("PINs do not match");

    const fullId = authCountry.c + authPhone;
    db.ref(`u/${fullId}/profile/name`).once('value', (snap) => {
      if (snap.exists()) {
        showToast("Account already exists. Try login.");
        setActiveTab('login');
      } else {
        const uniqueRef = Math.random().toString(36).substring(2, 8).toUpperCase();
        // Set all details securely
        db.ref(`u/${fullId}`).set({
          profile: { name: cleanName, email: cleanEmail, img: '' },
          pin: authPin,
          refCode: uniqueRef,
          subExp: Date.now() + (3 * 24 * 60 * 60 * 1000) // 3 days trial
        }).then(() => {
          localStorage.setItem('dt_id', fullId);
          setUid(fullId);
          setPinVerified(true);
          db.ref(`analytics/registrations/${fullId}`).set(Date.now());
          showToast("🎉 Sign Up Successful! Enjoy 3 days trial.");
        });
      }
    });
  };

  // Profile management
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast("Uploading Image...");
    const formData = new FormData();
    formData.append('key', IMG_API_KEY);
    formData.append('image', file);

    try {
      const res = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
      });
      const resJson = await res.json();
      if (resJson.success) {
        db.ref(`u/${uid}/profile/img`).set(resJson.data.url);
        showToast("Upload Successful!");
      } else {
        showToast("Failed to upload to server.");
      }
    } catch (err: any) {
      showToast("Error upload: " + err.message);
    }
  };

  // Check in/out tracker
  const handleCheckin = () => {
    if (!uid) return;
    const now = new Date();
    const cleanTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = {
      time: cleanTime,
      timestamp: now.getTime(),
      date: now.toISOString().split('T')[0]
    };
    db.ref(`u/${uid}/checkin`).set(payload);
    setCheckin(payload);
    showToast(`✅ Checked in at ${cleanTime}`);
  };

  const handleCheckout = () => {
    if (!uid) return;
    const now = new Date();
    const cleanTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = {
      time: cleanTime,
      timestamp: now.getTime(),
      date: now.toISOString().split('T')[0]
    };
    db.ref(`u/${uid}/checkout`).set(payload);
    setCheckout(payload);
    showToast(`✅ Checked out at ${cleanTime}`);
  };

  // PIN authentication handlers
  const handlePinNumPress = (num: string) => {
    if (pinBlockedUntil) return;
    if (pinCurrent.length < 4) {
      const nextPin = pinCurrent + num;
      setPinCurrent(nextPin);

      if (nextPin.length === 4) {
        setTimeout(() => handlePinVerification(nextPin), 250);
      }
    }
  };

  const handlePinVerification = (entered: string) => {
    if (pinMode === 'verify') {
      if (entered === savedPinInDb) {
        setPinVerified(true);
        setPinCurrent('');
        showToast("Unlocked securely");
      } else {
        const nextAttempts = pinAttempts + 1;
        setPinAttempts(nextAttempts);
        setPinCurrent('');

        if (nextAttempts >= 3) {
          const block = Date.now() + 30000;
          setPinBlockedUntil(block);
          localStorage.setItem('pin_blocked_until', block.toString());
          showToast("Locked! Too many failed attempts. Wait 30s.");
        } else {
          showToast(`❌ Invalid PIN. ${3 - nextAttempts} attempts remaining.`);
        }
      }
    } else if (pinMode === 'change') {
      if (entered === savedPinInDb) {
        setPinMode('set');
        setPinCurrent('');
        showToast("Enter your new 4-digit PIN");
      } else {
        setPinCurrent('');
        showToast("❌ Current PIN wrong");
      }
    } else if (pinMode === 'set') {
      db.ref(`u/${uid}/pin`).set(entered);
      setSavedPinInDb(entered);
      setPinVerified(true);
      setPinCurrent('');
      setPinMode('verify');
      showToast("✅ PIN changed successfully");
    }
  };

  // Add attendance entries manually
  const openAttendanceModal = (dateStr: string) => {
    setSelDate(dateStr);
    const prev = data[dateStr];
    if (prev) {
      setSelStatus(prev.t);
      setInpOt(prev.ot || '');
      setInpLate(prev.lt || '');
      setInpShift(prev.shift || 'Morning');
    } else {
      setSelStatus('Present');
      setInpOt('');
      setInpLate('');
      setInpShift('Morning');
    }
    setShowModal('attendance');
  };

  const saveAttendanceEntry = () => {
    if (!uid) return;
    const payload: AttendanceEntry = {
      t: selStatus,
      ot: inpOt.trim() || undefined,
      lt: inpLate.trim() || undefined,
      shift: inpShift
    };

    db.ref(`u/${uid}/att/${selDate}`).set(payload).then(() => {
      setShowModal(null);
      showToast("Duty Entry Saved Sucessfully!");
    });
  };

  const deleteAttendanceEntry = () => {
    if (!uid) return;
    db.ref(`u/${uid}/att/${selDate}`).remove().then(() => {
      setShowModal(null);
      showToast("Entry Deleted");
    });
  };

  // Manage Advances logic
  const handleAddAdvance = () => {
    if (!isPremiumUser) {
      setShowModal('promo');
      return;
    }
    const amt = parseFloat(advAmt);
    if (!amt || !advDate) {
      showToast("Enter valid cash amount & date");
      return;
    }

    db.ref(`u/${uid}/adv`).push({
      amt,
      date: advDate,
      by: advBy.trim() || undefined,
      note: advNote.trim() || undefined
    }).then(() => {
      setAdvAmt('');
      setAdvBy('');
      setAdvNote('');
      showToast("Advance Entry saved!");
    });
  };

  const handleDeleteAdvance = (key: string) => {
    setConfirmTitle("Delete Advance Entry");
    setConfirmDesc("Are you sure you want to delete this cash advancement record?");
    setConfirmCallback(() => () => {
      db.ref(`u/${uid}/adv/${key}`).remove().then(() => {
        showToast("Advance cleared");
      });
    });
    setShowModal('confirm');
  };

  // Target Goal Setting
  const handleSetTarget = () => {
    const val = parseFloat(targetGoalInput);
    if (!val) return showToast("Enter a valid amount");

    db.ref(`u/${uid}/conf/target`).set(val).then(() => {
      showToast("Monthly goal set successfully!");
      setTargetGoalInput('');
    });
  };

  // Referrals
  const handleApplyFriendCode = () => {
    const code = friendRefCode.trim().toUpperCase();
    if (!code) return showToast("Enter a valid code");
    if (code === refCode) return showToast("Cannot redeeem your own code!");

    db.ref(`u/${uid}/redeemed`).once('value', (snap) => {
      if (snap.exists()) {
        showToast("You have already redeemed a code!");
        return;
      }

      db.ref('refList/' + code).once('value', (rsnap) => {
        const friendId = rsnap.val();
        if (!friendId) {
          showToast("Invalid code, please double-check");
          return;
        }

        // Apply 10 days boost to both accounts
        const boost = 10 * 24 * 60 * 60 * 1000;
        db.ref(`u/${uid}/subExp`).set(Math.max(sub, Date.now()) + boost);
        db.ref(`u/${uid}/redeemed`).set(true);

        db.ref(`u/${friendId}/subExp`).once('value', (fExpSnap) => {
          const curFriendExp = fExpSnap.val() || Date.now();
          db.ref(`u/${friendId}/subExp`).set(Math.max(curFriendExp, Date.now()) + boost);
        });

        showToast("🎉 Code applied! Both got +10 Days Premium!");
        setFriendRefCode('');
      });
    });
  };

  // Claim Rewards
  const claimRewardPremium = () => {
    const boostDays = 7;
    const newSubExp = Math.max(sub, Date.now()) + (boostDays * 24 * 60 * 60 * 1000);

    const payload = {
      telegram_joined: 1,
      whatsapp_joined: 1,
      reward_claimed: 1,
      reward_expiry_date: newSubExp,
      claimed_at: Date.now()
    };

    db.ref(`u/${uid}/reward`).set(payload);
    db.ref(`u/${uid}/subExp`).set(newSubExp);
    setShowModal(null);
    showToast("🎉 7 Days premium benefit unlocked!");
  };

  // Gateways Razorpay setup
  const executeRazorpay = (plan: 'monthly' | '6months' | 'yearly') => {
    let amt = priceConfig.razorpay.monthly;
    let days = 30;

    if (plan === '6months') {
      amt = priceConfig.razorpay.sixmonths;
      days = 180;
    } else if (plan === 'yearly') {
      amt = priceConfig.razorpay.yearly;
      days = 365;
    }

    const RazorpayWindow = (window as any).Razorpay;
    if (!RazorpayWindow) {
      showToast("Setup engine unavailable. Try online billing.");
      return;
    }

    const options = {
      key: RZP_KEY,
      amount: amt * 100,
      currency: "INR",
      name: "Duty Tracker Pro",
      handler: function(response: any) {
        const now = Date.now();
        db.ref(`u/${uid}/subExp`).set(now + (days * 24 * 60 * 60 * 1000));
        db.ref(`u/${uid}/history`).push({
          amount: amt,
          currency: 'INR',
          date: now,
          method: 'Razorpay',
          orderId: response.razorpay_payment_id,
          plan: plan
        });
        showToast("🎉 Premium successfully activated!");
      },
      modal: {
        ondismiss: function() {
          showToast("Payment aborted");
        }
      },
      theme: { color: "#4361ee" }
    };
    const rzp = new RazorpayWindow(options);
    rzp.open();
  };

  // Binance payment request
  const handleBinancePaymentSubmit = async () => {
    if (!binanceTx.trim()) return showToast("Enter transaction hash");
    if (!binanceImageFile) return showToast("Upload proof of payment screenshot");

    showToast("Uploading database proof...");
    const form = new FormData();
    form.append('key', IMG_API_KEY);
    form.append('image', binanceImageFile);

    try {
      const res = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: form
      });
      const dataJson = await res.json();
      if (dataJson.success) {
        const imgUrl = dataJson.data.url;
        const planInr = binancePlan === 'monthly' ? priceConfig.razorpay.monthly : (binancePlan === '6months' ? priceConfig.razorpay.sixmonths : priceConfig.razorpay.yearly);
        const planDays = binancePlan === 'monthly' ? 30 : (binancePlan === '6months' ? 180 : 365);

        const payload: PaymentRequest = {
          uid: uid!,
          plan: binancePlan,
          amount: planInr,
          currency: 'INR',
          txid: binanceTx.trim(),
          screenshot: imgUrl,
          status: 'pending',
          createdAt: Date.now(),
          planDays: planDays
        };

        await db.ref(`binance_payments/${uid}`).push(payload);
        // Admin notification
        db.ref(`adminNotifications/all`).push({
          title: "New Binance payment submitted",
          body: `${profile.name || uid} sent review proof for ${binancePlan}`,
          timestamp: Date.now(),
          userId: uid
        });

        showToast("✅ Payment proof saved. Manual approval takes 24h.");
        setBinanceTx('');
        setBinanceImageFile(null);
        setBinancePreviewUrl('');
        setShowModal(null);
      } else {
        showToast("Error uploading proof.");
      }
    } catch (err: any) {
      showToast("Upload failed: " + err.message);
    }
  };

  // Report Generator
  const generateSalaryReportLayout = () => {
    if (!isPremiumUser) {
      showToast("Access blocked. Premium required.");
      return;
    }
    const dStart = new Date(reportStart);
    dStart.setHours(0,0,0,0);
    const dEnd = new Date(reportEnd);
    dEnd.setHours(23,59,59,999);

    if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
      showToast("Please enter valid dates");
      return;
    }

    const salRate = conf.sal || 0;
    const foodRate = conf.food || 0;
    const pfDeduct = conf.pf || 0;
    const otRate = conf.otr || 0;

    let totalWorkedDays = 0;
    let basePay = 0;
    let otSum = 0;
    let foodSum = 0;
    let otHoursSum = 0;
    let advancesSum = 0;

    for (let k in data) {
      const entryDate = new Date(k);
      entryDate.setHours(12,0,0,0);
      if (entryDate >= dStart && entryDate <= dEnd) {
        const v = data[k];
        const otVal = parseFloat(v.ot || '0') || 0;

        if (v.t === 'Half Day') {
          totalWorkedDays += 0.5;
          basePay += (salRate / 2);
          foodSum += (foodRate / 2);
        } else if (['Present', 'Holiday', 'Sick'].includes(v.t)) {
          totalWorkedDays += 1;
          basePay += salRate;
          foodSum += foodRate;
        }

        otHoursSum += otVal;
        otSum += (otVal * otRate);
      }
    }

    for (let k in adv) {
      const advEntryDate = new Date(adv[k].date);
      advEntryDate.setHours(12,0,0,0);
      if (advEntryDate >= dStart && advEntryDate <= dEnd) {
        advancesSum += parseFloat(adv[k].amt.toString()) || 0;
      }
    }

    const netPayable = (basePay + otSum + foodSum) - pfDeduct - advancesSum;

    setReportHtml(
      <div className="p-5 mt-5 rounded-2xl bg-zinc-900 border border-zinc-800">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-zinc-800">
          <span className="text-zinc-400 font-bold">Wages Net Pay:</span>
          <span className="text-emerald-400 text-3xl font-extrabold">{conf.cur}{Math.max(0, netPayable).toFixed(0)}</span>
        </div>
        <div className="space-y-2 text-sm text-zinc-300">
          <p className="flex justify-between"><span>Work ({totalWorkedDays} Days):</span> <b>{conf.cur}{basePay.toFixed(0)}</b></p>
          <p className="flex justify-between"><span>Allowance (Food):</span> <b>{conf.cur}{foodSum.toFixed(0)}</b></p>
          <p className="flex justify-between"><span>Overtime ({otHoursSum} Hours):</span> <b>{conf.cur}{otSum.toFixed(0)}</b></p>
          <p className="flex justify-between text-rose-500"><span>Provident Fund (PF):</span> <b>-{conf.cur}{pfDeduct.toFixed(0)}</b></p>
          <p className="flex justify-between text-rose-500"><span>Advance debited:</span> <b>-{conf.cur}{advancesSum.toFixed(0)}</b></p>
        </div>
        <div className="mt-4 pt-4 flex gap-3">
          <button 
            className="btn btn-primary"
            onClick={() => exportToPdfFile(totalWorkedDays, basePay, foodSum, otHoursSum, otSum, pfDeduct, advancesSum, netPayable)}
          >
            <i className="fas fa-file-pdf"></i> Download PDF
          </button>
        </div>
      </div>
    );
  };

  const exportToPdfFile = (dy: number, bs: number, fd: number, oth: number, otp: number, pf: number, advs: number, net: number) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(67, 97, 238);
    doc.text("Duty Tracker Pro", 105, 20, { align: "center" });
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("SALARY STATEMENT SLIP", 105, 30, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Period: ${reportStart} to ${reportEnd}`, 105, 38, { align: "center" });
    doc.text(`Name: ${profile.name}`, 15, 50);
    doc.text(`Email: ${profile.email}`, 15, 55);

    (doc as any).autoTable({
      startY: 65,
      head: [['Description detail', 'Total Value']],
      body: [
        [`Worked Period days (${dy})`, `${conf.cur} ${Math.round(bs)}`],
        ['Food bonus incentive', `${conf.cur} ${Math.round(fd)}`],
        [`Overtime premium (${oth} hrs)`, `${conf.cur} ${Math.round(otp)}`],
        ['PF contribution', `-${conf.cur} ${Math.round(pf)}`],
        ['Advances paid', `-${conf.cur} ${advs}`],
        [{ content: 'NET PAYABLE', styles: { fillColor: [67, 97, 238], textColor: 255, fontStyle: 'bold' } }, `${conf.cur} ${Math.round(net)}`]
      ]
    });

    doc.save(`DutyTracker_Report_${Date.now()}.pdf`);
    showToast("Statement PDF exported successfully!");
  };

  // Theme support
  const handleToggleTheme = () => {
    const n = theme === 'dark' ? 'light' : 'dark';
    setTheme(n);
    localStorage.setItem('theme', n);
    document.body.setAttribute('data-theme', n);
  };

  // Profile configuration updates
  const handleSaveRatesConfig = () => {
    db.ref(`u/${uid}/conf`).set(conf).then(() => {
      showToast("Configuration rates saved!");
    });
  };

  // Calendar logic helpers
  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      const copy = new Date(prev);
      copy.setMonth(copy.getMonth() - 1);
      return copy;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      const copy = new Date(prev);
      copy.setMonth(copy.getMonth() + 1);
      return copy;
    });
  };

  // Days list logic
  const getDaysInMonth = () => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const firstDayIndex = new Date(y, m, 1).getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();

    const blanks = Array(firstDayIndex).fill(null);
    const cells = Array.from({ length: lastDate }, (_, i) => {
      const dayNum = i + 1;
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return { dayNum, iso };
    });

    return [...blanks, ...cells];
  };

  // Maintenance override
  if (isMaintenance) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center text-center p-5 bg-gradient-to-tr from-slate-950 via-zinc-950 to-blue-950 z-50">
        <div className="p-8 max-w-md w-full bg-zinc-900/60 backdrop-blur-md rounded-3xl border border-zinc-800">
          <i className="fas fa-tools text-5xl mb-4 text-blue-500 animate-pulse"></i>
          <h1 className="text-3xl font-extrabold text-white mb-2">Systems Maintenance</h1>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{maintenanceMsg}</p>
          <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800 text-sm text-zinc-300">
            <i className="fas fa-clock text-amber-500 mr-2"></i> Duration estimate: {maintenanceTime}
          </div>
        </div>
      </div>
    );
  }

  // Force Update popup block
  if (forceUpdateConfig.status && uid) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/95 backdrop-blur-md z-50 p-5">
        <div className="p-8 max-w-sm w-full bg-zinc-900 border-2 border-pink-500 rounded-3xl text-center shadow-2xl">
          <i className="fas fa-download text-6xl text-pink-500 mb-4 animate-bounce"></i>
          <h2 className="text-2xl font-extrabold text-white mb-2">{forceUpdateConfig.title}</h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{forceUpdateConfig.message}</p>
          <div className="flex flex-col gap-3">
            <a 
              href={forceUpdateConfig.telegramLink} 
              target="_blank" 
              rel="noreferrer"
              className="btn text-white bg-blue-600 hover:bg-blue-500 font-bold py-3 px-5 rounded-full"
            >
              <i className="fab fa-telegram"></i> Telegram Channel
            </a>
            <a 
              href={forceUpdateConfig.downloadLink} 
              target="_blank" 
              rel="noreferrer"
              className="btn btn-primary"
            >
              <i className="fas fa-rocket"></i> Download Update File
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Auth screen layout
  if (!uid) {
    return (
      <div className="relative min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white pb-12">
        
        {/* Background ambient decorative blurs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-[130px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-72 h-72 bg-indigo-500/10 rounded-full blur-[110px] pointer-events-none"></div>

        <div className="w-full max-w-sm bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800/80 p-6 md:p-8 rounded-[32px] shadow-2xl relative z-10 transition-all duration-300 my-6">
          
          {/* Brand Presentation Section with Custom Premium Logo */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-3 group">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-3xl blur opacity-35 group-hover:opacity-60 transition duration-300"></div>
              <img 
                src="https://i.ibb.co/1fngZNzk/icon-512.png" 
                alt="Duty Tracker Pro Logo" 
                className="relative w-20 h-20 rounded-[24px] object-cover border border-zinc-700/50 shadow-lg transform group-hover:scale-105 transition-all duration-300" 
              />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Duty Tracker <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Pro</span>
            </h1>
            <p className="text-zinc-500 text-xs mt-1.5 font-medium tracking-wide">Professional Duty & Advanced Ledger Suite</p>
          </div>

          {/* Quick PWA Installation Indicator if browser supports it */}
          {showInstallBanner && (
            <div className="mb-6 p-4 bg-zinc-950 border border-blue-500/20 rounded-[20px] flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <img src="https://i.ibb.co/1fngZNzk/icon-512.png" alt="App Logo" className="w-9 h-9 rounded-xl object-cover" />
                <div className="text-left">
                  <h4 className="text-xs font-bold text-white">Duty Tracker Pro</h4>
                  <p className="text-[10px] text-zinc-400">Install app for fast offline access</p>
                </div>
              </div>
              <button 
                onClick={handlePwaInstall}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-xs font-extrabold text-white rounded-lg transition-all shadow-md shadow-blue-600/20"
              >
                INSTALL <i className="fas fa-download ml-1 text-[9px]"></i>
              </button>
            </div>
          )}

          {/* High-End Segmented Sliding Tab Switcher */}
          <div className="flex bg-zinc-950 p-1 rounded-[24px] mb-7 border border-zinc-800/80 shadow-inner relative overflow-hidden">
            <button 
              className={`flex-1 py-3 text-xs font-black rounded-[18px] transition-all duration-300 flex items-center justify-center gap-2 relative z-10 cursor-pointer ${
                activeTab === 'login' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
              onClick={() => setActiveTab('login')}
            >
              <i className="fas fa-shield-halved text-[11px]"></i>
              <span>Employee Login</span>
            </button>
            <button 
              className={`flex-1 py-3 text-xs font-black rounded-[18px] transition-all duration-300 flex items-center justify-center gap-2 relative z-10 cursor-pointer ${
                activeTab === 'signup' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
              onClick={() => setActiveTab('signup')}
            >
              <i className="fas fa-building text-[11px]"></i>
              <span>Employer Register</span>
            </button>
          </div>

          {activeTab === 'login' ? (
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Cellular Dial</label>
                <div className="flex gap-2.5">
                  {/* Styled Country Custom Selection Row Dropdown */}
                  <button 
                    type="button"
                    className="w-[90px] h-[52px] px-3.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800/80 rounded-2xl text-white text-xs font-black flex items-center justify-between transition-all focus:ring-2 focus:ring-blue-500/40 shrink-0 cursor-pointer"
                    onClick={() => setShowCountryModal('login')}
                  >
                    <span>{authCountry.c}</span>
                    <i className="fas fa-chevron-down text-[8px] text-zinc-500"></i>
                  </button>
                  <input 
                    type="number" 
                    placeholder="Phone Number" 
                    className="inp flex-1 h-[52px] !m-0 bg-zinc-950 hover:border-zinc-700/80 transition-all focus:ring-2 focus:ring-blue-500 rounded-2xl placeholder-zinc-600 px-4 text-sm font-medium"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Security Code (PIN)</label>
                <div className="relative">
                  <div className="absolute left-4.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    <i className="fas fa-lock"></i>
                  </div>
                  <input 
                    type="password" 
                    maxLength={4}
                    placeholder="Enter 4-digit PIN" 
                    className="inp pl-12 h-[52px] !m-0 bg-zinc-950 hover:border-zinc-700/80 transition-all focus:ring-2 focus:ring-blue-500 rounded-2xl placeholder-zinc-600 px-4 text-sm font-medium"
                    value={authPin}
                    onChange={(e) => setAuthPin(e.target.value)}
                  />
                </div>
              </div>

              <button 
                className="w-full mt-6 h-[52px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-black rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer tracking-wider" 
                onClick={handleLogin}
              >
                <span>VERIFY & UNLOCK SYSTEM</span>
                <i className="fas fa-unlock-alt text-[10px]"></i>
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Legal Name</label>
                <div className="relative">
                  <div className="absolute left-4.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    <i className="fas fa-user-circle"></i>
                  </div>
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    className="inp pl-12 h-[52px] !m-0 bg-zinc-950 hover:border-zinc-700/80 transition-all focus:ring-2 focus:ring-blue-500 rounded-2xl placeholder-zinc-600 px-4 text-sm font-medium"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Primary Email ID</label>
                <div className="relative">
                  <div className="absolute left-4.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    <i className="fas fa-envelope"></i>
                  </div>
                  <input 
                    type="email" 
                    placeholder="me@domain.com" 
                    className="inp pl-12 h-[52px] !m-0 bg-zinc-950 hover:border-zinc-700/80 transition-all focus:ring-2 focus:ring-blue-500 rounded-2xl placeholder-zinc-600 px-4 text-sm font-medium"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Cellular Connection</label>
                <div className="flex gap-2.5">
                  <button 
                    type="button"
                    className="w-[90px] h-[52px] px-3.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800/80 rounded-2xl text-white text-xs font-black flex items-center justify-between transition-all focus:ring-2 focus:ring-blue-500/40 shrink-0 cursor-pointer"
                    onClick={() => setShowCountryModal('signup')}
                  >
                    <span>{authCountry.c}</span>
                    <i className="fas fa-chevron-down text-[8px] text-zinc-500"></i>
                  </button>
                  <input 
                    type="number" 
                    placeholder="Cell Number" 
                    className="inp flex-1 h-[52px] !m-0 bg-zinc-950 hover:border-zinc-700/80 transition-all focus:ring-2 focus:ring-blue-500 rounded-2xl placeholder-zinc-600 px-4 text-sm font-medium"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">4-digit PIN</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    placeholder="Set PIN" 
                    className="inp text-center tracking-widest h-[52px] !m-0 bg-zinc-950 hover:border-zinc-700/80 transition-all focus:ring-2 focus:ring-blue-500 rounded-2xl placeholder-zinc-600 px-4 text-sm font-medium"
                    value={authPin}
                    onChange={(e) => setAuthPin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Confirm PIN</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    placeholder="Confirm" 
                    className="inp text-center tracking-widest h-[52px] !m-0 bg-zinc-950 hover:border-zinc-700/80 transition-all focus:ring-2 focus:ring-blue-500 rounded-2xl placeholder-zinc-600 px-4 text-sm font-medium"
                    value={authPinConfirm}
                    onChange={(e) => setAuthPinConfirm(e.target.value)}
                  />
                </div>
              </div>

              <button 
                className="w-full mt-6 h-[52px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-black rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer tracking-wider" 
                onClick={handleSignup}
              >
                <span>CREATE WORKSPACE SECURELY</span>
                <i className="fas fa-check-circle text-[10px]"></i>
              </button>
            </div>
          )}
        </div>

        {/* Searching Country Modal inside auth screen (Professional Bottom-Sheet Style) */}
        {showCountryModal && (
          <div className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 z-50 animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-800/80 max-w-md w-full p-6 rounded-t-3xl sm:rounded-3xl flex flex-col h-[80vh] shadow-2xl relative animate-slide-up">
              
              <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden"></div>
              
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-white font-extrabold text-lg">Select Country Code</h3>
                  <p className="text-xs text-zinc-500">Pick dial prefix of your residence</p>
                </div>
                <button 
                  className="w-8 h-8 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-400 flex items-center justify-center text-sm transition-colors" 
                  onClick={() => {
                    setShowCountryModal(null);
                    setCountrySearch('');
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Real-time search bar */}
              <div className="relative mb-4">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                  <i className="fas fa-search"></i>
                </div>
                <input 
                  type="text" 
                  placeholder="Search countries by name or prefix..."
                  className="inp pl-11 h-[48px] !m-0 text-sm bg-zinc-950 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 rounded-2xl placeholder-zinc-600 font-medium"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                />
              </div>

              {/* Popular quick-select chips */}
              <div className="mb-4">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-2">QUICK SELECTION</span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { n: "Bangladesh", c: "+880", f: "🇧🇩" },
                    { n: "India", c: "+91", f: "🇮🇳" },
                    { n: "Saudi Arabia", c: "+966", f: "🇸🇦" },
                    { n: "UAE", c: "+971", f: "🇦🇪" },
                    { n: "Malaysia", c: "+60", f: "🇲🇾" },
                    { n: "Qatar", c: "+974", f: "🇶🇦" }
                  ].map((pop) => (
                    <button
                      key={pop.n}
                      type="button"
                      className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-200 hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none"
                      onClick={() => {
                        setAuthCountry({ n: pop.n, c: pop.c });
                        setShowCountryModal(null);
                        setCountrySearch('');
                      }}
                    >
                      <span className="text-sm">{pop.f}</span>
                      <span>{pop.n} ({pop.c})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                <div className="text-[10px] uppercase font-bold text-zinc-500 mb-2">ALL COUNTRIES</div>
                {filterCountries(countrySearch).map(c => (
                  <div 
                    key={c.n}
                    className="px-4 py-3 bg-zinc-950 rounded-2xl text-xs hover:bg-zinc-800 cursor-pointer text-zinc-300 flex justify-between items-center transition-colors group"
                    onClick={() => {
                      setAuthCountry(c);
                      setShowCountryModal(null);
                      setCountrySearch('');
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-blue-500 transition-colors"></span>
                      <span className="font-semibold">{c.n}</span>
                    </div>
                    <span className="font-extrabold text-blue-400 bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-900/40">{c.c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {toastMsg && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-zinc-900 border border-zinc-800 text-white rounded-full text-xs font-bold shadow-2xl tracking-wide flex items-center gap-2 animate-slide-up"><i className="fas fa-info-circle text-blue-500"></i> {toastMsg}</div>}
      </div>
    );
  }

  // Force Locked PIN View
  if (!pinVerified) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 z-50 p-5">
        <div className="max-w-xs w-full bg-zinc-900 border border-zinc-850 p-6 rounded-3xl text-center shadow-2xl">
          <i className="fas fa-lock text-4xl text-blue-500 mb-4 animate-bounce"></i>
          <h2 className="text-xl font-extrabold text-white mb-1">Enter Security PIN</h2>
          <p className="text-zinc-500 text-xs mb-6">Type standard 4-digit code to decrypt database.</p>

          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className={`w-4 h-4 rounded-full border border-blue-500/50 ${idx < pinCurrent.length ? 'bg-gradient-to-tr from-blue-500 to-indigo-500 scale-110 shadow-lg shadow-blue-500/30' : 'bg-transparent'}`}
              />
            ))}
          </div>

          {pinBlockTimeRemaining > 0 && (
            <p className="text-rose-500 text-xs mb-4">Locked! Please wait {pinBlockTimeRemaining}s</p>
          )}

          <div className="grid grid-cols-3 gap-3 mb-6">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(val => (
              <button 
                key={val} 
                className="btn btn-sec p-3 text-lg font-bold !m-0 rounded-xl"
                onClick={() => handlePinNumPress(val)}
                disabled={pinBlockTimeRemaining > 0}
              >
                {val}
              </button>
            ))}
            <button 
              className="btn btn-sec p-3 text-sm font-bold text-rose-500 !m-0" 
              onClick={() => setPinCurrent('')}
            >
              CLR
            </button>
            <button 
              className="btn btn-sec p-3 text-lg font-bold !m-0" 
              onClick={() => handlePinNumPress('0')}
              disabled={pinBlockTimeRemaining > 0}
            >
              0
            </button>
            <button 
              className="btn btn-sec p-3 text-sm font-bold text-zinc-400 !m-0" 
              onClick={() => setPinCurrent(prev => prev.slice(0, -1))}
            >
              DEL
            </button>
          </div>

          <button 
            className="btn btn-sec py-2 text-xs" 
            onClick={() => {
              localStorage.removeItem('dt_id');
              setUid(null);
            }}
          >
            Switch Account
          </button>
        </div>
        {toastMsg && <div className="fixed bottom-8 left-50 -translate-x-50 z-50 p-4 bg-zinc-800 text-white rounded-full text-xs shadow-xl">{toastMsg}</div>}
      </div>
    );
  }

  // Active view templates routing
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100">
      
      {/* Top Header App Navbar */}
      <nav className="flex justify-between items-center p-4 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40">
        <h2 className="logo text-xl font-extrabold bg-gradient-to-tr from-blue-500 to-indigo-500 bg-clip-text text-transparent">
          Duty Tracker Pro
        </h2>
        <div className="flex items-center gap-4">
          <button className="text-zinc-400 text-lg hover:text-white" onClick={handleToggleTheme}>
            <i className="fas fa-adjust"></i>
          </button>
          <img 
            src={profile.img || "https://i.ibb.co/1fngZNzk/icon-512.png"} 
            className="w-8 h-8 rounded-full border-2 border-primary object-cover cursor-pointer"
            alt="Profile avatar"
            onClick={() => setCurrentView('profile')}
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://i.ibb.co/1fngZNzk/icon-512.png'; }}
          />
        </div>
      </nav>

      {/* Main Container Views */}
      <main className="flex-1 pb-24 overflow-y-auto">
        
        {/* VIEW: HOME / MAIN CALENDAR */}
        {currentView === 'home' && (
          <div className="p-4 space-y-4">
            
            {/* Header controls for Calendar Month */}
            <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={handlePrevMonth}>
                <i className="fas fa-chevron-left text-zinc-400"></i>
              </button>
              <h3 className="font-extrabold text-blue-500">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={handleNextMonth}>
                <i className="fas fa-chevron-right text-zinc-400"></i>
              </button>
            </div>

            {/* Calendar grid labels */}
            <div className="grid grid-cols-7 text-center font-bold text-xs text-zinc-500">
              <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
            </div>

            {/* Calendar main map days */}
            <div className="grid grid-cols-7 gap-2">
              {getDaysInMonth().map((day, idx) => {
                if (!day) return <div key={`blank-${idx}`} />;
                const entry = data[day.iso];
                const cleanClass = entry ? `bg-${entry.t.replace(' ', '')}` : '';
                const today = new Date().toISOString().split('T')[0];
                return (
                  <div 
                    key={day.iso}
                    className={`h-22 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative cursor-pointer hover:border-blue-500/50 ${day.iso === today ? 'border-primary bg-blue-950/20' : ''} ${cleanClass}`}
                    onClick={() => openAttendanceModal(day.iso)}
                  >
                    <span className="text-md font-bold">{day.dayNum}</span>
                    {entry && (
                      <>
                        <span className="text-[9px] font-medium leading-none mt-1 opacity-90">{entry.t}</span>
                        {entry.ot && <span className="text-[8px] bg-black/40 px-1 rounded mt-1 font-bold text-amber-500">+{entry.ot}h</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Check-In / Check-Out system */}
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
              <div className="flex justify-around text-center">
                <div>
                  <span className="text-zinc-500 text-xs">Logged Check-In</span>
                  <p className="text-md font-extrabold text-emerald-400 mt-1">{checkin ? checkin.time : "--:--"}</p>
                </div>
                <div className="w-px bg-zinc-800" />
                <div>
                  <span className="text-zinc-500 text-xs">Logged Check-Out</span>
                  <p className="text-md font-extrabold text-rose-400 mt-1">{checkout ? checkout.time : "--:--"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1 py-3 text-xs" onClick={handleCheckin}>
                  <i className="fas fa-sign-in-alt"></i> Check In
                </button>
                <button className="btn btn-sec flex-1 py-3 text-xs text-rose-500 border-rose-500/30" onClick={handleCheckout}>
                  <i className="fas fa-sign-out-alt"></i> Check Out
                </button>
              </div>
            </div>

            {/* Quick action shortcuts */}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-sec py-4 text-xs flex flex-col gap-2 items-center" onClick={() => openAttendanceModal(new Date().toISOString().split('T')[0])}>
                <i className="fas fa-plus-circle text-blue-500 text-lg"></i>
                <span>Add Today's Entry</span>
              </button>
              <button 
                className="btn btn-primary py-4 text-xs flex flex-col gap-2 items-center"
                onClick={() => {
                  if (isPremiumUser) {
                    setCurrentView('reports');
                  } else {
                    setShowModal('promo');
                  }
                }}
              >
                <i className="fas fa-file-invoice-dollar text-lg"></i>
                <span>Quick Salary Statement</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW: REPORTS */}
        {currentView === 'reports' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('home')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">Salary Slip Statement</h2>
            </div>

            <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
              <div>
                <span className="label-text">Select Start Date</span>
                <input 
                  type="date" 
                  className="inp m-0"
                  value={reportStart}
                  onChange={(e) => setReportStart(e.target.value)}
                />
              </div>
              <div>
                <span className="label-text">Select End Date</span>
                <input 
                  type="date" 
                  className="inp m-0"
                  value={reportEnd}
                  onChange={(e) => setReportEnd(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={generateSalaryReportLayout}>
                Calculate Wage Statement <i className="fas fa-calculator ml-1"></i>
              </button>
            </div>

            {reportHtml}
          </div>
        )}

        {/* VIEW: GRAPH */}
        {currentView === 'graph' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('home')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">Progress Goals Monitor</h2>
            </div>

            {!isPremiumUser ? (
              <div className="p-6 bg-zinc-900 text-center rounded-3xl border border-zinc-800 space-y-3">
                <i className="fas fa-lock text-4xl text-amber-500"></i>
                <h3 className="text-lg font-bold">Premium access required</h3>
                <p className="text-zinc-500 text-xs">Unlock interactive linear progress charts and goal targets now!</p>
                <button className="btn btn-primary" onClick={() => setShowModal('promo')}>Upgrade Workspace</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl text-center">
                  <span className="text-zinc-500 text-xs">Total Target Goal Remaining</span>
                  <h4 className="text-3xl font-extrabold text-blue-500 mt-1">{conf.cur}{conf.target}</h4>
                </div>

                <div className="p-5 bg-zinc-900 border border-zinc-850 rounded-3xl h-64 relative">
                  <canvas ref={chartRef} className="w-full h-full" />
                </div>

                <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
                  <h4 className="font-extrabold">Modify Target Wage Goal</h4>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="e.g. 15000" 
                      className="inp flex-1 !m-0"
                      value={targetGoalInput}
                      onChange={(e) => setTargetGoalInput(e.target.value)}
                    />
                    <button className="btn btn-primary py-2 px-6" onClick={handleSetTarget}>Save</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: ADVANCES CASH */}
        {currentView === 'advance' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('home')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">Advances Cash Manager</h2>
            </div>

            {!isPremiumUser ? (
              <div className="p-6 bg-zinc-900 text-center rounded-3xl border border-zinc-800 space-y-3">
                <i className="fas fa-lock text-4xl text-amber-500"></i>
                <h3 className="text-lg font-bold">Premium feature</h3>
                <p className="text-zinc-500 text-xs">Advances automatically deduct from generated statements. Activate premium today.</p>
                <button className="btn btn-primary" onClick={() => setShowModal('promo')}>Unlock Workspace</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
                  <span className="text-zinc-500 font-extrabold text-xs uppercase tracking-wider block">Add Advance Record</span>
                  <input 
                    type="number" 
                    placeholder="Advance Cash Amount" 
                    className="inp"
                    value={advAmt}
                    onChange={(e) => setAdvAmt(e.target.value)}
                  />
                  <input 
                    type="date" 
                    className="inp"
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                  />
                  <input 
                    type="text" 
                    placeholder="Company Contractor Name" 
                    className="inp"
                    value={advBy}
                    onChange={(e) => setAdvBy(e.target.value)}
                  />
                  <input 
                    type="text" 
                    placeholder="Remarks note (Optional)" 
                    className="inp"
                    value={advNote}
                    onChange={(e) => setAdvNote(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={handleAddAdvance}>
                    Commit Advance Entry <i className="fas fa-save"></i>
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="font-extrabold text-sm uppercase text-zinc-500">History Lists</h3>
                  {Object.keys(adv).length === 0 ? (
                    <p className="text-zinc-500 text-xs text-center py-6">No cash advancements recorded.</p>
                  ) : (
                    Object.keys(adv).map(key => {
                      const item = adv[key];
                      return (
                        <div key={key} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex justify-between items-center transition-all hover:border-rose-500/30">
                          <div>
                            <span className="text-rose-500 font-extrabold text-lg">{conf.cur}{item.amt}</span>
                            <p className="text-zinc-500 text-xs mt-1">{item.date} {item.by ? `• ${item.by}` : ''}</p>
                            {item.note && <span className="text-[10px] text-zinc-400 italic block mt-1">"{item.note}"</span>}
                          </div>
                          <button className="text-rose-500 font-bold p-2 text-sm" onClick={() => handleDeleteAdvance(key)}>
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: SETTINGS / UTILITY RATES */}
        {currentView === 'settings' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('home')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">Utility Rates Settings</h2>
            </div>

            {!isPremiumUser ? (
              <div className="p-6 bg-zinc-900 text-center rounded-3xl border border-zinc-800 space-y-3">
                <i className="fas fa-lock text-4xl text-amber-500"></i>
                <h3 className="text-lg font-bold">Premium parameters lock</h3>
                <p className="text-zinc-500 text-xs">Daily wage metrics and tax configs require an active subscription.</p>
                <button className="btn btn-primary" onClick={() => setShowModal('promo')}>Upgrade Workspace</button>
              </div>
            ) : (
              <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
                <div>
                  <span className="label-text">Local Currency</span>
                  <select 
                    className="inp m-0"
                    value={conf.cur}
                    onChange={(e) => setConf({ ...conf, cur: e.target.value })}
                  >
                    <option value="₹">₹ INR Rupee</option>
                    <option value="৳">৳ BDT Taka</option>
                    <option value="$">$ USD Dollar</option>
                    <option value="AED">AED Dirhams</option>
                    <option value="SAR">SAR Riyals</option>
                  </select>
                </div>

                <div>
                  <span className="label-text">Daily Base Salary (Hajira)</span>
                  <input 
                    type="number" 
                    className="inp m-0"
                    value={conf.sal || ''}
                    onChange={(e) => setConf({ ...conf, sal: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <span className="label-text">Food allowance metrics (Per Day)</span>
                  <input 
                    type="number" 
                    className="inp m-0"
                    value={conf.food || ''}
                    onChange={(e) => setConf({ ...conf, food: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <span className="label-text">Overtime hourly compensation rate</span>
                  <input 
                    type="number" 
                    className="inp m-0"
                    value={conf.otr || ''}
                    onChange={(e) => setConf({ ...conf, otr: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <span className="label-text">Provident Fund (PF Fixed subtraction)</span>
                  <input 
                    type="number" 
                    className="inp m-0"
                    value={conf.pf || ''}
                    onChange={(e) => setConf({ ...conf, pf: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <button className="btn btn-primary pt-4" onClick={handleSaveRatesConfig}>
                  Save Utility Database <i className="fas fa-check-double"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW: PROFILE PANEL */}
        {currentView === 'profile' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('home')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">My Personal Profile</h2>
            </div>

            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-3 relative overflow-hidden">
              <div className="relative w-24 h-24 mx-auto">
                <img 
                  src={profile.img || "https://i.ibb.co/1fngZNzk/icon-512.png"} 
                  className="w-full h-full rounded-full border-4 border-blue-500 object-cover"
                  alt="Profile"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://i.ibb.co/1fngZNzk/icon-512.png'; }}
                />
                <label className="absolute bottom-1 right-1 bg-blue-500 text-white rounded-full p-2 text-xs border border-zinc-900 cursor-pointer shadow-md">
                  <i className="fas fa-camera"></i>
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                </label>
              </div>

              <h3 className="text-lg font-bold">{profile.name || "User"}</h3>
              <p className="text-zinc-500 text-xs">{uid}</p>
              <p className="text-zinc-400 text-xs">{profile.email}</p>

              <div className="pt-2 flex justify-center">
                <span className={`px-4 py-1.5 text-xs font-extrabold rounded-full ${isPremiumUser ? 'bg-gradient-to-tr from-indigo-500 to-pink-500 text-white' : 'bg-rose-500 text-white'}`}>
                  {isPremiumUser ? "PREMIUM MEMBERSHIP" : "FREE TRIAL / DEMO"}
                </span>
              </div>
              <p className="text-zinc-500 text-[10px]">Expiry: {new Date(sub).toLocaleDateString()}</p>
            </div>

            {/* List triggers */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
              <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-800/40 text-sm" onClick={() => setCurrentView('refer')}>
                <div className="flex items-center gap-3">
                  <i className="fas fa-magic text-blue-500 text-lg"></i>
                  <span>Refer & Unlock Premium Benefits</span>
                </div>
                <i className="fas fa-chevron-right text-zinc-500"></i>
              </div>

              <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-800/40 text-sm" onClick={() => setCurrentView('payments')}>
                <div className="flex items-center gap-3">
                  <i className="fab fa-bitcoin text-amber-500 text-lg"></i>
                  <span>USDT Payment Gateways Status</span>
                </div>
                <i className="fas fa-chevron-right text-zinc-500"></i>
              </div>

              <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-800/40 text-sm" onClick={() => setCurrentView('history')}>
                <div className="flex items-center gap-3">
                  <i className="fas fa-history text-zinc-400 text-lg"></i>
                  <span>Subscription Invoice History</span>
                </div>
                <i className="fas fa-chevron-right text-zinc-500"></i>
              </div>

              <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-800/40 text-sm" onClick={() => { setPinMode('change'); setPinCurrent(''); setPinVerified(false); }}>
                <div className="flex items-center gap-3">
                  <i className="fas fa-key text-amber-500 text-lg"></i>
                  <span>Security settings - Amend PIN</span>
                </div>
                <i className="fas fa-chevron-right text-zinc-500"></i>
              </div>

              <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-800/40 text-sm" onClick={() => setCurrentView('help')}>
                <div className="flex items-center gap-3">
                  <i className="fas fa-question-circle text-blue-500 text-lg"></i>
                  <span>Help & Frequently Asked Questions</span>
                </div>
                <i className="fas fa-chevron-right text-zinc-500"></i>
              </div>

              <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-800/40 text-sm" onClick={() => setCurrentView('legal')}>
                <div className="flex items-center gap-3">
                  <i className="fas fa-file-contract text-zinc-400 text-lg"></i>
                  <span>Legal Licenses & Policies</span>
                </div>
                <i className="fas fa-chevron-right text-zinc-500"></i>
              </div>
            </div>

            <button 
              className="btn btn-danger max-w-xs mx-auto text-sm"
              onClick={() => {
                setConfirmTitle("Log out details");
                setConfirmDesc("Confirm erasing local user logs from this workspace?");
                setConfirmCallback(() => () => {
                  localStorage.removeItem('dt_id');
                  setUid(null);
                  showToast("User logged out");
                });
                setShowModal('confirm');
              }}
            >
              Sign Out Securely <i className="fas fa-lock"></i>
            </button>
          </div>
        )}

        {/* VIEW: INVITE CODES */}
        {currentView === 'refer' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('profile')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">Invite Referral Code</h2>
            </div>

            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-4">
              <i className="fas fa-gift text-5xl text-yellow-500 animate-bounce"></i>
              <h3 className="text-lg font-bold">Refer Friends, Gain Premium!</h3>
              <p className="text-zinc-500 text-xs">Share your unique credentials keys below. Every successful active referral generates +10 Days premium allowance reward!</p>

              <div className="p-4 bg-zinc-950 border border-dashed border-blue-500/50 rounded-2xl text-2xl font-extrabold text-blue-500 tracking-widest uppercase">
                {refCode || "NO_CODE"}
              </div>

              <button 
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(`Use referral code ${refCode} on Duty Tracker Pro to claim +10 Days premium! Download: https://dutytrackerpro.blogspot.com`);
                  showToast("Referral link copied!");
                }}
              >
                Copy invitation Link <i className="fas fa-copy"></i>
              </button>

              <div className="border-t border-zinc-800 pt-5 space-y-3 text-left">
                <span className="label-text">Have a friend's reference code?</span>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="ENTER FRIEND'S CODE" 
                    className="inp flex-1 !m-0 uppercase"
                    value={friendRefCode}
                    onChange={(e) => setFriendRefCode(e.target.value)}
                  />
                  <button className="btn btn-primary px-6 py-2" onClick={handleApplyFriendCode}>Apply</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: HISTORY LIST */}
        {currentView === 'history' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('profile')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">History Billing Slips</h2>
            </div>

            <div className="space-y-3">
              {historyList.length === 0 ? (
                <p className="text-zinc-500 text-xs text-center py-8">No payments statement recorded yet.</p>
              ) : (
                historyList.map((hist, index) => (
                  <div key={index} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="font-extrabold text-white text-md">Premium plan {hist.plan || ''}</span>
                      <p className="text-zinc-500 text-xs mt-1">Paid via {hist.method} • {new Date(hist.date).toLocaleString()}</p>
                    </div>
                    <span className="text-emerald-500 font-extrabold text-lg">
                      {hist.currency === 'USD' ? '$' : '₹'}{hist.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW: USDT PAYMENTS */}
        {currentView === 'payments' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('profile')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">USDT Binance Gateways</h2>
            </div>

            <div className="flex justify-between items-center">
              <span>Binance TRC20</span>
              <button className="btn btn-binance py-2 px-5 text-xs inline-flex w-auto" onClick={() => setShowModal('binance')}>
                Submit New proof
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zinc-500 text-xs uppercase">Proof processing list</h3>
              {binanceRequests.length === 0 ? (
                <p className="text-zinc-500 text-xs text-center py-6">No active submissions found.</p>
              ) : (
                binanceRequests.map((req, idx) => (
                  <div key={idx} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-sm font-extrabold text-white capitalize">{req.plan} plan</span>
                      <p className="text-zinc-500 text-xs">Amount: ₹{req.amount} (~${(req.amount / 85).toFixed(2)} USDT)</p>
                      <p className="text-[10px] text-zinc-500 uppercase">TXID: {req.txid.substring(0, 16)}...</p>
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${req.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {req.status === 'approved' ? 'Approved' : 'Pending Verification'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW: FAQ MANUAL */}
        {currentView === 'help' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('profile')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">Frequently Asked Questions</h2>
            </div>

            <div className="space-y-3">
              {[
                { q: "How to add new attendance entry?", a: "Simply tap on any calendars date directly from current active Month Home layout to launch details menu modal." },
                { q: "How are advances calculated?", a: "When committing payment reports, overall summed Advances values are subtracted securely from target payable wage calculations." },
                { q: "How do I claim a WhatsApp/Telegram reward?", a: "Unlock 7 premium benefits boosts within trial periods directly by tapping channel subscription rewards!" }
              ].map((faq, index) => (
                <div key={index} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                  <h4 className="font-extrabold text-blue-500 text-sm">💡 {faq.q}</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: LEGAL */}
        {currentView === 'legal' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button className="p-2 border border-zinc-700 rounded-xl" onClick={() => setCurrentView('profile')}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <h2 className="text-xl font-bold">Legal Agreements & Policies</h2>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
              {Object.keys(legalTexts).map(key => (
                <div 
                  key={key} 
                  className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-800"
                  onClick={() => {
                    setLegalType(key);
                    setShowModal('legal_text');
                  }}
                >
                  <span className="text-sm font-semibold">{legalTexts[key].title}</span>
                  <i className="fas fa-chevron-right text-zinc-500 text-xs"></i>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Dynamic Monetag Ad Space placeholder bottom */}
      {!isPremiumUser && (
        <div className="fixed bottom-20 left-0 w-full h-14 bg-zinc-900/80 backdrop-blur border-y border-zinc-805/40 flex items-center justify-center monetag-ad-container z-40">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest scale-95">SPONSORED WORKSPACE LINK</p>
        </div>
      )}

      {/* Bottom Nav Bar Controls */}
      <div className="bottom-nav">
        <button 
          className={`nav-btn ${currentView === 'reports' ? 'active' : ''}`}
          onClick={() => {
            if (isPremiumUser) setCurrentView('reports');
            else setShowModal('promo');
          }}
        >
          <i className="fas fa-chart-pie"></i>
          <span>Report</span>
        </button>

        <button 
          className={`nav-btn ${currentView === 'graph' ? 'active' : ''}`}
          onClick={() => {
            if (isPremiumUser) setCurrentView('graph');
            else setShowModal('promo');
          }}
        >
          <i className="fas fa-chart-line"></i>
          <span>Graph</span>
        </button>

        <div className="relative flex justify-center">
          <button 
            className="floating-home" 
            onClick={() => setCurrentView('home')}
          >
            <i className="fas fa-home text-white"></i>
          </button>
        </div>

        <button 
          className={`nav-btn ${currentView === 'advance' ? 'active' : ''}`}
          onClick={() => {
            if (isPremiumUser) setCurrentView('advance');
            else setShowModal('promo');
          }}
        >
          <i className="fas fa-hand-holding-usd"></i>
          <span>Advance</span>
        </button>

        <button 
          className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => {
            if (isPremiumUser) setCurrentView('settings');
            else setShowModal('promo');
          }}
        >
          <i className="fas fa-cog"></i>
          <span>Utility</span>
        </button>
      </div>

      {/* MODAL: PREMIUM PROMOTION WALL */}
      {showModal === 'promo' && (
        <div className="fixed inset-0 flex flex-col justify-end bg-black/80 z-50">
          <div className="bg-zinc-900 border-t-2 border-primary p-6 rounded-t-[32px] space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-extrabold px-3 py-1 rounded-full uppercase">Workspace Upgrade</span>
                <h3 className="text-2xl font-black text-white mt-1">Unlock Premium</h3>
              </div>
              <button className="text-zinc-400 text-lg" onClick={() => setShowModal(null)}>
                <i className="fas fa-times-circle"></i>
              </button>
            </div>

            <p className="text-zinc-400 text-xs">Gain absolute controls on salary summaries, advanced cash logs, goal tracking, and complete ad-free premium workspace rendering speeds.</p>

            <div className="grid grid-cols-3 gap-3">
              <button 
                className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-center flex flex-col hover:border-blue-500"
                onClick={() => executeRazorpay('monthly')}
              >
                <span className="text-xs font-bold text-zinc-400">Monthly</span>
                <span className="text-xl font-extrabold text-blue-500 mt-2">₹{priceConfig.razorpay.monthly}</span>
              </button>
              <button 
                className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-center flex flex-col hover:border-blue-500"
                onClick={() => executeRazorpay('6months')}
              >
                <span className="text-xs font-bold text-zinc-400">6 Months</span>
                <span className="text-xl font-extrabold text-blue-500 mt-2">₹{priceConfig.razorpay.sixmonths}</span>
              </button>
              <button 
                className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-center flex flex-col hover:border-blue-500"
                onClick={() => executeRazorpay('yearly')}
              >
                <span className="text-xs font-bold text-zinc-400">Yearly</span>
                <span className="text-xl font-extrabold text-blue-500 mt-2">₹{priceConfig.razorpay.yearly}</span>
              </button>
            </div>

            {/* Offline gateways indicators */}
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
              <h4 className="text-zinc-400 text-[11px] font-extrabold uppercase">Manual Payments option</h4>
              <div className="flex gap-2">
                <button 
                  className="btn btn-binance py-2 px-4 text-xs !m-0 flex-1"
                  onClick={() => {
                    setShowModal('binance');
                  }}
                >
                  <i className="fab fa-bitcoin"></i> USDT Transfer
                </button>
                <button 
                  className="btn btn-primary py-2 px-4 text-xs !m-0 !bg-blue-600 flex-1"
                  onClick={() => {
                    window.open(PAYPAL_MONTHLY_URL, '_blank');
                  }}
                >
                  <i className="fab fa-paypal"></i> PayPal USD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL BINANCE PAYMENT PROOF */}
      {showModal === 'binance' && (
        <div className="fixed inset-0 flex items-center justify-center p-5 z-50 bg-black/90">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-extrabold text-lg flex items-center gap-2">
                <i className="fab fa-bitcoin text-amber-500"></i> USDT TRC20 Verification
              </h3>
              <button className="text-zinc-400 text-lg" onClick={() => setShowModal(null)}>&times;</button>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-bold block uppercase">Wallet (TRC20 Network only)</span>
              <p className="text-[11px] font-bold text-zinc-300 break-all select-all font-mono">TQdxG63t1CdgHF9EoA1PzXtvrNm8qrsobt</p>
              <button 
                className="text-xs text-blue-500 font-extrabold"
                onClick={() => {
                  navigator.clipboard.writeText("TQdxG63t1CdgHF9EoA1PzXtvrNm8qrsobt");
                  showToast("Wallet address Copied!");
                }}
              >
                Copy address
              </button>
            </div>

            <div>
              <span className="label-text">Select Premium Plan</span>
              <select 
                className="inp"
                value={binancePlan}
                onChange={(e) => setBinancePlan(e.target.value as any)}
              >
                <option value="monthly">Monthly Plan — ₹{priceConfig.razorpay.monthly}</option>
                <option value="6months">6 Months Plan — ₹{priceConfig.razorpay.sixmonths}</option>
                <option value="yearly">Yearly Plan — ₹{priceConfig.razorpay.yearly}</option>
              </select>
            </div>

            <div>
              <span className="label-text">Transaction Hash / TXID</span>
              <input 
                type="text" 
                placeholder="Paste TXID values" 
                className="inp"
                value={binanceTx}
                onChange={(e) => setBinanceTx(e.target.value)}
              />
            </div>

            <div>
              <span className="label-text">Screenshot verification proof</span>
              <input 
                type="file" 
                accept="image/*" 
                className="inp text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setBinanceImageFile(f);
                    setBinancePreviewUrl(URL.createObjectURL(f));
                  }
                }}
              />
              {binancePreviewUrl && <img src={binancePreviewUrl} alt="Screenshot info Preview" className="h-28 w-auto rounded mt-2 border border-dashed border-zinc-800" />}
            </div>

            <button className="btn btn-binance" onClick={handleBinancePaymentSubmit}>
              Submit for manual verification
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETION */}
      {showModal === 'confirm' && (
        <div className="fixed inset-0 flex items-center justify-center p-5 bg-black/80 z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-xs text-center space-y-4">
            <h3 className="font-extrabold text-white text-lg">{confirmTitle}</h3>
            <p className="text-zinc-400 text-xs">{confirmDesc}</p>
            <div className="flex gap-2">
              <button className="btn btn-sec flex-1 py-2 text-xs" onClick={() => setShowModal(null)}>Cancel</button>
              <button 
                className="btn btn-primary bg-rose-600 flex-1 py-2 text-xs"
                onClick={() => {
                  confirmCallback();
                  setShowModal(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL ATTENDANCE ENTRY */}
      {showModal === 'attendance' && (
        <div className="fixed inset-0 flex justify-end bg-black/80 z-50">
          <div className="bg-zinc-900 border-t-2 border-blue-500 rounded-t-[32px] p-6 space-y-4 w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white">{new Date(selDate).toDateString()}</h3>
              <button className="text-zinc-500 text-md" onClick={() => setShowModal(null)}>
                <i className="fas fa-times-circle"></i>
              </button>
            </div>

            {/* Grid states options */}
            <div className="grid grid-cols-3 gap-2">
              {['Present', 'Half Day', 'Leave', 'Sick', 'Holiday', 'Off'].map((sts) => (
                <button 
                  key={sts}
                  className={`btn text-xs py-3 ${selStatus === sts ? 'btn-primary' : 'btn-sec'}`}
                  onClick={() => setSelStatus(sts as any)}
                >
                  {sts}
                </button>
              ))}
            </div>

            <div>
              <span className="label-text">Work Shift Select</span>
              <select 
                className="inp"
                value={inpShift}
                onChange={(e) => setInpShift(e.target.value as any)}
              >
                <option value="Morning">Morning Shift</option>
                <option value="Evening">Evening Shift</option>
                <option value="Night">Night Shift</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <span className="label-text">Worked Overtime (hours)</span>
                <input 
                  type="number" 
                  className="inp"
                  value={inpOt}
                  placeholder="0"
                  onChange={(e) => setInpOt(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <span className="label-text">Late minutes log</span>
                <input 
                  type="number" 
                  className="inp"
                  value={inpLate}
                  placeholder="0"
                  onChange={(e) => setInpLate(e.target.value)}
                />
              </div>
            </div>

            <button className="btn btn-primary" onClick={saveAttendanceEntry}>
              Commit Entry logs
            </button>
            
            <div className="flex gap-2 pt-2">
              <button className="btn btn-danger py-2 text-xs flex-1" onClick={deleteAttendanceEntry}>Delete Record</button>
              <button className="btn btn-sec py-2 text-xs flex-1" onClick={() => setShowModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHANNELS JOINING REWARD */}
      {showModal === 'reward' && (
        <div className="fixed inset-0 flex items-center justify-center p-5 bg-black/90 z-50">
          <div className="p-6 bg-zinc-900 border-2 border-pink-500 rounded-3xl max-w-sm w-full text-center space-y-4">
            <i className="fas fa-gift text-5xl text-pink-550 animate-pulse"></i>
            <h3 className="text-xl font-extrabold text-white">Join & Unlock +7 Days!</h3>
            <p className="text-zinc-400 text-xs">Join our official social feeds to receive instant premium boost trial extensions details value.</p>
            
            <div className="grid grid-cols-2 gap-2">
              <a 
                href="https://telegram.me/DutyTrackerProapp" 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-sec text-xs"
              >
                <i className="fab fa-telegram"></i> Telegram
              </a>
              <a 
                href="https://whatsapp.com/channel/0029Vb6SlL01dAw9flibc12I" 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-sec text-xs"
              >
                <i className="fab fa-whatsapp"></i> WhatsApp
              </a>
            </div>

            <button className="btn btn-primary" onClick={claimRewardPremium}>
              I Joined – Redeem +7 Days Premium <i className="fas fa-crown"></i>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: LEGAL POLICY FULLTEXT VIEWER */}
      {showModal === 'legal_text' && (
        <div className="fixed inset-0 flex flex-col bg-zinc-950 z-50 p-5 overflow-y-auto">
          <div className="flex justify-between items-center pb-4 mb-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-40">
            <h3 className="text-xl font-extrabold text-blue-500 capitalize">
              {legalTexts[legalType]?.title}
            </h3>
            <button className="text-zinc-400 text-2xl" onClick={() => setShowModal(null)}>&times;</button>
          </div>
          <div 
            className="text-zinc-300 text-sm leading-relaxed space-y-4"
            dangerouslySetInnerHTML={{ __html: legalTexts[legalType]?.body }}
          />
        </div>
      )}

      {/* Toast Overlay */}
      {toastMsg && <div className="fixed bottom-24 left-50 -translate-x-50 z-50 p-4 bg-zinc-800 text-white rounded-full text-xs shadow-xl">{toastMsg}</div>}
    </div>
  );
}
