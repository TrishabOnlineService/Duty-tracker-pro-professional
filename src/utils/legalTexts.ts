export const legalTexts: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: `<h3>Privacy Policy</h3>
<p><strong>Effective Date:</strong> January 1, 2026</p>
<p><strong>Age Restriction:</strong> You must be 18 years or older to use this application.</p>
<p><strong>Data Protection:</strong> We do NOT sell your personal data. Your records, cash database, and credentials are strictly isolated on secure Google Firebase databases.</p>
<h4>1. Information We Collect</h4>
<p>- Account Info: Name, Phone, Email, 4-digit security PIN.</p>
<p>- Attendance records: Shifts, duty status, OT hours, check times.</p>
<p>- Financial data: Salary configurations, advance cash items.</p>
<h4>2. Third-Party Interfaces</h4>
<p>We work with trusted APIs: Razorpay (INR pay), PayPal (USD), Binance USDT (TRC20) and OneSignal (Alerts).</p>`
  },
  terms: {
    title: "Terms & Conditions",
    body: `<h3>Terms & Conditions</h3>
<p><strong>Last Updated:</strong> January 1, 2026</p>
<p>By accessing Duty Tracker Pro, you agree to these terms. Users must be 18+.</p>
<h4>1. Privacy & Protection</h4>
<p>You are solely responsible for maintaining the confidentiality of your account PIN.</p>
<h4>2. Subscriptions</h4>
<p>Subscriptions do not auto-renew. Renewal must be executed manually before the expiry date.</p>`
  },
  refund: {
    title: "Refund Policy",
    body: `<h3>Refund Policy</h3>
<p>Due to the instant provision of digital software, purchases are final. Pro-rated refunds are evaluated only during server outages of more than 7 days.</p>`
  },
  subscription: {
    title: "Subscription Policy",
    body: `<h3>Subscription Policy</h3>
<p>Active Premium is calculated as: subExp > Date.now(). Monthly, semi-annual, and annual plans are supported via selected payment portals.</p>`
  },
  deletion: {
    title: "Data Deletion",
    body: `<h3>Data Deletion Policy</h3>
<p>To request permanent erasure, contact support at <strong>nitai.grp00@gmail.com</strong>. Your personal data is cleared within 30 days.</p>`
  },
  disclaimer: {
    title: "Disclaimer",
    body: `<h3>Disclaimer</h3>
<p>This software is a general tracking tool and is NOT an official corporate payroll service. Verify all counts before finalizing wages with employers.</p>`
  }
};
