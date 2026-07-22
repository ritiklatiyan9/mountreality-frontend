import api from '../api/api';

const loadScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Razorpay. Check your connection.'));
    document.body.appendChild(script);
  });

/**
 * Full plan purchase flow: create order → open Razorpay checkout → verify payment.
 * Resolves with the activated subscription; rejects on failure/dismissal.
 */
export const purchasePlan = async (plan, user, billingCycle = 'monthly') => {
  await loadScript();
  const { data: order } = await api.post('/billing/order', { plan_id: plan.id, billing_cycle: billingCycle });

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: 'Mount Reality',
      description: `${order.plan.name} plan — ${order.billing_cycle === 'annual' ? 'annual (15% off)' : 'monthly'}`,
      prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
      theme: { color: '#2563eb' },
      handler: async (response) => {
        try {
          const { data } = await api.post('/billing/verify', response);
          resolve(data.subscription);
        } catch (err) {
          reject(new Error(err.response?.data?.message || 'Payment verification failed'));
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.on('payment.failed', (resp) => {
      rzp.close();
      reject(new Error(resp.error?.description || 'Payment failed'));
    });
    rzp.open();
  });
};

export const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
